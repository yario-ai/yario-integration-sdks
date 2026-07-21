# Yario Integration SDKs

Official Node.js and Python clients for the Yario Partner Integration API. The SDKs cover partner identity, installations, support tickets, messages, merchant onboarding and signed webhooks.

Start with the [developer integration guide](https://docs.yario.ai/docs/developers/integrations), then use the [API reference](https://docs.yario.ai/api-reference/developers/integrations/api-reference) for the complete HTTP contract. A runnable payment integration is available in [yario-payment-partner-demo](https://github.com/yario-ai/yario-payment-partner-demo) and at [demo-partner.yario.ai](https://demo-partner.yario.ai/).

## Node.js

```bash
npm install @yario-ai/integration-sdk
```

```ts
import { YarioClient } from "@yario-ai/integration-sdk";

const yario = new YarioClient({
  apiKey: process.env.YARIO_API_KEY!,
  baseUrl: "https://integration-api.yario.ai"
});

const profile = await yario.getProfile();
const installations = await yario.listInstallations();
```

## Python

```bash
pip install yario-integration
```

```python
import os
from yario_integration import YarioClient

with YarioClient(
    api_key=os.environ["YARIO_API_KEY"],
    base_url="https://integration-api.yario.ai",
) as yario:
    profile = yario.get_profile()
    installations = yario.list_installations()
```

Never commit an API key or webhook secret. Demo credentials must only be used for the demo tenants assigned in Partner Portal.

## Webhooks

Always verify the signature against the exact raw request bytes before parsing JSON. Both SDKs validate the timestamp, HMAC signature and event ID. Provide an atomic `claim` callback backed by your database or cache to reject replayed event IDs across processes.

See the [Node example](examples/node/webhook.ts), [Python example](examples/python/webhook.py), and [webhook documentation](https://docs.yario.ai/docs/developers/integrations/webhooks).

## Development

The canonical contract is committed at [`contract/integration-api.openapi.yaml`](contract/integration-api.openapi.yaml). CI checks its SHA-256 digest against `contract/SHA256SUMS`, tests both SDKs, builds both release artifacts and installs them into clean smoke-test environments.

```bash
npm ci
npm run check
python3 -m venv .venv
. .venv/bin/activate
pip install -e 'packages/python[dev]'
pytest packages/python/tests
python -m build packages/python
```

Releases use npm and PyPI Trusted Publishing from GitHub Actions; no long-lived registry token is stored in the repository. See [SECURITY.md](SECURITY.md) for reporting and security guarantees.
