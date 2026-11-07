"""AI Gateway models (TASK-077, TASK-078, TASK-080, TASK-081).

The model registry and the prompts are platform reference data managed by DEV4INNOVA staff
(not tenant data). Usage records and quotas belong to an organization (ADR-0006).
"""

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

PROVIDERS = ("anthropic", "openai", "gemini", "simulated")
USAGE_STATUSES = ("ok", "refused", "error")


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class AIModel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A provider model that can be used without a deployment (TASK-077)."""

    __tablename__ = "ai_models"
    __table_args__ = (
        CheckConstraint(f"provider IN ({_in(PROVIDERS)})", name="provider"),
        CheckConstraint(
            "input_price_usd_per_mtok >= 0 AND output_price_usd_per_mtok >= 0", name="prices"
        ),
        UniqueConstraint("provider", "model_id", name="uq_ai_models_provider_model_id"),
        # At most one default model.
        Index(
            "uq_ai_models_default", "is_default", unique=True, postgresql_where=text("is_default")
        ),
    )

    provider: Mapped[str] = mapped_column(String(20))
    model_id: Mapped[str] = mapped_column(String(120))
    """Identifier sent to the provider, e.g. claude-opus-5-5."""
    display_name: Mapped[str] = mapped_column(String(120))
    input_price_usd_per_mtok: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    output_price_usd_per_mtok: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    context_window: Mapped[int] = mapped_column(Integer)
    max_output_tokens: Mapped[int] = mapped_column(Integer)
    """Default and maximum `max_tokens` of a call through the gateway."""
    options: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    """Provider-specific request options (effort, fallbacks, reasoning_effort...)."""
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class Prompt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A prompt referenced by key in code, e.g. `assistant.default` (TASK-078)."""

    __tablename__ = "ai_prompts"

    key: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(String(300), default="", server_default="")
    active_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ai_prompt_versions.id", ondelete="SET NULL", use_alter=True)
    )

    versions: Mapped[list["PromptVersion"]] = relationship(
        back_populates="prompt",
        foreign_keys="PromptVersion.prompt_id",
        order_by="PromptVersion.version.desc()",
        cascade="all, delete-orphan",
    )


class PromptVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Immutable: editing a prompt creates a new version."""

    __tablename__ = "ai_prompt_versions"
    __table_args__ = (
        UniqueConstraint("prompt_id", "version", name="uq_ai_prompt_versions_prompt_id_version"),
    )

    prompt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_prompts.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = mapped_column(Integer)
    system: Mapped[str] = mapped_column(Text)
    """Instructions. No variables: user-provided values never reach the instructions."""
    template: Mapped[str] = mapped_column(Text, default="", server_default="")
    """User message with {{variables}}, appended after the conversation when not empty."""
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ai_models.id", ondelete="SET NULL")
    )
    max_tokens: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str] = mapped_column(String(300), default="", server_default="")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    prompt: Mapped[Prompt] = relationship(back_populates="versions", foreign_keys=[prompt_id])


class AIUsage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One gateway call: who, what model, tokens, cost, latency. Never the content (TASK-080)."""

    __tablename__ = "ai_usage"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(USAGE_STATUSES)})", name="status"),
        Index("ix_ai_usage_org_created", "organization_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    model_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ai_models.id", ondelete="SET NULL"), index=True
    )
    provider: Mapped[str] = mapped_column(String(20))
    model: Mapped[str] = mapped_column(String(120))
    served_model: Mapped[str | None] = mapped_column(String(120))
    feature: Mapped[str] = mapped_column(String(50))
    """Calling feature, e.g. "playground", "assistant"."""
    prompt_key: Mapped[str | None] = mapped_column(String(100))
    prompt_version: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    error_code: Mapped[str | None] = mapped_column(String(50))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(14, 6), default=Decimal(0), server_default="0"
    )
    cost_eur: Mapped[Decimal] = mapped_column(
        Numeric(14, 6), default=Decimal(0), server_default="0"
    )
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class AIQuota(TimestampMixin, Base):
    """Monthly AI budget of an organization; without a row, the default budget applies."""

    __tablename__ = "ai_quotas"
    __table_args__ = (CheckConstraint("monthly_budget_eur >= 0", name="budget"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True
    )
    monthly_budget_eur: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
