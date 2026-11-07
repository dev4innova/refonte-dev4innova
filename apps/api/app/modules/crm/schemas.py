import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

LeadStatus = Literal["new", "contacted", "qualified", "customer", "unqualified"]
LeadSource = Literal["contact_form", "quote_request", "manual"]
Stage = Literal["qualification", "proposal", "negotiation", "won", "lost"]
ActivityType = Literal[
    "note",
    "call",
    "email",
    "meeting",
    "contact_message",
    "quote_request",
    "status_change",
    "stage_change",
    "assignment",
]
ManualActivityType = Literal["note", "call", "email", "meeting"]
QuoteStatus = Literal["new", "in_review", "answered", "declined"]
Budget = Literal["lt_10k", "10k_30k", "30k_100k", "gt_100k", "unknown"]
Timeline = Literal["asap", "within_3_months", "within_6_months", "unknown"]
Locale = Literal["fr", "en"]
Currency = Literal["EUR"]
"""Single currency for now: the dashboard sums amounts (multi-currency with billing)."""
OwnerFilter = Literal["me", "unassigned", "any"]

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


def _strip(value: str | None) -> str | None:
    if not isinstance(value, str):
        return value
    return value.strip() or None


class Person(BaseModel):
    """A staff member, as shown next to the records they own or wrote."""

    id: uuid.UUID
    display_name: str | None
    email: str | None


# --- Prospects (TASK-067, TASK-070) ------------------------------------------------


class LeadCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=120)
    company: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    locale: Locale = "fr"

    @field_validator("name", "company", "phone", mode="before")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return _strip(value)


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    company: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    locale: Locale | None = None
    status: LeadStatus | None = None

    @field_validator("name", "company", "phone", mode="before")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return _strip(value)


class OwnerUpdate(BaseModel):
    owner_id: uuid.UUID | None
    """None removes the assignment."""


class LeadSummary(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    company: str | None
    status: LeadStatus
    source: LeadSource
    owner: Person | None
    last_activity_at: datetime
    created_at: datetime


class LeadPage(BaseModel):
    items: list[LeadSummary]
    total: int
    page: int
    page_size: int


class ActivityCreate(BaseModel):
    type: ManualActivityType
    body: str = Field(min_length=1, max_length=5000)
    occurred_at: datetime | None = None
    """Defaults to now; a call or meeting can be logged afterwards."""
    opportunity_id: uuid.UUID | None = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    type: ActivityType
    body: str
    details: dict[str, Any]
    occurred_at: datetime
    author: Person | None
    opportunity_id: uuid.UUID | None


class OpportunityCreate(BaseModel):
    lead_id: uuid.UUID
    title: str = Field(min_length=2, max_length=200)
    stage: Stage = "qualification"
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: Currency = "EUR"
    expected_close_on: date | None = None


class OpportunityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    stage: Stage | None = None
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    clear_amount: bool = False
    expected_close_on: date | None = None
    clear_expected_close_on: bool = False
    owner_id: uuid.UUID | None = None
    clear_owner: bool = False


class OpportunityOut(BaseModel):
    id: uuid.UUID
    lead: LeadSummary
    title: str
    stage: Stage
    amount: Decimal | None
    currency: Currency
    expected_close_on: date | None
    closed_at: datetime | None
    owner: Person | None
    updated_at: datetime


class QuoteRequestOut(BaseModel):
    id: uuid.UUID
    lead: LeadSummary
    opportunity_id: uuid.UUID | None
    service: str | None
    need: str
    budget: Budget
    timeline: Timeline
    status: QuoteStatus
    locale: Locale
    created_at: datetime


class QuoteRequestUpdate(BaseModel):
    status: QuoteStatus


class LeadDetail(LeadSummary):
    phone: str | None
    locale: Locale
    activities: list[ActivityOut]
    opportunities: list[OpportunityOut]
    quote_requests: list[QuoteRequestOut]


# --- Dashboard (TASK-071) ----------------------------------------------------------


class StageTotal(BaseModel):
    stage: Stage
    count: int
    amount: Decimal


class Dashboard(BaseModel):
    model_config = ConfigDict(json_schema_extra={"description": "Sales figures, in EUR"})

    leads_by_status: dict[str, int]
    new_leads_30_days: int
    leads_by_source_30_days: dict[str, int]
    unassigned_open_leads: int
    my_open_leads: int
    new_quote_requests: int
    pipeline: list[StageTotal]
    """Open stages only."""
    open_pipeline_amount: Decimal
    won_90_days: StageTotal
    lost_90_days: int
    win_rate_90_days: float | None
    """Won / (won + lost) over 90 days; None when nothing was closed."""


class Inbox(BaseModel):
    """What needs attention, for the back-office navigation badge."""

    new_leads: int
    new_quote_requests: int


# --- Public quote request form (TASK-072) ------------------------------------------


class QuoteRequestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    service: str | None = Field(default=None, max_length=120, pattern=SLUG_PATTERN)
    need: str = Field(min_length=20, max_length=5000)
    budget: Budget = "unknown"
    timeline: Timeline = "unknown"
    locale: Locale = "fr"
    consent: Literal[True]
    """The privacy notice must be accepted explicitly."""
    website: str = Field(default="", max_length=200)
    """Honeypot: hidden from people, filled in by naive bots. Must stay empty."""

    @field_validator("name", "company", "phone", "need")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class QuoteRequestAccepted(BaseModel):
    id: uuid.UUID | None
    """None when the request was silently discarded (spam)."""
