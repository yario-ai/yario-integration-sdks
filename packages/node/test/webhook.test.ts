import assert from "node:assert/strict";
import test from "node:test";
import { signWebhook, verifyWebhook, YarioWebhookError } from "../src/index.js";

const secret = "whsec_test";
const timestamp = "1710000000";
const rawBody = JSON.stringify({ eventId: "evt_1", type: "ticket.updated", createdAt: "2026-01-01T00:00:00Z", installationId: "installation_1", data: {} });
const headers = {
  "x-yario-event-id": "evt_1",
  "x-yario-timestamp": timestamp,
  "x-yario-signature": signWebhook(secret, timestamp, rawBody),
};

test("verifies a signed event and claims it", async () => {
  let claimed = "";
  const event = await verifyWebhook({ secret, rawBody, headers, nowSeconds: Number(timestamp), claim: id => { claimed = id; return true; } });
  assert.equal(event.type, "ticket.updated");
  assert.equal(claimed, "evt_1");
});

test("rejects stale, invalid and duplicate events", async () => {
  await assert.rejects(verifyWebhook({ secret, rawBody, headers, nowSeconds: Number(timestamp) + 301 }), (e: unknown) => e instanceof YarioWebhookError && e.code === "stale_timestamp");
  await assert.rejects(verifyWebhook({ secret, rawBody: `${rawBody} `, headers, nowSeconds: Number(timestamp) }), (e: unknown) => e instanceof YarioWebhookError && e.code === "invalid_signature");
  await assert.rejects(verifyWebhook({ secret, rawBody, headers, nowSeconds: Number(timestamp), claim: () => false }), (e: unknown) => e instanceof YarioWebhookError && e.code === "duplicate_event");
});
