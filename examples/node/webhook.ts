import { verifyWebhook } from "@yario-ai/integration-sdk";

// Express example. Configure express.raw({ type: "application/json" }) for this route.
export async function handleYarioWebhook(rawBody: Buffer, headers: Record<string, string | undefined>) {
  return verifyWebhook({
    secret: process.env.YARIO_WEBHOOK_SECRET!,
    rawBody,
    headers: {
      "x-yario-event-id": headers["x-yario-event-id"],
      "x-yario-timestamp": headers["x-yario-timestamp"],
      "x-yario-signature": headers["x-yario-signature"],
    },
    // Replace with an atomic INSERT ... ON CONFLICT DO NOTHING or SET NX.
    claim: async eventId => claimEventInDatabase(eventId),
  });
}

declare function claimEventInDatabase(eventId: string): Promise<boolean>;

