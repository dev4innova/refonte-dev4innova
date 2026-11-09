import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

ProductKind = Literal["service", "subscription", "course"]
Interval = Literal["month", "year"]
QuoteStatus = Literal["draft", "sent", "accepted", "declined", "cancelled"]
InvoiceKind = Literal["invoice", "credit_note"]
InvoiceStatus = Literal["issued", "paid", "cancelled"]
InvoicePurpose = Literal["deposit", "balance", "full", "subscription", "course", "credit"]
SubscriptionStatus = Literal["incomplete", "active", "past_due", "cancelled"]
Locale = Literal["fr", "en"]

Text = Annotated[str, StringConstraints(strip_whitespace=True)]
CODE_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]{1,59}$"


class BillingTexts(BaseModel):
    fr: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""
    en: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""


class BillingOrganization(BaseModel):
    id: uuid.UUID
    name: str
    slug: str


# --- Catalog (TASK-110) ------------------------------------------------------------------


class ProductIn(BaseModel):
    code: Annotated[
        str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=CODE_PATTERN)
    ]
    kind: ProductKind
    name: BillingTexts
    description: BillingTexts = Field(default_factory=BillingTexts)
    unit_price_cents: int = Field(ge=0, le=100_000_000)
    vat_rate_bp: int = Field(default=2000, ge=0, le=10_000)
    interval: Interval | None = None
    course_id: uuid.UUID | None = None
    active: bool = True

    @model_validator(mode="after")
    def _consistent(self) -> "ProductIn":
        if not self.name.fr or not self.name.en:
            raise ValueError("The name is required in French and English")
        if (self.kind == "subscription") != (self.interval is not None):
            raise ValueError("A billing interval is required for subscriptions, and only for them")
        if (self.kind == "course") != (self.course_id is not None):
            raise ValueError("A course is required for course products, and only for them")
        if self.kind != "service" and self.unit_price_cents == 0:
            raise ValueError("Subscriptions and courses need a price")
        return self


class ProductOut(BaseModel):
    id: uuid.UUID
    code: str
    kind: ProductKind
    name: dict[str, str]
    description: dict[str, str]
    unit_price_cents: int
    vat_rate_bp: int
    gross_cents: int
    interval: Interval | None
    course_id: uuid.UUID | None
    course_slug: str | None
    active: bool


class Offer(BaseModel):
    """A product as a client sees it, in their language."""

    id: uuid.UUID
    kind: ProductKind
    name: str
    description: str
    unit_price_cents: int
    vat_rate_bp: int
    gross_cents: int
    interval: Interval | None


# --- Billing profile ---------------------------------------------------------------------


class ProfileIn(BaseModel):
    legal_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)
    ]
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=300)]
    postal_code: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=2, max_length=20)
    ]
    city: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    country: Annotated[
        str, StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Z]{2}$")
    ] = "FR"
    vat_number: (
        Annotated[
            str,
            StringConstraints(strip_whitespace=True, to_upper=True, pattern=r"^[A-Z0-9]{4,30}$"),
        ]
        | None
    ) = None
    siren: (
        Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{9}(\d{5})?$")] | None
    ) = None
    email: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320
        ),
    ]


class ProfileOut(ProfileIn):
    organization_id: uuid.UUID


# --- Quotes (TASK-111) -------------------------------------------------------------------


class LineIn(BaseModel):
    product_id: uuid.UUID | None = None
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=2, max_length=500)
    ]
    quantity: Decimal = Field(gt=0, le=100_000, max_digits=10, decimal_places=2)
    unit_price_cents: int = Field(ge=0, le=100_000_000)
    vat_rate_bp: int = Field(default=2000, ge=0, le=10_000)


class LineOut(BaseModel):
    description: str
    quantity: Decimal
    unit_price_cents: int
    vat_rate_bp: int
    net_cents: int
    vat_cents: int
    product_id: uuid.UUID | None = None


class QuoteIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)] = ""
    valid_until: date
    deposit_percent: int = Field(default=0, ge=0, le=100)
    opportunity_id: uuid.UUID | None = None
    lines: list[LineIn] = Field(min_length=1, max_length=100)


class QuoteCreate(QuoteIn):
    organization_id: uuid.UUID


class Acceptance(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    agree: Literal[True]


class Decline(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None


class InvoiceSummary(BaseModel):
    id: uuid.UUID
    number: str
    kind: InvoiceKind
    status: InvoiceStatus
    purpose: InvoicePurpose
    title: str
    organization: BillingOrganization
    issue_date: date
    due_date: date
    gross_cents: int
    paid_cents: int
    due_cents: int
    overdue: bool


class QuoteSummary(BaseModel):
    id: uuid.UUID
    number: str
    status: QuoteStatus
    title: str
    organization: BillingOrganization
    valid_until: date
    expired: bool
    gross_cents: int
    sent_at: datetime | None
    accepted_at: datetime | None


class QuoteOut(QuoteSummary):
    notes: str
    deposit_percent: int
    net_cents: int
    vat_cents: int
    lines: list[LineOut]
    acceptance_name: str | None
    declined_at: datetime | None
    decline_reason: str | None
    invoices: list[InvoiceSummary]
    remaining_to_invoice_cents: int
    opportunity_id: uuid.UUID | None


class QuotePage(BaseModel):
    items: list[QuoteSummary]
    total: int


# --- Invoices and payments (TASK-112, TASK-113, TASK-115) --------------------------------


class PaymentOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    invoice_number: str
    organization: BillingOrganization
    provider: Literal["stripe", "transfer"]
    provider_ref: str | None
    amount_cents: int
    received_at: datetime


class InvoiceOut(InvoiceSummary):
    net_cents: int
    vat_cents: int
    vat_breakdown: list[dict[str, int]]
    lines: list[LineOut]
    seller: dict[str, Any]
    customer: dict[str, Any]
    payments: list[PaymentOut]
    quote_number: str | None
    credited_invoice_number: str | None
    credit_note_number: str | None
    payment_reference: str
    can_pay_online: bool


class InvoicePage(BaseModel):
    items: list[InvoiceSummary]
    total: int


class TransferIn(BaseModel):
    amount_cents: int = Field(gt=0, le=1_000_000_000)
    received_on: date
    reference: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = (
        None
    )


class CreditNoteIn(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]


class CheckoutOut(BaseModel):
    url: str


class CourseCheckoutIn(BaseModel):
    organization_id: uuid.UUID | None = None
    """None: bought as an individual (a personal billing space is created if needed)."""
    locale: Locale = "fr"


class CourseOffer(Offer):
    course_slug: str
    billing_organizations: list[BillingOrganization]
    """Where the signed-in user may buy (owner or admin); empty when anonymous."""


# --- Subscriptions (TASK-114) ------------------------------------------------------------


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    organization: BillingOrganization
    offer: Offer
    status: SubscriptionStatus
    current_period_end: datetime | None
    cancel_at_period_end: bool
    created_at: datetime


class SubscribeIn(BaseModel):
    product_id: uuid.UUID
    locale: Locale = "fr"


class CancelIn(BaseModel):
    cancel: bool = True
    """False: resume a subscription whose cancellation was scheduled."""


# --- Overviews ---------------------------------------------------------------------------


class ClientBilling(BaseModel):
    profile: ProfileOut | None
    quotes: list[QuoteSummary]
    invoices: list[InvoiceSummary]
    subscriptions: list[SubscriptionOut]
    offers: list[Offer]
    due_cents: int
    online_payment: bool


class AdminBilling(BaseModel):
    receivable_cents: int
    overdue_cents: int
    overdue_invoices: int
    quotes_awaiting: int
    accepted_this_month_cents: int
    monthly_recurring_cents: int
    """Active subscriptions, as a monthly amount including VAT (yearly ones divided by 12)."""
    invoices: list[InvoiceSummary]
    quotes: list[QuoteSummary]
