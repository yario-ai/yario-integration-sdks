import assert from "node:assert/strict";
import test from "node:test";
import { YarioApiError, YarioClient } from "../src/index.js";

test("adds authentication and no idempotency key to reads", async () => {
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), "https://example.test/v1/me");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("api-key"), "test_key");
    assert.equal(headers.get("idempotency-key"), null);
    return Response.json({ id: "partner_1", name: "Demo" });
  };
  const client = new YarioClient({ apiKey: "test_key", baseUrl: "https://example.test/", fetch });
  assert.deepEqual(await client.getProfile(), { id: "partner_1", name: "Demo" });
});

test("reuses a stable idempotency key across retries", async () => {
  const keys: string[] = [];
  let calls = 0;
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
    calls += 1;
    return calls === 1 ? Response.json({ detail: "retry" }, { status: 503 }) : Response.json({ id: "ticket_1", status: "OPEN" });
  };
  const client = new YarioClient({ apiKey: "test_key", baseUrl: "https://example.test", fetch, attempts: 2 });
  await client.createTicket("installation/1", { subject: "Help" }, { idempotencyKey: "stable-key" });
  assert.deepEqual(keys, ["stable-key", "stable-key"]);
});

test("throws a structured API error", async () => {
  const fetch = async () => Response.json({ detail: "Not allowed", traceId: "trace_1" }, { status: 403 });
  const client = new YarioClient({ apiKey: "test_key", fetch, attempts: 1 });
  await assert.rejects(client.getProfile(), (error: unknown) => {
    assert.ok(error instanceof YarioApiError);
    assert.equal(error.status, 403);
    assert.equal(error.traceId, "trace_1");
    assert.equal(error.message, "Not allowed");
    return true;
  });
});

test("retries a transient network failure", async () => {
  let calls = 0;
  const fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("network unavailable");
    return Response.json({ id: "partner_1", name: "Demo" });
  };
  const client = new YarioClient({ apiKey: "test_key", fetch, attempts: 2 });
  await client.getProfile();
  assert.equal(calls, 2);
});
