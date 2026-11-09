"""Commerce and billing models (TASK-110 to TASK-115).

The catalog belongs to the internal organization. Quotes, invoices, payments and
subscriptions belong to the client organization (ADR-0006). Amounts are integers in cents
(EUR); VAT rates in basis points (2000 = 20 %). An issued invoice never changes: it is
corrected by a credit note, and its customer, seller and lines are copied at issue.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

PRODUCT_KINDS = ("service", "subscription", "course")
INTERVALS = ("month", "year")
QUOTE_STATUSES = ("draft", "sent", "accepted", "declined", "cancelled")
INVOICE_KINDS = ("invoice", "credit_note")
INVOICE_STATUSES = ("issued", "paid", "cancelled")
"""cancelled: fully credited by a credit note (a credit note itself is "issued")."""
INVOICE_PURPOSES = ("deposit", "balance", "full", "subscription", "course", "credit")
PAYMENT_PROVIDERS = ("stripe", "transfer")
SUBSCRIPTION_STATUSES = ("incomplete", "active", "past_due", "cancelled")
CHECKOUT_PURPOSES = ("invoice", "subscription", "course")


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def _org() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("organizations.id", ondelete="RESTRICT"), index=True)


def _user() -> Mapped[uuid.UUID | None]:
    return mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Product(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_products"
    __table_args__ = (
        CheckConstraint(f"kind IN ({_in(PRODUCT_KINDS)})", name="kind"),
        CheckConstraint(f"interval IN ({_in(INTERVALS)})", name="interval"),
        CheckConstraint("(kind = 'subscription') = (interval IS NOT NULL)", name="interval_kind"),
        CheckConstraint("(kind = 'course') = (course_id IS NOT NULL)", name="course_kind"),
        CheckConstraint("unit_price_cents >= 0", name="price"),
        CheckConstraint("vat_rate_bp BETWEEN 0 AND 10000", name="vat"),
    )

    organization_id: Mapped[uuid.UUID] = _org()
    """The internal organization (DEV4INNOVA's catalog)."""
    code: Mapped[str] = mapped_column(String(60), unique=True)
    kind: Mapped[str] = mapped_column(String(20))
    name: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    description: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    unit_price_cents: Mapped[int] = mapped_column(BigInteger)
    """Price excluding VAT."""
    vat_rate_bp: Mapped[int] = mapped_column(Integer, default=2000, server_default="2000")
    interval: Mapped[str | None] = mapped_column(String(10))
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academy_courses.id", ondelete="SET NULL"), unique=True
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class BillingProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Billing details of a client organization, copied onto each invoice at issue."""

    __tablename__ = "billing_profiles"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), unique=True
    )
    legal_name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(String(300))
    postal_code: Mapped[str] = mapped_column(String(20))
    city: Mapped[str] = mapped_column(String(120))
    country: Mapped[str] = mapped_column(String(2), default="FR", server_default="FR")
    vat_number: Mapped[str | None] = mapped_column(String(30))
    siren: Mapped[str | None] = mapped_column(String(14))
    email: Mapped[str] = mapped_column(String(320))
    """Where invoices and receipts are sent (by Stripe for payments)."""
    stripe_customer_id: Mapped[str | None] = mapped_column(String(60))


class Quote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_quotes"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(QUOTE_STATUSES)})", name="status"),
        CheckConstraint("deposit_percent BETWEEN 0 AND 100", name="deposit"),
        Index("ix_billing_quotes_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = _org()
    number: Mapped[str] = mapped_column(String(20), unique=True)
    """D-2026-0001: continuous per year."""
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    valid_until: Mapped[date]
    deposit_percent: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    net_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    vat_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    gross_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("crm_opportunities.id", ondelete="SET NULL")
    )
    created_by_id: Mapped[uuid.UUID | None] = _user()
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    accepted_by_id: Mapped[uuid.UUID | None] = _user()
    acceptance_name: Mapped[str | None] = mapped_column(String(200))
    """Name typed by the client to accept ("bon pour accord")."""
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decline_reason: Mapped[str | None] = mapped_column(Text)


class QuoteLine(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "billing_quote_lines"
    __table_args__ = (Index("ix_billing_quote_lines_quote", "quote_id", "position"),)

    quote_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("billing_quotes.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("billing_products.id", ondelete="SET NULL")
    )
    description: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit_price_cents: Mapped[int] = mapped_column(BigInteger)
    vat_rate_bp: Mapped[int] = mapped_column(Integer)
    net_cents: Mapped[int] = mapped_column(BigInteger)
    vat_cents: Mapped[int] = mapped_column(BigInteger)


class Invoice(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_invoices"
    __table_args__ = (
        CheckConstraint(f"kind IN ({_in(INVOICE_KINDS)})", name="kind"),
        CheckConstraint(f"status IN ({_in(INVOICE_STATUSES)})", name="status"),
        CheckConstraint(f"purpose IN ({_in(INVOICE_PURPOSES)})", name="purpose"),
        Index("ix_billing_invoices_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = _org()
    number: Mapped[str] = mapped_column(String(20), unique=True)
    """F-2026-0001 (invoices) or A-2026-0001 (credit notes): continuous, without gaps."""
    kind: Mapped[str] = mapped_column(String(20), default="invoice", server_default="invoice")
    status: Mapped[str] = mapped_column(String(20), default="issued", server_default="issued")
    purpose: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    issue_date: Mapped[date]
    due_date: Mapped[date]
    seller: Mapped[dict[str, Any]] = mapped_column(JSONB)
    customer: Mapped[dict[str, Any]] = mapped_column(JSONB)
    net_cents: Mapped[int] = mapped_column(BigInteger)
    vat_cents: Mapped[int] = mapped_column(BigInteger)
    gross_cents: Mapped[int] = mapped_column(BigInteger)
    """Negative for a credit note."""
    paid_cents: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    quote_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("billing_quotes.id", ondelete="RESTRICT")
    )
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("billing_subscriptions.id", ondelete="RESTRICT")
    )
    credited_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("billing_invoices.id", ondelete="RESTRICT")
    )
    issued_by_id: Mapped[uuid.UUID | None] = _user()
    external_ref: Mapped[str | None] = mapped_column(String(80), unique=True)
    """Stripe invoice id for subscription periods: one invoice of ours per Stripe invoice."""


class InvoiceLine(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "billing_invoice_lines"
    __table_args__ = (Index("ix_billing_invoice_lines_invoice", "invoice_id", "position"),)

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billing_invoices.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    unit_price_cents: Mapped[int] = mapped_column(BigInteger)
    vat_rate_bp: Mapped[int] = mapped_column(Integer)
    net_cents: Mapped[int] = mapped_column(BigInteger)
    vat_cents: Mapped[int] = mapped_column(BigInteger)


class Payment(UUIDPrimaryKeyMixin, Base):
    """A transaction (TASK-115): a card or SEPA payment through Stripe, or a bank transfer
    recorded by the team."""

    __tablename__ = "billing_payments"
    __table_args__ = (
        CheckConstraint(f"provider IN ({_in(PAYMENT_PROVIDERS)})", name="provider"),
        CheckConstraint("amount_cents > 0", name="amount"),
        Index("ix_billing_payments_org", "organization_id", "received_at"),
    )

    organization_id: Mapped[uuid.UUID] = _org()
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billing_invoices.id", ondelete="RESTRICT"), index=True
    )
    provider: Mapped[str] = mapped_column(String(20))
    provider_ref: Mapped[str | None] = mapped_column(String(120), unique=True)
    """Stripe payment intent or invoice id; bank transfer reference."""
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recorded_by_id: Mapped[uuid.UUID | None] = _user()


class Subscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "billing_subscriptions"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(SUBSCRIPTION_STATUSES)})", name="status"),
        Index("ix_billing_subscriptions_org", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = _org()
    product_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("billing_products.id", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(
        String(20), default="incomplete", server_default="incomplete"
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(80), unique=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = _user()


class Checkout(UUIDPrimaryKeyMixin, Base):
    """A Stripe Checkout session we opened: what it pays for, who opened it."""

    __tablename__ = "billing_checkouts"
    __table_args__ = (CheckConstraint(f"purpose IN ({_in(CHECKOUT_PURPOSES)})", name="purpose"),)

    organization_id: Mapped[uuid.UUID] = _org()
    purpose: Mapped[str] = mapped_column(String(20))
    stripe_session_id: Mapped[str] = mapped_column(String(120), unique=True)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("billing_invoices.id", ondelete="CASCADE")
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("billing_products.id", ondelete="RESTRICT")
    )
    user_id: Mapped[uuid.UUID | None] = _user()
    amount_cents: Mapped[int] = mapped_column(BigInteger)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Counter(Base):
    """Last number used per series and year, read with a row lock: numbers never skip."""

    __tablename__ = "billing_counters"
    __table_args__ = (UniqueConstraint("series", "year", name="uq_billing_counters_series_year"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    series: Mapped[str] = mapped_column(String(2))
    year: Mapped[int] = mapped_column(Integer)
    value: Mapped[int] = mapped_column(Integer, default=0)


class StripeEvent(Base):
    """Webhook events already handled: Stripe may deliver an event more than once."""

    __tablename__ = "billing_stripe_events"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    type: Mapped[str] = mapped_column(String(80))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
