import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Locale = Literal["fr", "en"]


# --- Questionnaire (TASK-089) --------------------------------------------------------


class OptionOut(BaseModel):
    id: str
    label: str


class QuestionOut(BaseModel):
    id: str
    label: str
    options: list[OptionOut]


class DimensionOut(BaseModel):
    id: str
    label: str
    description: str
    questions: list[QuestionOut]


class ProfileFieldOut(BaseModel):
    id: str
    label: str
    options: list[OptionOut]


class QuestionnaireOut(BaseModel):
    version: str
    profile: list[ProfileFieldOut]
    dimensions: list[DimensionOut]


# --- Answers and results (TASK-090, TASK-091, TASK-093) ------------------------------


class DiagnosticCreate(BaseModel):
    locale: Locale = "fr"
    answers: dict[str, str] = Field(max_length=50)
    """Question id → option id, for every scored question."""
    profile: dict[str, str] = Field(default_factory=dict, max_length=5)
    website: str = Field(default="", max_length=200)
    """Honeypot: hidden from people, filled in by naive bots. Must stay empty."""


class DiagnosticCreated(BaseModel):
    token: str
    """Secret link to the result: shown once, only its hash is stored."""


class DimensionScore(BaseModel):
    id: str
    label: str
    score: int


class RecommendationOut(BaseModel):
    id: str
    dimension: str
    title: str
    text: str | None
    """Only in the full report."""
    horizon: Literal["quick_win", "short_term", "mid_term"]
    service: str


class Report(BaseModel):
    recommendations: list[RecommendationOut]
    ai_status: Literal["none", "pending", "done", "error"]
    ai_analysis: str | None
    company: str | None


class DiagnosticResult(BaseModel):
    id: uuid.UUID
    created_at: datetime
    locale: Locale
    questionnaire_version: str
    overall_score: int
    level: Literal["discovery", "experimentation", "structuring", "transformation"]
    level_label: str
    level_description: str
    dimensions: list[DimensionScore]
    priorities: list[RecommendationOut]
    unlocked: bool
    report: Report | None
    """The full report, once the respondent left their email."""


class Unlock(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: str | None = Field(default=None, max_length=160)
    consent: Literal[True]
    """The privacy notice must be accepted explicitly."""
    website: str = Field(default="", max_length=200)

    @field_validator("name", "company", mode="before")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return value.strip() or None if isinstance(value, str) else value


# --- Back office (TASK-093, TASK-095) ------------------------------------------------


class DiagnosticSummary(BaseModel):
    id: uuid.UUID
    created_at: datetime
    locale: Locale
    overall_score: int
    level: str
    unlocked: bool
    contact_name: str | None
    contact_email: str | None
    contact_company: str | None
    sector: str | None
    size: str | None
    lead_id: uuid.UUID | None
    ai_status: str


class DiagnosticPage(BaseModel):
    items: list[DiagnosticSummary]
    total: int
    page: int
    page_size: int
