from typing import Any, Dict, List, Literal, Optional, TypedDict

JsonObject = Dict[str, Any]
Environment = Literal["test", "live"]
Scope = Literal["tickets:read", "tickets:write", "messages:read", "messages:write", "merchant_onboarding:read", "merchant_onboarding:write"]
Capability = Literal["tickets", "merchant_onboarding"]
TicketStatus = Literal["InProgress", "WaitingForClient", "WaitingForManager", "Closed"]
TicketPriority = Literal["Regular", "Sticky", "Emergency"]
MerchantOnboardingStatus = Literal["Submitted", "UnderReview", "InformationRequired", "Approved", "Rejected"]
MerchantOnboardingDecisionStatus = Literal["UnderReview", "InformationRequired", "Approved", "Rejected"]


class IntegrationProfile(TypedDict):
    appId: str
    appSlug: str
    appName: str
    environment: Environment
    scopes: List[Scope]


class Installation(TypedDict, total=False):
    id: str
    name: str
    externalReference: Optional[str]
    capabilities: List[Capability]
    testClientId: Optional[str]


class Ticket(TypedDict, total=False):
    id: str
    installationId: str
    clientId: str
    summary: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    createdAt: str
    updatedAt: Optional[str]


class Message(TypedDict, total=False):
    id: str
    ticketId: str
    content: str
    author: Literal["partner", "yario"]
    attachments: List[JsonObject]
    createdAt: str


class MerchantOnboardingApplication(TypedDict, total=False):
    id: str
    installationId: str
    externalReference: str
    status: MerchantOnboardingStatus
    snapshot: JsonObject
    review: Optional[JsonObject]
    createdAt: str
    updatedAt: Optional[str]


class IntegrationEvent(TypedDict):
    eventId: str
    type: str
    createdAt: str
    installationId: str
    data: JsonObject

