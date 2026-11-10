"""Built-in accounts (ADR-0019): users sign in with email and password, sessions are
stored hashed. Replaces the external identity provider (Zitadel, ADR-0009).

- users: drop external_subject; email becomes required and unique; add password_hash
  and password_changed_at. Existing accounts keep their data but have no password: the
  team gives them a temporary one (python -m app.cli reset-password EMAIL).
- auth_sessions: one row per signed-in browser, keyed by the SHA-256 of its token.

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | Sequence[str] | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Accounts provisioned without an email cannot sign in: give them a unique placeholder
    # (visible to the team), and make duplicated emails unique (the oldest keeps it).
    op.execute("UPDATE users SET email = 'no-email-' || id || '@invalid.local' WHERE email IS NULL")
    op.execute(
        """
        UPDATE users AS u SET email = u.id || '+' || u.email
        WHERE EXISTS (
            SELECT 1 FROM users AS o
            WHERE o.email = u.email AND (o.created_at, o.id) < (u.created_at, u.id)
        )
        """
    )
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=False)
    op.create_unique_constraint(op.f("uq_users_email"), "users", ["email"])
    op.drop_constraint(op.f("uq_users_external_subject"), "users", type_="unique")
    op.drop_column("users", "external_subject")
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column(
        "users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        "auth_sessions",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_auth_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_auth_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_auth_sessions_token_hash")),
    )
    op.create_index(op.f("ix_auth_sessions_user_id"), "auth_sessions", ["user_id"])
    op.create_index(op.f("ix_auth_sessions_expires_at"), "auth_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_sessions_expires_at"), table_name="auth_sessions")
    op.drop_index(op.f("ix_auth_sessions_user_id"), table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "password_hash")
    # Accounts get a subject the identity provider will never issue: they must be linked
    # again by hand if the provider comes back.
    op.add_column("users", sa.Column("external_subject", sa.String(length=255), nullable=True))
    op.execute("UPDATE users SET external_subject = 'local:' || id")
    op.alter_column(
        "users", "external_subject", existing_type=sa.String(length=255), nullable=False
    )
    op.create_unique_constraint(op.f("uq_users_external_subject"), "users", ["external_subject"])
    op.drop_constraint(op.f("uq_users_email"), "users", type_="unique")
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
