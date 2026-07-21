# Security

Report vulnerabilities privately to security@yario.ai. Do not open a public issue containing an API key, webhook secret, customer data or exploit details.

The SDKs never log credentials. Mutation requests carry an `Idempotency-Key`. Retries are bounded and limited to transient HTTP failures. Webhook verification uses the exact raw body, a bounded timestamp window, constant-time signature comparison and an optional atomic event-ID claim callback.

Supported releases are the latest published major version. Rotate any credential that may have been exposed before reporting it.

