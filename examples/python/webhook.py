import os

from yario_integration import verify_webhook


def handle_yario_webhook(raw_body: bytes, headers: dict[str, str]):
    return verify_webhook(
        secret=os.environ["YARIO_WEBHOOK_SECRET"],
        raw_body=raw_body,
        headers=headers,
        # Replace with an atomic INSERT ... ON CONFLICT DO NOTHING or SET NX.
        claim=claim_event_in_database,
    )


def claim_event_in_database(event_id: str) -> bool:
    raise NotImplementedError

