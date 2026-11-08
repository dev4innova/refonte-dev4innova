"""AI business diagnostics (EPIC 10).

Answered anonymously on the public website; the respondent reaches the result through a
secret link (only its SHA-256 hash is stored). Leaving an email unlocks the full report and
links the diagnostic to a CRM prospect of the internal organization (TASK-095).
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

LEVELS = ("discovery", "experimentation", "structuring", "transformation")
AI_STATUSES = ("none", "pending", "done", "error")


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class Diagnostic(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "diagnostics"
    __table_args__ = (
        CheckConstraint(f"level IN ({_in(LEVELS)})", name="level"),
        CheckConstraint(f"ai_status IN ({_in(AI_STATUSES)})", name="ai_status"),
        CheckConstraint("locale IN ('fr', 'en')", name="locale"),
        CheckConstraint("overall_score BETWEEN 0 AND 100", name="overall_score"),
        Index("ix_diagnostics_org_created", "organization_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    """SHA-256 of the secret link token; the token itself is never stored."""
    questionnaire_version: Mapped[str] = mapped_column(String(20))
    locale: Mapped[str] = mapped_column(String(2))
    answers: Mapped[dict[str, str]] = mapped_column(JSONB)
    profile: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict, server_default="{}")
    scores: Mapped[dict[str, int]] = mapped_column(JSONB)
    overall_score: Mapped[int] = mapped_column(Integer)
    level: Mapped[str] = mapped_column(String(20))
    contact_name: Mapped[str | None] = mapped_column(String(120))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    contact_company: Mapped[str | None] = mapped_column(String(160))
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unlocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("crm_leads.id", ondelete="SET NULL"), index=True
    )
    ai_status: Mapped[str] = mapped_column(String(20), default="none", server_default="none")
    ai_analysis: Mapped[str | None] = mapped_column(Text)
    ai_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extra: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
