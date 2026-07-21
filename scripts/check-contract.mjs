import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const path = new URL("../contract/integration-api.openapi.yaml", import.meta.url);
const sumsPath = new URL("../contract/SHA256SUMS", import.meta.url);
const contract = await readFile(path);
const sums = await readFile(sumsPath, "utf8");
const expected = sums.trim().split(/\s+/)[0];
const actual = createHash("sha256").update(contract).digest("hex");
if (actual !== expected) throw new Error(`Contract digest mismatch: expected ${expected}, got ${actual}`);

const text = contract.toString("utf8");
for (const operation of [
  "getIntegrationProfile", "listInstallations", "resetTestData", "createTicket", "getTicket", "updateTicket",
  "listTicketMessages", "createTicketMessage", "listMerchantOnboardingApplications", "getMerchantOnboardingApplication",
  "updateMerchantOnboardingApplication", "receiveYarioIntegrationEvent",
]) {
  if (!text.includes(`operationId: ${operation}`)) throw new Error(`Missing operationId: ${operation}`);
}
for (const header of ["Api-Key", "Idempotency-Key", "X-Yario-Event-Id", "X-Yario-Timestamp", "X-Yario-Signature"]) {
  if (!text.includes(header)) throw new Error(`Missing contract header: ${header}`);
}
if (!/IntegrationEvent:[\s\S]*required: \[eventId, type, createdAt, installationId, data\]/.test(text)) {
  throw new Error("IntegrationEvent schema no longer matches the SDK webhook model");
}
console.log(`Contract verified: ${actual}`);
