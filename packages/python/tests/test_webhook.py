import json

import pytest

from yario_integration import YarioWebhookError, sign_webhook, verify_webhook

SECRET = "whsec_test"
TIMESTAMP = "1710000000"
RAW_BODY = json.dumps({"eventId": "evt_1", "type": "ticket.updated", "createdAt": "2026-01-01T00:00:00Z", "installationId": "installation_1", "data": {}}, separators=(",", ":"))
HEADERS = {
    "X-Yario-Event-Id": "evt_1",
    "X-Yario-Timestamp": TIMESTAMP,
    "X-Yario-Signature": sign_webhook(SECRET, TIMESTAMP, RAW_BODY),
}


def test_verified_and_claimed():
    claimed = []
    event = verify_webhook(SECRET, RAW_BODY, HEADERS, now_seconds=int(TIMESTAMP), claim=lambda event_id: not claimed.append(event_id))
    assert event["type"] == "ticket.updated"
    assert claimed == ["evt_1"]


@pytest.mark.parametrize(
    ("body", "now", "claim", "code"),
    [
        (RAW_BODY, int(TIMESTAMP) + 301, None, "stale_timestamp"),
        (RAW_BODY + " ", int(TIMESTAMP), None, "invalid_signature"),
        (RAW_BODY, int(TIMESTAMP), lambda _: False, "duplicate_event"),
    ],
)
def test_rejected_events(body, now, claim, code):
    with pytest.raises(YarioWebhookError) as raised:
        verify_webhook(SECRET, body, HEADERS, now_seconds=now, claim=claim)
    assert raised.value.code == code
