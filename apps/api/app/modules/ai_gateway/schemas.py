import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Provider = Literal["anthropic", "openai", "gemini", "simulated"]
PROMPT_KEY_PATTERN = r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
MODEL_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._:/@-]*$"


# --- Model registry (TASK-077) -----------------------------------------------------


class ModelIn(BaseModel):
    provider: Provider
    model_id: str = Field(min_length=1, max_length=120, pattern=MODEL_ID_PATTERN)
    display_name: str = Field(min_length=1, max_length=120)
    input_price_usd_per_mtok: Decimal = Field(ge=0, max_digits=12, decimal_places=4)
    output_price_usd_per_mtok: Decimal = Field(ge=0, max_digits=12, decimal_places=4)
    context_window: int = Field(ge=1_000, le=10_000_000)
    max_output_tokens: int = Field(ge=1, le=200_000)
    options: dict[str, str] = Field(default_factory=dict, max_length=10)
    is_enabled: bool = True
    is_default: bool = False


class ModelUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    input_price_usd_per_mtok: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=4
    )
    output_price_usd_per_mtok: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=4
    )
    context_window: int | None = Field(default=None, ge=1_000, le=10_000_000)
    max_output_tokens: int | None = Field(default=None, ge=1, le=200_000)
    options: dict[str, str] | None = Field(default=None, max_length=10)
    is_enabled: bool | None = None
    is_default: bool | None = None


class ModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: Provider
    model_id: str
    display_name: str
    input_price_usd_per_mtok: Decimal
    output_price_usd_per_mtok: Decimal
    context_window: int
    max_output_tokens: int
    options: dict[str, Any]
    is_enabled: bool
    is_default: bool
    provider_configured: bool = False
    """False when the backend has no key for this provider: calls would fail (503)."""


# --- Prompts (TASK-078) --------------------------------------------------------------


class PromptVersionIn(BaseModel):
    system: str = Field(min_length=1, max_length=50_000)
    template: str = Field(default="", max_length=50_000)
    model_id: uuid.UUID | None = None
    max_tokens: int | None = Field(default=None, ge=1, le=200_000)
    notes: str = Field(default="", max_length=300)
    activate: bool = True

    @field_validator("system")
    @classmethod
    def no_variables_in_instructions(cls, value: str) -> str:
        # User-provided values only go into the user message (prompt injection defense).
        if "{{" in value:
            raise ValueError("Variables are only allowed in the template, not in the instructions")
        return value


class PromptCreate(PromptVersionIn):
    key: str = Field(min_length=2, max_length=100, pattern=PROMPT_KEY_PATTERN)
    description: str = Field(default="", max_length=300)


class PromptVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    version: int
    system: str
    template: str
    variables: list[str]
    model_id: uuid.UUID | None
    max_tokens: int | None
    notes: str
    created_at: datetime


class PromptSummary(BaseModel):
    id: uuid.UUID
    key: str
    description: str
    active_version: int | None
    versions: int
    updated_at: datetime


class PromptOut(BaseModel):
    id: uuid.UUID
    key: str
    description: str
    active_version: int | None
    versions: list[PromptVersionOut]


# --- Usage and quotas (TASK-080, TASK-081) -------------------------------------------


class OrganizationUsage(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    monthly_budget_eur: Decimal
    has_specific_budget: bool
    spent_eur: Decimal
    calls: int


class ModelUsage(BaseModel):
    provider: str
    model: str
    calls: int
    input_tokens: int
    output_tokens: int
    cost_eur: Decimal


class UsageRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    organization_id: uuid.UUID
    feature: str
    provider: str
    model: str
    prompt_key: str | None
    prompt_version: int | None
    status: str
    error_code: str | None
    input_tokens: int
    output_tokens: int
    cost_eur: Decimal
    latency_ms: int


class UsageReport(BaseModel):
    month: str
    eur_per_usd: Decimal
    default_budget_eur: Decimal
    total_cost_eur: Decimal
    organizations: list[OrganizationUsage]
    models: list[ModelUsage]
    recent: list[UsageRecord]


class QuotaIn(BaseModel):
    monthly_budget_eur: Decimal | None = Field(ge=0, le=1_000_000, max_digits=10, decimal_places=2)
    """None goes back to the default budget."""


# --- Playground ------------------------------------------------------------------


class PlaygroundIn(BaseModel):
    model_id: uuid.UUID | None = None
    """Registry model; defaults to the prompt's model, then to the default model."""
    prompt_key: str | None = Field(default=None, max_length=100, pattern=PROMPT_KEY_PATTERN)
    prompt_version: int | None = Field(default=None, ge=1)
    """Defaults to the active version."""
    system: str | None = Field(default=None, max_length=50_000)
    """Instructions when no prompt is used."""
    message: str = Field(default="", max_length=20_000)
    variables: dict[str, str] = Field(default_factory=dict, max_length=30)
    max_tokens: int | None = Field(default=None, ge=1, le=200_000)
