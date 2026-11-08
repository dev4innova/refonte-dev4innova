"""Client portal models (TASK-096 to TASK-102).

DEV4INNOVA staff run projects for a client organization: tasks, deliverables to review and
shared documents; clients open support tickets and receive in-app notifications. Every
record belongs to the client organization (ADR-0006): the client side always filters on
the organization of the context, the staff side on the organization of the project.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

PROJECT_STATUSES = ("planned", "in_progress", "on_hold", "completed", "cancelled")
ACTIVE_PROJECT_STATUSES = ("planned", "in_progress", "on_hold")
TASK_STATUSES = ("todo", "in_progress", "client_review", "done")
OPEN_TASK_STATUSES = ("todo", "in_progress", "client_review")
DELIVERABLE_STATUSES = ("pending_review", "approved", "changes_requested")
FILE_PURPOSES = ("document", "deliverable")
TICKET_CATEGORIES = ("question", "incident", "change_request", "billing", "other")
TICKET_PRIORITIES = ("low", "normal", "high", "urgent")
TICKET_STATUSES = ("open", "in_progress", "waiting_customer", "resolved", "closed")
OPEN_TICKET_STATUSES = ("open", "in_progress", "waiting_customer")
COMMENT_TARGETS = ("task", "deliverable")
NOTIFICATION_TYPES = (
    # To the client organization
    "project_created",
    "task_client_review",
    "deliverable_submitted",
    "document_shared",
    "ticket_replied",
    "ticket_status",
    # To the staff
    "deliverable_reviewed",
    "document_uploaded",
    "ticket_opened",
    "ticket_message",
    "comment_added",
)


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def _org_fk() -> Mapped[uuid.UUID]:
    return mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)


def _user_fk() -> Mapped[uuid.UUID | None]:
    return mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "portal_projects"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(PROJECT_STATUSES)})", name="status"),
        Index("ix_portal_projects_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    """The client organization."""
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    status: Mapped[str] = mapped_column(String(20), default="planned", server_default="planned")
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    manager_id: Mapped[uuid.UUID | None] = _user_fk()
    """DEV4INNOVA project manager, shown to the client."""
    created_by_id: Mapped[uuid.UUID | None] = _user_fk()


class Task(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "portal_tasks"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(TASK_STATUSES)})", name="status"),
        Index("ix_portal_tasks_project_status", "project_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("portal_projects.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    status: Mapped[str] = mapped_column(String(20), default="todo", server_default="todo")
    due_date: Mapped[date | None] = mapped_column(Date)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_by_id: Mapped[uuid.UUID | None] = _user_fk()


class StoredFile(UUIDPrimaryKeyMixin, Base):
    """A file in the private bucket: a shared document or the file of a deliverable."""

    __tablename__ = "portal_files"
    __table_args__ = (
        CheckConstraint(f"purpose IN ({_in(FILE_PURPOSES)})", name="purpose"),
        Index("ix_portal_files_org_purpose", "organization_id", "purpose"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("portal_projects.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200))
    """Sanitized original name, used for the download."""
    storage_key: Mapped[str] = mapped_column(String(200), unique=True)
    content_type: Mapped[str] = mapped_column(String(100))
    """Detected from the content, never taken from the upload."""
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    uploaded_by_id: Mapped[uuid.UUID | None] = _user_fk()
    uploaded_by_staff: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Deliverable(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "portal_deliverables"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(DELIVERABLE_STATUSES)})", name="status"),
        Index("ix_portal_deliverables_org_status", "organization_id", "status"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("portal_projects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    """Incremented each time a new file is submitted after a change request."""
    status: Mapped[str] = mapped_column(
        String(20), default="pending_review", server_default="pending_review"
    )
    file_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("portal_files.id", ondelete="SET NULL")
    )
    submitted_by_id: Mapped[uuid.UUID | None] = _user_fk()
    reviewed_by_id: Mapped[uuid.UUID | None] = _user_fk()
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_comment: Mapped[str | None] = mapped_column(Text)


class Comment(UUIDPrimaryKeyMixin, Base):
    """Discussion on a task or a deliverable, between the client and the team."""

    __tablename__ = "portal_comments"
    __table_args__ = (
        CheckConstraint(f"target_type IN ({_in(COMMENT_TARGETS)})", name="target_type"),
        Index("ix_portal_comments_target", "target_type", "target_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = _org_fk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("portal_projects.id", ondelete="CASCADE")
    )
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[uuid.UUID]
    author_id: Mapped[uuid.UUID | None] = _user_fk()
    from_staff: Mapped[bool] = mapped_column(Boolean)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Ticket(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint(f"category IN ({_in(TICKET_CATEGORIES)})", name="category"),
        CheckConstraint(f"priority IN ({_in(TICKET_PRIORITIES)})", name="priority"),
        CheckConstraint(f"status IN ({_in(TICKET_STATUSES)})", name="status"),
        Index("ix_support_tickets_org_status", "organization_id", "status"),
        Index("ix_support_tickets_status_last", "status", "last_message_at"),
    )

    __mapper_args__ = {"eager_defaults": True}  # noqa: RUF012 (SQLAlchemy configuration)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    number: Mapped[int] = mapped_column(
        BigInteger, server_default=text("nextval('support_ticket_number_seq')"), unique=True
    )
    """Short reference shown to people (#1042), from a sequence."""
    subject: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(20))
    priority: Mapped[str] = mapped_column(String(10), default="normal", server_default="normal")
    status: Mapped[str] = mapped_column(String(20), default="open", server_default="open")
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("portal_projects.id", ondelete="SET NULL")
    )
    created_by_id: Mapped[uuid.UUID | None] = _user_fk()
    assignee_id: Mapped[uuid.UUID | None] = _user_fk()
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TicketMessage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "support_messages"
    __table_args__ = (Index("ix_support_messages_ticket", "ticket_id", "created_at"),)

    organization_id: Mapped[uuid.UUID] = _org_fk()
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("support_tickets.id", ondelete="CASCADE")
    )
    author_id: Mapped[uuid.UUID | None] = _user_fk()
    from_staff: Mapped[bool] = mapped_column(Boolean)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Notification(UUIDPrimaryKeyMixin, Base):
    """In-app notification for one user (TASK-102). The text is built by the web app from
    `type` and `data` (FR/EN); `data` only holds identifiers and short labels."""

    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(f"type IN ({_in(NOTIFICATION_TYPES)})", name="type"),
        Index("ix_notifications_user_read", "user_id", "read_at", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    organization_id: Mapped[uuid.UUID] = _org_fk()
    """The client organization the notification is about."""
    type: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    for_staff: Mapped[bool] = mapped_column(Boolean)
    """Links to the back office rather than to the portal."""
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
