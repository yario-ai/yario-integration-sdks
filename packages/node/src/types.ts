export type JsonObject = Record<string, unknown>;
export type Environment = "test" | "live";
export type Scope = "tickets:read" | "tickets:write" | "messages:read" | "messages:write" | "merchant_onboarding:read" | "merchant_onboarding:write";
export type Capability = "tickets" | "merchant_onboarding";
export type TicketStatus = "InProgress" | "WaitingForClient" | "WaitingForManager" | "Closed";
export type TicketPriority = "Regular" | "Sticky" | "Emergency";
export type MerchantOnboardingStatus = "Submitted" | "UnderReview" | "InformationRequired" | "Approved" | "Rejected";
export type MerchantOnboardingDecisionStatus = Exclude<MerchantOnboardingStatus, "Submitted">;

export interface IntegrationProfile { appId: string; appSlug: string; appName: string; environment: Environment; scopes: Scope[] }
export interface Installation { id: string; name: string; externalReference: string | null; capabilities: Capability[]; testClientId?: string | null }
export interface TestResetResult { installationId: string; testClientId: string; merchantApplicationId: string | null }
export interface Attachment { name?: string | null; mimeType?: string | null; url?: string | null; hash?: string | null }
export interface CreateTicketRequest { clientId: string; summary: string; description?: string; externalReference?: string | null; priority?: TicketPriority; attachments?: Attachment[] | null }
export interface UpdateTicketRequest { summary?: string | null; status?: TicketStatus | null; priority?: TicketPriority | null }
export interface Ticket { id: string; installationId: string; clientId: string; summary: string; description: string; status: TicketStatus; priority: TicketPriority; createdAt: string; updatedAt: string | null }
export interface CreateMessageRequest { content: string; attachments?: Attachment[] | null }
export interface Message { id: string; ticketId: string; content: string; author: "partner" | "yario"; attachments: Attachment[]; createdAt: string }
export interface MerchantOnboardingApplication { id: string; installationId: string; externalReference: string; status: MerchantOnboardingStatus; snapshot: JsonObject; review: JsonObject | null; createdAt: string; updatedAt: string | null }
export interface UpdateMerchantOnboardingRequest { status: MerchantOnboardingDecisionStatus; review?: JsonObject | null }
export interface IntegrationEvent<T = JsonObject> { eventId: string; type: string; createdAt: string; installationId: string; data: T }

