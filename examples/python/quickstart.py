import os
import uuid

from yario_integration import YarioClient


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


with YarioClient(api_key=required("YARIO_API_KEY")) as yario:
    profile = yario.get_profile()
    if profile["environment"] != "test":
        raise RuntimeError("This quickstart accepts a test key only")

    installation_id = required("YARIO_INSTALLATION_ID")
    test_client_id = required("YARIO_TEST_CLIENT_ID")
    installation = next((item for item in yario.list_installations() if item["id"] == installation_id), None)
    if installation is None:
        raise RuntimeError("YARIO_INSTALLATION_ID is not available to this key")

    ticket = yario.create_ticket(
        installation_id,
        {
            "clientId": test_client_id,
            "summary": "SDK quickstart",
            "description": "Synthetic test data only",
            "externalReference": f"quickstart-{uuid.uuid4()}",
        },
    )
    yario.create_message(ticket["id"], {"content": "Hello from the Python SDK"})
    print({"environment": profile["environment"], "ticketId": ticket["id"]})

