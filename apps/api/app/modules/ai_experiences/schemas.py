import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Kind = Literal["assistant", "document", "content"]
ContentFormat = Literal["blog_post", "linkedin_post", "newsletter", "product_description", "email"]
Tone = Literal["professional", "friendly", "inspiring", "didactic"]
Language = Literal["fr", "en"]
Length = Literal["short", "medium", "long"]

MESSAGE_MAX_CHARS = 8_000


class SessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: Kind
    title: str
    document_name: str | None
    last_activity_at: datetime
    created_at: datetime


class SessionPage(BaseModel):
    items: list[SessionSummary]
    total: int
    page: int
    page_size: int


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: Literal["user", "assistant"]
    text: str
    """What the user sees (the generator's request is summarized)."""
    status: Literal["ok", "refused", "error", "incomplete"]
    created_at: datetime


class SessionOut(SessionSummary):
    options: dict[str, str]
    document_chars: int | None
    messages: list[MessageOut]


class AssistantSessionCreate(BaseModel):
    title: str = Field(default="", max_length=200)


class ContentSessionCreate(BaseModel):
    format: ContentFormat
    tone: Tone = "professional"
    language: Language = "fr"
    length: Length = "medium"
    topic: str = Field(min_length=3, max_length=300)
    details: str = Field(default="", max_length=4_000)

    @field_validator("topic", "details")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class SessionRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class MessageIn(BaseModel):
    text: str = Field(default="", max_length=MESSAGE_MAX_CHARS)
    """May be empty only for the first turn of a content session (the generator request)."""


class FeatureUsage(BaseModel):
    feature: str
    calls: int
    cost_eur: Decimal


class OrganizationAIUsage(BaseModel):
    month: str
    monthly_budget_eur: Decimal
    spent_eur: Decimal
    calls: int
    features: list[FeatureUsage]
