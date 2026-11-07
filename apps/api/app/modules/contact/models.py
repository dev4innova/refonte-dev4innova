"""Inbound contact requests from the public website (TASK-055, TASK-057).

Not tenant-scoped: these are leads addressed to DEV4INNOVA itself. The CRM (EPIC 07) will
turn them into prospects of the internal organization, which does not exist yet.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

TOPICS = ("project", "training", "partnership", "other")
STATUSES = ("new", "processed", "spam")


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class ContactRequest(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contact_requests"
    __table_args__ = (
        CheckConstraint(f"topic IN ({_in(TOPICS)})", name="topic"),
        CheckConstraint(f"status IN ({_in(STATUSES)})", name="status"),
        CheckConstraint("locale IN ('fr', 'en')", name="locale"),
    )

    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320), index=True)
    company: Mapped[str | None] = mapped_column(String(160))
    topic: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(Text)
    locale: Mapped[str] = mapped_column(String(2))
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    """When the person accepted the privacy notice (GDPR proof of consent)."""
    status: Mapped[str] = mapped_column(String(20), default="new", server_default="new")
