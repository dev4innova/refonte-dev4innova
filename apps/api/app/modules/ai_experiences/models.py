"""AI experiences (EPIC 09): sessions and their messages (TASK-086, TASK-087).

A session belongs to an organization and is private to its author. Documents are not
kept: only their extracted text, for follow-up questions. Inactive sessions are purged
after the retention period (AI_SESSION_RETENTION_DAYS).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

KINDS = ("assistant", "document", "content")
ROLES = ("user", "assistant")
STATUSES = ("ok", "refused", "error", "incomplete")


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class AISession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_sessions"
    __table_args__ = (
        CheckConstraint(f"kind IN ({_in(KINDS)})", name="kind"),
        Index("ix_ai_sessions_org_user_activity", "organization_id", "user_id", "last_activity_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(200))
    document_name: Mapped[str | None] = mapped_column(String(255))
    document_text: Mapped[str | None] = mapped_column(Text)
    """Extracted text of the analyzed document; the file itself is never stored."""
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    """Content generator choices (format, tone, language, length)."""
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AIMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_messages"
    __table_args__ = (
        CheckConstraint(f"role IN ({_in(ROLES)})", name="role"),
        CheckConstraint(f"status IN ({_in(STATUSES)})", name="status"),
        Index("ix_ai_messages_session_created", "session_id", "created_at"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_sessions.id", ondelete="CASCADE"))
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    """Text sent to (or received from) the model."""
    display: Mapped[str | None] = mapped_column(Text)
    """What the user sees when it differs from `content` (e.g. generator choices)."""
    status: Mapped[str] = mapped_column(String(20), default="ok", server_default="ok")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    cost_eur: Mapped[Decimal] = mapped_column(
        Numeric(14, 6), default=Decimal(0), server_default="0"
    )
