import { randomUUID } from "node:crypto";
import { YarioClient } from "@yario-ai/integration-sdk";

const yario = new YarioClient({ apiKey: required("YARIO_API_KEY") });
const installationId = required("YARIO_INSTALLATION_ID");
const testClientId = required("YARIO_TEST_CLIENT_ID");

const profile = await yario.getProfile();
if (profile.environment !== "test") throw new Error("This quickstart accepts a test key only");

const installation = (await yario.listInstallations()).find(item => item.id === installationId);
if (!installation) throw new Error("YARIO_INSTALLATION_ID is not available to this key");

const ticket = await yario.createTicket(installation.id, {
  clientId: testClientId,
  summary: "SDK quickstart",
  description: "Synthetic test data only",
  externalReference: `quickstart-${randomUUID()}`,
});

await yario.createMessage(ticket.id, { content: "Hello from the Node.js SDK" });
console.log(JSON.stringify({ environment: profile.environment, ticketId: ticket.id }));

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

