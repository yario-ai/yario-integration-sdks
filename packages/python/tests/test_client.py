import httpx
import pytest

from yario_integration import YarioApiError, YarioClient


def test_authentication_and_read_without_idempotency_key():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/me"
        assert request.headers["api-key"] == "test_key"
        assert "idempotency-key" not in request.headers
        return httpx.Response(200, json={"id": "partner_1", "name": "Demo"})

    http = httpx.Client(base_url="https://example.test", transport=httpx.MockTransport(handler))
    client = YarioClient("test_key", client=http)
    assert client.get_profile() == {"id": "partner_1", "name": "Demo"}


def test_stable_idempotency_key_across_retries(monkeypatch):
    keys = []

    def handler(request: httpx.Request) -> httpx.Response:
        keys.append(request.headers["idempotency-key"])
        if len(keys) == 1:
            return httpx.Response(503, json={"detail": "retry"})
        return httpx.Response(200, json={"id": "ticket_1", "status": "OPEN"})

    monkeypatch.setattr("yario_integration.client.time.sleep", lambda _: None)
    http = httpx.Client(base_url="https://example.test", transport=httpx.MockTransport(handler))
    client = YarioClient("test_key", attempts=2, client=http)
    client.create_ticket("installation/1", {"subject": "Help"}, "stable-key")
    assert keys == ["stable-key", "stable-key"]


def test_structured_api_error():
    transport = httpx.MockTransport(lambda _: httpx.Response(403, json={"detail": "Not allowed", "traceId": "trace_1"}))
    client = YarioClient("test_key", attempts=1, client=httpx.Client(base_url="https://example.test", transport=transport))
    with pytest.raises(YarioApiError) as raised:
        client.get_profile()
    assert raised.value.status == 403
    assert raised.value.trace_id == "trace_1"
    assert str(raised.value) == "Not allowed"


def test_transient_network_failure_is_retried(monkeypatch):
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise httpx.ConnectError("network unavailable", request=request)
        return httpx.Response(200, json={"id": "partner_1", "name": "Demo"})

    monkeypatch.setattr("yario_integration.client.time.sleep", lambda _: None)
    client = YarioClient("test_key", attempts=2, client=httpx.Client(base_url="https://example.test", transport=httpx.MockTransport(handler)))
    client.get_profile()
    assert calls == 2
