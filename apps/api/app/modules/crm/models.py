"""CRM models (TASK-067 to TASK-072).

Prospects (leads) are people or companies who contacted DEV4INNOVA or were entered by the
sales team; each can have several opportunities moving through the pipeline, a timeline
of activities and quote requests sent from the website. Every record belongs to an
organization (the internal DEV4INNOVA one), like every business record (ADR-0006).
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

LEAD_STATUSES = ("new", "contacted", "qualified", "customer", "unqualified")
OPEN_LEAD_STATUSES = ("new", "contacted", "qualified")
LEAD_SOURCES = ("contact_form", "quote_request", "diagnostic", "manual")
OPPORTUNITY_STAGES = ("qualification", "proposal", "negotiation", "won", "lost")
OPEN_STAGES = ("qualification", "proposal", "negotiation")
CLOSED_STAGES = ("won", "lost")
ACTIVITY_TYPES = (
    # Logged by the sales team
    "note",
    "call",
    "email",
    "meeting",
    # Logged automatically
    "contact_message",
    "quote_request",
    "diagnostic",
    "status_change",
    "stage_change",
    "assignment",
)
MANUAL_ACTIVITY_TYPES = ("note", "call", "email", "meeting")
QUOTE_STATUSES = ("new", "in_review", "answered", "declined")
BUDGETS = ("lt_10k", "10k_30k", "30k_100k", "gt_100k", "unknown")
TIMELINES = ("asap", "within_3_months", "within_6_months", "unknown")
LOCALES = ("fr", "en")


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class Lead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "crm_leads"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(LEAD_STATUSES)})", name="status"),
        CheckConstraint(f"source IN ({_in(LEAD_SOURCES)})", name="source"),
        CheckConstraint(f"locale IN ({_in(LOCALES)})", name="locale"),
        UniqueConstraint("organization_id", "email", name="uq_crm_leads_organization_id_email"),
        Index("ix_crm_leads_org_status", "organization_id", "status"),
        Index("ix_crm_leads_org_owner", "organization_id", "owner_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(320))
    """Lower-cased: one prospect per address and organization."""
    name: Mapped[str] = mapped_column(String(120))
    company: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    locale: Mapped[str] = mapped_column(String(2), default="fr", server_default="fr")
    source: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="new", server_default="new")
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    """Sales person in charge (TASK-070)."""
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    opportunities: Mapped[list["Opportunity"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan", passive_deletes=True
    )


class Opportunity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "crm_opportunities"
    __table_args__ = (
        CheckConstraint(f"stage IN ({_in(OPPORTUNITY_STAGES)})", name="stage"),
        CheckConstraint("amount IS NULL OR amount >= 0", name="amount"),
        Index("ix_crm_opportunities_org_stage", "organization_id", "stage"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("crm_leads.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    stage: Mapped[str] = mapped_column(
        String(20), default="qualification", server_default="qualification"
    )
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3), default="EUR", server_default="EUR")
    expected_close_on: Mapped[date | None] = mapped_column(Date)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    lead: Mapped[Lead] = relationship(back_populates="opportunities")


class Activity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "crm_activities"
    __table_args__ = (
        CheckConstraint(f"type IN ({_in(ACTIVITY_TYPES)})", name="type"),
        Index("ix_crm_activities_org_lead_occurred", "organization_id", "lead_id", "occurred_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("crm_leads.id", ondelete="CASCADE"), index=True
    )
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("crm_opportunities.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[str] = mapped_column(String(20))
    body: Mapped[str] = mapped_column(Text, default="", server_default="")
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    """Machine-readable facts of automatic activities (old/new status, topic...)."""
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    """None for activities logged by the system (website forms)."""


class QuoteRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "crm_quote_requests"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(QUOTE_STATUSES)})", name="status"),
        CheckConstraint(f"budget IN ({_in(BUDGETS)})", name="budget"),
        CheckConstraint(f"timeline IN ({_in(TIMELINES)})", name="timeline"),
        CheckConstraint(f"locale IN ({_in(LOCALES)})", name="locale"),
        Index("ix_crm_quote_requests_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    lead_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("crm_leads.id", ondelete="CASCADE"), index=True
    )
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("crm_opportunities.id", ondelete="SET NULL"), index=True
    )
    service: Mapped[str | None] = mapped_column(String(120))
    """Slug of the service the request is about, if any."""
    need: Mapped[str] = mapped_column(Text)
    budget: Mapped[str] = mapped_column(String(20))
    timeline: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="new", server_default="new")
    locale: Mapped[str] = mapped_column(String(2))
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    """When the person accepted the privacy notice (GDPR proof of consent)."""

    lead: Mapped[Lead] = relationship()
