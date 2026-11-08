"""Client portal (EPIC 11): projects, tasks, files, deliverables, comments, support
tickets and messages, in-app notifications.

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Short ticket references shown to people (#1001, #1002...).
    op.execute("CREATE SEQUENCE support_ticket_number_seq START WITH 1001")
    op.create_table(
        "notifications",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=40), nullable=False),
        sa.Column(
            "data", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column("for_staff", sa.Boolean(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "type IN ('project_created', 'task_client_review', 'deliverable_submitted', 'document_shared', 'ticket_replied', 'ticket_status', 'deliverable_reviewed', 'document_uploaded', 'ticket_opened', 'ticket_message', 'comment_added')",
            name=op.f("ck_notifications_type"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_notifications_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_notifications_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
    )
    op.create_index(
        op.f("ix_notifications_organization_id"), "notifications", ["organization_id"], unique=False
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(
        "ix_notifications_user_read",
        "notifications",
        ["user_id", "read_at", "created_at"],
        unique=False,
    )
    op.create_table(
        "portal_projects",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="planned", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("manager_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled')",
            name=op.f("ck_portal_projects_status"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_portal_projects_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["manager_id"],
            ["users.id"],
            name=op.f("fk_portal_projects_manager_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_portal_projects_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portal_projects")),
    )
    op.create_index(
        "ix_portal_projects_org_status",
        "portal_projects",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_portal_projects_organization_id"),
        "portal_projects",
        ["organization_id"],
        unique=False,
    )
    op.create_table(
        "portal_comments",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("from_staff", sa.Boolean(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "target_type IN ('task', 'deliverable')", name=op.f("ck_portal_comments_target_type")
        ),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name=op.f("fk_portal_comments_author_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_portal_comments_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["portal_projects.id"],
            name=op.f("fk_portal_comments_project_id_portal_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portal_comments")),
    )
    op.create_index(
        op.f("ix_portal_comments_organization_id"),
        "portal_comments",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_portal_comments_target",
        "portal_comments",
        ["target_type", "target_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "portal_files",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("storage_key", sa.String(length=200), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=True),
        sa.Column("uploaded_by_staff", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "purpose IN ('document', 'deliverable')", name=op.f("ck_portal_files_purpose")
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_portal_files_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["portal_projects.id"],
            name=op.f("fk_portal_files_project_id_portal_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by_id"],
            ["users.id"],
            name=op.f("fk_portal_files_uploaded_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portal_files")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_portal_files_storage_key")),
    )
    op.create_index(
        "ix_portal_files_org_purpose", "portal_files", ["organization_id", "purpose"], unique=False
    )
    op.create_index(
        op.f("ix_portal_files_organization_id"), "portal_files", ["organization_id"], unique=False
    )
    op.create_index(
        op.f("ix_portal_files_project_id"), "portal_files", ["project_id"], unique=False
    )
    op.create_table(
        "portal_tasks",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="todo", nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('todo', 'in_progress', 'client_review', 'done')",
            name=op.f("ck_portal_tasks_status"),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_portal_tasks_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_portal_tasks_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["portal_projects.id"],
            name=op.f("fk_portal_tasks_project_id_portal_projects"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portal_tasks")),
    )
    op.create_index(
        op.f("ix_portal_tasks_organization_id"), "portal_tasks", ["organization_id"], unique=False
    )
    op.create_index(
        "ix_portal_tasks_project_status", "portal_tasks", ["project_id", "status"], unique=False
    )
    op.create_table(
        "support_tickets",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column(
            "number",
            sa.BigInteger(),
            server_default=sa.text("nextval('support_ticket_number_seq')"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=10), server_default="normal", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("assignee_id", sa.Uuid(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "category IN ('question', 'incident', 'change_request', 'billing', 'other')",
            name=op.f("ck_support_tickets_category"),
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high', 'urgent')",
            name=op.f("ck_support_tickets_priority"),
        ),
        sa.CheckConstraint(
            "status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')",
            name=op.f("ck_support_tickets_status"),
        ),
        sa.ForeignKeyConstraint(
            ["assignee_id"],
            ["users.id"],
            name=op.f("fk_support_tickets_assignee_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_support_tickets_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_support_tickets_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["portal_projects.id"],
            name=op.f("fk_support_tickets_project_id_portal_projects"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_tickets")),
        sa.UniqueConstraint("number", name=op.f("uq_support_tickets_number")),
    )
    op.create_index(
        "ix_support_tickets_org_status",
        "support_tickets",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_support_tickets_organization_id"),
        "support_tickets",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_support_tickets_status_last",
        "support_tickets",
        ["status", "last_message_at"],
        unique=False,
    )
    op.create_table(
        "portal_deliverables",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending_review", nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=True),
        sa.Column("submitted_by_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_by_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('pending_review', 'approved', 'changes_requested')",
            name=op.f("ck_portal_deliverables_status"),
        ),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["portal_files.id"],
            name=op.f("fk_portal_deliverables_file_id_portal_files"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_portal_deliverables_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["portal_projects.id"],
            name=op.f("fk_portal_deliverables_project_id_portal_projects"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_id"],
            ["users.id"],
            name=op.f("fk_portal_deliverables_reviewed_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["submitted_by_id"],
            ["users.id"],
            name=op.f("fk_portal_deliverables_submitted_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_portal_deliverables")),
    )
    op.create_index(
        "ix_portal_deliverables_org_status",
        "portal_deliverables",
        ["organization_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_portal_deliverables_organization_id"),
        "portal_deliverables",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_portal_deliverables_project_id"),
        "portal_deliverables",
        ["project_id"],
        unique=False,
    )
    op.create_table(
        "support_messages",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("ticket_id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("from_staff", sa.Boolean(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            name=op.f("fk_support_messages_author_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_support_messages_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["support_tickets.id"],
            name=op.f("fk_support_messages_ticket_id_support_tickets"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_messages")),
    )
    op.create_index(
        op.f("ix_support_messages_organization_id"),
        "support_messages",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_support_messages_ticket", "support_messages", ["ticket_id", "created_at"], unique=False
    )
    op.execute("ALTER SEQUENCE support_ticket_number_seq OWNED BY support_tickets.number")


def downgrade() -> None:
    op.drop_index("ix_support_messages_ticket", table_name="support_messages")
    op.drop_index(op.f("ix_support_messages_organization_id"), table_name="support_messages")
    op.drop_table("support_messages")
    op.drop_index(op.f("ix_portal_deliverables_project_id"), table_name="portal_deliverables")
    op.drop_index(op.f("ix_portal_deliverables_organization_id"), table_name="portal_deliverables")
    op.drop_index("ix_portal_deliverables_org_status", table_name="portal_deliverables")
    op.drop_table("portal_deliverables")
    op.drop_index("ix_support_tickets_status_last", table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_organization_id"), table_name="support_tickets")
    op.drop_index("ix_support_tickets_org_status", table_name="support_tickets")
    op.drop_table("support_tickets")
    op.drop_index("ix_portal_tasks_project_status", table_name="portal_tasks")
    op.drop_index(op.f("ix_portal_tasks_organization_id"), table_name="portal_tasks")
    op.drop_table("portal_tasks")
    op.drop_index(op.f("ix_portal_files_project_id"), table_name="portal_files")
    op.drop_index(op.f("ix_portal_files_organization_id"), table_name="portal_files")
    op.drop_index("ix_portal_files_org_purpose", table_name="portal_files")
    op.drop_table("portal_files")
    op.drop_index("ix_portal_comments_target", table_name="portal_comments")
    op.drop_index(op.f("ix_portal_comments_organization_id"), table_name="portal_comments")
    op.drop_table("portal_comments")
    op.drop_index(op.f("ix_portal_projects_organization_id"), table_name="portal_projects")
    op.drop_index("ix_portal_projects_org_status", table_name="portal_projects")
    op.drop_table("portal_projects")
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_organization_id"), table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP SEQUENCE IF EXISTS support_ticket_number_seq")
