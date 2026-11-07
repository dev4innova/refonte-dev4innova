"""AI Gateway: model registry, versioned prompts, usage log and quotas (EPIC 08).

Seeds the Claude models (official prices in USD per million tokens). OpenAI and Gemini
models are added by staff in the back office, with the identifiers and prices of the day.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-08
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (model_id, display name, input $/MTok, output $/MTok, options, default)
CLAUDE_MODELS = [
    (
        "claude-opus-5-5",
        "Claude Opus 5.5",
        "4",
        "20",
        {"effort": "medium", "fallbacks": "default"},
        True,
    ),
    (
        "claude-sonnet-5-5",
        "Claude Sonnet 5.5",
        "2",
        "10",
        {"effort": "medium", "fallbacks": "default"},
        False,
    ),
    ("claude-haiku-5-5", "Claude Haiku 5.5", "0.10", "0.50", {"effort": "low"}, False),
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "ai_models",
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("model_id", sa.String(length=120), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("input_price_usd_per_mtok", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("output_price_usd_per_mtok", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("context_window", sa.Integer(), nullable=False),
        sa.Column("max_output_tokens", sa.Integer(), nullable=False),
        sa.Column(
            "options", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column("is_enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
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
            "provider IN ('anthropic', 'openai', 'gemini', 'simulated')",
            name=op.f("ck_ai_models_provider"),
        ),
        sa.CheckConstraint(
            "input_price_usd_per_mtok >= 0 AND output_price_usd_per_mtok >= 0",
            name=op.f("ck_ai_models_prices"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_models")),
        sa.UniqueConstraint("provider", "model_id", name="uq_ai_models_provider_model_id"),
    )
    op.create_index(
        "uq_ai_models_default",
        "ai_models",
        ["is_default"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
    op.create_table(
        "ai_prompts",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=300), server_default="", nullable=False),
        sa.Column("active_version_id", sa.Uuid(), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_prompts")),
        sa.UniqueConstraint("key", name=op.f("uq_ai_prompts_key")),
    )
    op.create_table(
        "ai_prompt_versions",
        sa.Column("prompt_id", sa.Uuid(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("system", sa.Text(), nullable=False),
        sa.Column("template", sa.Text(), server_default="", nullable=False),
        sa.Column("model_id", sa.Uuid(), nullable=True),
        sa.Column("max_tokens", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(length=300), server_default="", nullable=False),
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
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_ai_prompt_versions_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["model_id"],
            ["ai_models.id"],
            name=op.f("fk_ai_prompt_versions_model_id_ai_models"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["prompt_id"],
            ["ai_prompts.id"],
            name=op.f("fk_ai_prompt_versions_prompt_id_ai_prompts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_prompt_versions")),
        sa.UniqueConstraint("prompt_id", "version", name="uq_ai_prompt_versions_prompt_id_version"),
    )
    op.create_index(
        op.f("ix_ai_prompt_versions_prompt_id"), "ai_prompt_versions", ["prompt_id"], unique=False
    )
    # Created after both tables: prompts and versions reference each other.
    op.create_foreign_key(
        op.f("fk_ai_prompts_active_version_id_ai_prompt_versions"),
        "ai_prompts",
        "ai_prompt_versions",
        ["active_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "ai_quotas",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("monthly_budget_eur", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("updated_by_id", sa.Uuid(), nullable=True),
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
        sa.CheckConstraint("monthly_budget_eur >= 0", name=op.f("ck_ai_quotas_budget")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_ai_quotas_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"],
            ["users.id"],
            name=op.f("fk_ai_quotas_updated_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("organization_id", name=op.f("pk_ai_quotas")),
    )
    op.create_table(
        "ai_usage",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("model_id", sa.Uuid(), nullable=True),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("served_model", sa.String(length=120), nullable=True),
        sa.Column("feature", sa.String(length=50), nullable=False),
        sa.Column("prompt_key", sa.String(length=100), nullable=True),
        sa.Column("prompt_version", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("input_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("output_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "cost_usd", sa.Numeric(precision=14, scale=6), server_default="0", nullable=False
        ),
        sa.Column(
            "cost_eur", sa.Numeric(precision=14, scale=6), server_default="0", nullable=False
        ),
        sa.Column("latency_ms", sa.Integer(), server_default="0", nullable=False),
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
        sa.CheckConstraint("status IN ('ok', 'refused', 'error')", name=op.f("ck_ai_usage_status")),
        sa.ForeignKeyConstraint(
            ["model_id"],
            ["ai_models.id"],
            name=op.f("fk_ai_usage_model_id_ai_models"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_ai_usage_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_ai_usage_user_id_users"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_usage")),
    )
    op.create_index(op.f("ix_ai_usage_model_id"), "ai_usage", ["model_id"], unique=False)
    op.create_index(
        "ix_ai_usage_org_created", "ai_usage", ["organization_id", "created_at"], unique=False
    )
    op.create_index(op.f("ix_ai_usage_user_id"), "ai_usage", ["user_id"], unique=False)
    models = sa.table(
        "ai_models",
        sa.column("id", sa.Uuid()),
        sa.column("provider", sa.String()),
        sa.column("model_id", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("input_price_usd_per_mtok", sa.Numeric()),
        sa.column("output_price_usd_per_mtok", sa.Numeric()),
        sa.column("context_window", sa.Integer()),
        sa.column("max_output_tokens", sa.Integer()),
        sa.column("options", postgresql.JSONB()),
        sa.column("is_enabled", sa.Boolean()),
        sa.column("is_default", sa.Boolean()),
    )
    op.bulk_insert(
        models,
        [
            {
                "id": uuid.uuid4(),
                "provider": "anthropic",
                "model_id": model_id,
                "display_name": name,
                "input_price_usd_per_mtok": input_price,
                "output_price_usd_per_mtok": output_price,
                "context_window": 1_000_000,
                "max_output_tokens": 16_000,
                "options": options,
                "is_enabled": True,
                "is_default": is_default,
            }
            for model_id, name, input_price, output_price, options, is_default in CLAUDE_MODELS
        ],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_ai_usage_user_id"), table_name="ai_usage")
    op.drop_index("ix_ai_usage_org_created", table_name="ai_usage")
    op.drop_index(op.f("ix_ai_usage_model_id"), table_name="ai_usage")
    op.drop_table("ai_usage")
    op.drop_table("ai_quotas")
    op.drop_constraint(
        op.f("fk_ai_prompts_active_version_id_ai_prompt_versions"), "ai_prompts", type_="foreignkey"
    )
    op.drop_index(op.f("ix_ai_prompt_versions_prompt_id"), table_name="ai_prompt_versions")
    op.drop_table("ai_prompt_versions")
    op.drop_table("ai_prompts")
    op.drop_index(
        "uq_ai_models_default", table_name="ai_models", postgresql_where=sa.text("is_default")
    )
    op.drop_table("ai_models")
