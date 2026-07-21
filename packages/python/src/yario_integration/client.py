import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

from .models import Installation, IntegrationProfile, MerchantOnboardingApplication, Message, Ticket

TRANSIENT_STATUSES = {408, 429, 500, 502, 503, 504}


class YarioApiError(Exception):
    def __init__(self, status: int, message: str, trace_id: Optional[str] = None, retry_after: Optional[str] = None):
        super().__init__(message)
        self.status = status
        self.trace_id = trace_id
        self.retry_after = retry_after


class YarioClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://integration-api.yario.ai",
        attempts: int = 3,
        timeout: float = 15.0,
        client: Optional[httpx.Client] = None,
    ):
        if not api_key.strip():
            raise ValueError("api_key is required")
        self._api_key = api_key
        self._attempts = max(1, attempts)
        self._owns_client = client is None
        self._client = client or httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout)

    def __enter__(self) -> "YarioClient":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def get_profile(self) -> IntegrationProfile:
        return self._request("GET", "/v1/me")

    def list_installations(self) -> List[Installation]:
        return self._request("GET", "/v1/installations")

    def reset_test_data(self, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        return self._request("POST", "/v1/test/reset", idempotency_key=idempotency_key)

    def create_ticket(self, installation_id: str, body: Dict[str, Any], idempotency_key: Optional[str] = None) -> Ticket:
        return self._request("POST", f"/v1/installations/{_quote(installation_id)}/tickets", body, idempotency_key)

    def get_ticket(self, ticket_id: str) -> Ticket:
        return self._request("GET", f"/v1/tickets/{_quote(ticket_id)}")

    def update_ticket(self, ticket_id: str, body: Dict[str, Any], idempotency_key: Optional[str] = None) -> Ticket:
        return self._request("PATCH", f"/v1/tickets/{_quote(ticket_id)}", body, idempotency_key)

    def list_messages(self, ticket_id: str) -> List[Message]:
        return self._request("GET", f"/v1/tickets/{_quote(ticket_id)}/messages")

    def create_message(self, ticket_id: str, body: Dict[str, Any], idempotency_key: Optional[str] = None) -> Message:
        return self._request("POST", f"/v1/tickets/{_quote(ticket_id)}/messages", body, idempotency_key)

    def list_merchant_onboarding_applications(self, installation_id: str) -> List[MerchantOnboardingApplication]:
        return self._request("GET", f"/v1/installations/{_quote(installation_id)}/merchant-onboarding/applications")

    def get_merchant_onboarding_application(self, installation_id: str, application_id: str) -> MerchantOnboardingApplication:
        return self._request("GET", f"/v1/installations/{_quote(installation_id)}/merchant-onboarding/applications/{_quote(application_id)}")

    def update_merchant_onboarding_application(self, installation_id: str, application_id: str, body: Dict[str, Any], idempotency_key: Optional[str] = None) -> MerchantOnboardingApplication:
        return self._request("PATCH", f"/v1/installations/{_quote(installation_id)}/merchant-onboarding/applications/{_quote(application_id)}", body, idempotency_key)

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None, idempotency_key: Optional[str] = None) -> Any:
        mutation = method not in {"GET", "HEAD"}
        stable_key = idempotency_key or (str(uuid.uuid4()) if mutation else None)
        response: Optional[httpx.Response] = None
        last_error: Optional[httpx.TransportError] = None
        for attempt in range(1, self._attempts + 1):
            headers = {"Api-Key": self._api_key, "Accept": "application/json"}
            if stable_key:
                headers["Idempotency-Key"] = stable_key
            try:
                response = self._client.request(method, path, json=body, headers=headers)
            except httpx.TransportError as error:
                last_error = error
                if attempt == self._attempts:
                    raise
                time.sleep(min(0.25 * (2 ** (attempt - 1)), 2.0))
                continue
            if response.is_success:
                return None if response.status_code == 204 else response.json()
            if response.status_code not in TRANSIENT_STATUSES or attempt == self._attempts:
                break
            time.sleep(_retry_delay(response, attempt))
        if response is None:
            if last_error is not None:
                raise last_error
            raise RuntimeError("Yario API request did not produce a response")
        try:
            problem = response.json()
        except ValueError:
            problem = {}
        message = problem.get("detail") or problem.get("title") or f"Yario API request failed with status {response.status_code}"
        raise YarioApiError(response.status_code, message, problem.get("traceId") or response.headers.get("x-trace-id"), response.headers.get("retry-after"))


def _quote(value: str) -> str:
    from urllib.parse import quote
    return quote(value, safe="")


def _retry_delay(response: httpx.Response, attempt: int) -> float:
    value = response.headers.get("retry-after")
    if value and value.isdigit():
        return min(float(value), 30.0)
    return min(0.25 * (2 ** (attempt - 1)), 2.0)
