"""Contact requests from the website form (EPIC 05, TASK-057).

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "contact_requests",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("company", sa.String(length=160), nullable=True),
        sa.Column("topic", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=2), nullable=False),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="new", nullable=False),
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
        sa.CheckConstraint("locale IN ('fr', 'en')", name=op.f("ck_contact_requests_locale")),
        sa.CheckConstraint(
            "status IN ('new', 'processed', 'spam')", name=op.f("ck_contact_requests_status")
        ),
        sa.CheckConstraint(
            "topic IN ('project', 'training', 'partnership', 'other')",
            name=op.f("ck_contact_requests_topic"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contact_requests")),
    )
    op.create_index(op.f("ix_contact_requests_email"), "contact_requests", ["email"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_contact_requests_email"), table_name="contact_requests")
    op.drop_table("contact_requests")
