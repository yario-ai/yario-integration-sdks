import hashlib
import hmac
import json
import time
from typing import Callable, Mapping, Optional, Union

from .models import IntegrationEvent


class YarioWebhookError(Exception):
    def __init__(self, code: str):
        super().__init__(f"Yario webhook rejected: {code}")
        self.code = code


def sign_webhook(secret: str, timestamp: str, raw_body: Union[bytes, str]) -> str:
    body = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    digest = hmac.new(secret.encode("utf-8"), timestamp.encode("ascii") + b"." + body, hashlib.sha256).hexdigest()
    return f"v1={digest}"


def verify_webhook(
    secret: str,
    raw_body: Union[bytes, str],
    headers: Mapping[str, str],
    now_seconds: Optional[int] = None,
    tolerance_seconds: int = 300,
    claim: Optional[Callable[[str], bool]] = None,
) -> IntegrationEvent:
    normalized = {key.lower(): value for key, value in headers.items()}
    event_id = normalized.get("x-yario-event-id")
    timestamp = normalized.get("x-yario-timestamp")
    signature = normalized.get("x-yario-signature")
    if not event_id or not timestamp or not signature:
        raise YarioWebhookError("missing_headers")
    try:
        numeric_timestamp = int(timestamp)
    except ValueError as exc:
        raise YarioWebhookError("stale_timestamp") from exc
    if abs((now_seconds if now_seconds is not None else int(time.time())) - numeric_timestamp) > tolerance_seconds:
        raise YarioWebhookError("stale_timestamp")
    if not hmac.compare_digest(signature, sign_webhook(secret, timestamp, raw_body)):
        raise YarioWebhookError("invalid_signature")
    try:
        body = raw_body.decode("utf-8") if isinstance(raw_body, bytes) else raw_body
        event = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise YarioWebhookError("invalid_payload") from exc
    if not isinstance(event, dict) or event.get("eventId") != event_id:
        raise YarioWebhookError("event_id_mismatch")
    if claim is not None and not claim(event_id):
        raise YarioWebhookError("duplicate_event")
    return event
