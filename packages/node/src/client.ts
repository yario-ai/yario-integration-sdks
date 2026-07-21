import { randomUUID } from "node:crypto";
import type {
  CreateMessageRequest, CreateTicketRequest, Installation, IntegrationProfile,
  MerchantOnboardingApplication, Message, TestResetResult, Ticket,
  UpdateMerchantOnboardingRequest, UpdateTicketRequest
} from "./types.js";

const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);

export class YarioApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly traceId?: string,
    message = `Yario API request failed with status ${status}`,
    public readonly retryAfter?: string,
  ) { super(message); this.name = "YarioApiError"; }
}

export interface YarioClientOptions {
  apiKey: string;
  baseUrl?: string;
  attempts?: number;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface MutationOptions { idempotencyKey?: string }

export class YarioClient {
  private readonly baseUrl: string;
  private readonly attempts: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: YarioClientOptions) {
    if (!options.apiKey.trim()) throw new TypeError("apiKey is required");
    this.baseUrl = (options.baseUrl ?? "https://integration-api.yario.ai").replace(/\/$/, "");
    this.attempts = Math.max(1, options.attempts ?? 3);
    this.timeoutMs = Math.max(1, options.timeoutMs ?? 15_000);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  getProfile(): Promise<IntegrationProfile> { return this.request("GET", "/v1/me"); }
  listInstallations(): Promise<Installation[]> { return this.request("GET", "/v1/installations"); }
  resetTestData(options?: MutationOptions): Promise<TestResetResult> { return this.request("POST", "/v1/test/reset", undefined, options); }
  createTicket(installationId: string, body: CreateTicketRequest, options?: MutationOptions): Promise<Ticket> {
    return this.request("POST", `/v1/installations/${encodeURIComponent(installationId)}/tickets`, body, options);
  }
  getTicket(ticketId: string): Promise<Ticket> { return this.request("GET", `/v1/tickets/${encodeURIComponent(ticketId)}`); }
  updateTicket(ticketId: string, body: UpdateTicketRequest, options?: MutationOptions): Promise<Ticket> {
    return this.request("PATCH", `/v1/tickets/${encodeURIComponent(ticketId)}`, body, options);
  }
  listMessages(ticketId: string): Promise<Message[]> { return this.request("GET", `/v1/tickets/${encodeURIComponent(ticketId)}/messages`); }
  createMessage(ticketId: string, body: CreateMessageRequest, options?: MutationOptions): Promise<Message> {
    return this.request("POST", `/v1/tickets/${encodeURIComponent(ticketId)}/messages`, body, options);
  }
  listMerchantOnboardingApplications(installationId: string): Promise<MerchantOnboardingApplication[]> {
    return this.request("GET", `/v1/installations/${encodeURIComponent(installationId)}/merchant-onboarding/applications`);
  }
  getMerchantOnboardingApplication(installationId: string, applicationId: string): Promise<MerchantOnboardingApplication> {
    return this.request("GET", `/v1/installations/${encodeURIComponent(installationId)}/merchant-onboarding/applications/${encodeURIComponent(applicationId)}`);
  }
  updateMerchantOnboardingApplication(installationId: string, applicationId: string, body: UpdateMerchantOnboardingRequest, options?: MutationOptions): Promise<MerchantOnboardingApplication> {
    return this.request("PATCH", `/v1/installations/${encodeURIComponent(installationId)}/merchant-onboarding/applications/${encodeURIComponent(applicationId)}`, body, options);
  }

  private async request<T>(method: string, path: string, body?: unknown, mutationOptions?: MutationOptions): Promise<T> {
    const mutation = !["GET", "HEAD"].includes(method);
    const idempotencyKey = mutation ? (mutationOptions?.idempotencyKey ?? randomUUID()) : undefined;
    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = { "Api-Key": this.options.apiKey, Accept: "application/json" };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
        const init: RequestInit = { method, headers, signal: controller.signal };
        if (body !== undefined) init.body = JSON.stringify(body);
        response = await this.fetchImpl(`${this.baseUrl}${path}`, init);
      } catch (error) {
        lastError = error;
        if (attempt === this.attempts) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.min(250 * 2 ** (attempt - 1), 2_000)));
        continue;
      } finally { clearTimeout(timer); }
      const currentResponse = response;
      if (!currentResponse) continue;
      if (currentResponse.ok) return (currentResponse.status === 204 ? undefined : await currentResponse.json()) as T;
      if (!TRANSIENT.has(currentResponse.status) || attempt === this.attempts) break;
      await new Promise(resolve => setTimeout(resolve, retryDelay(currentResponse, attempt)));
    }
    if (!response) throw lastError ?? new Error("Yario API request did not produce a response");
    const problem = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new YarioApiError(
      response.status,
      typeof problem.traceId === "string" ? problem.traceId : response.headers.get("x-trace-id") ?? undefined,
      typeof problem.detail === "string" ? problem.detail : typeof problem.title === "string" ? problem.title : undefined,
      response.headers.get("retry-after") ?? undefined,
    );
  }
}

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value && /^\d+$/.test(value)) return Math.min(Number(value) * 1000, 30_000);
  return Math.min(250 * 2 ** (attempt - 1), 2_000);
}
