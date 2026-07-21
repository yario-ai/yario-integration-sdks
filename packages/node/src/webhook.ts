import { createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationEvent } from "./types.js";

export interface WebhookHeaders {
  "x-yario-event-id"?: string;
  "x-yario-timestamp"?: string;
  "x-yario-signature"?: string;
}

export interface VerifyWebhookOptions {
  secret: string;
  rawBody: Uint8Array | string;
  headers: WebhookHeaders;
  nowSeconds?: number;
  toleranceSeconds?: number;
  claim?: (eventId: string) => boolean | Promise<boolean>;
}

export class YarioWebhookError extends Error {
  constructor(public readonly code: "missing_headers" | "stale_timestamp" | "invalid_signature" | "invalid_payload" | "event_id_mismatch" | "duplicate_event") {
    super(`Yario webhook rejected: ${code}`); this.name = "YarioWebhookError";
  }
}

export function signWebhook(secret: string, timestamp: string, rawBody: Uint8Array | string): string {
  return `v1=${createHmac("sha256", secret).update(timestamp).update(".").update(rawBody).digest("hex")}`;
}

export async function verifyWebhook<T = Record<string, unknown>>(options: VerifyWebhookOptions): Promise<IntegrationEvent<T>> {
  const eventId = options.headers["x-yario-event-id"];
  const timestamp = options.headers["x-yario-timestamp"];
  const signature = options.headers["x-yario-signature"];
  if (!eventId || !timestamp || !signature) throw new YarioWebhookError("missing_headers");
  const numericTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(numericTimestamp) || Math.abs((options.nowSeconds ?? Math.floor(Date.now() / 1000)) - numericTimestamp) > (options.toleranceSeconds ?? 300)) {
    throw new YarioWebhookError("stale_timestamp");
  }
  const expected = signWebhook(options.secret, timestamp, options.rawBody);
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (receivedBytes.length !== expectedBytes.length || !timingSafeEqual(receivedBytes, expectedBytes)) throw new YarioWebhookError("invalid_signature");
  let event: IntegrationEvent<T>;
  try { event = JSON.parse(Buffer.from(options.rawBody).toString("utf8")) as IntegrationEvent<T>; }
  catch { throw new YarioWebhookError("invalid_payload"); }
  if (!event || event.eventId !== eventId) throw new YarioWebhookError("event_id_mismatch");
  if (options.claim && !(await options.claim(eventId))) throw new YarioWebhookError("duplicate_event");
  return event;
}
