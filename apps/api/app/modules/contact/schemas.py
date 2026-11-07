import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Topic = Literal["project", "training", "partnership", "other"]


class ContactRequestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    company: str | None = Field(default=None, max_length=160)
    topic: Topic = "project"
    message: str = Field(min_length=20, max_length=5000)
    locale: Literal["fr", "en"] = "fr"
    consent: Literal[True]
    """The privacy notice must be accepted explicitly."""
    website: str = Field(default="", max_length=200)
    """Honeypot: hidden from people, filled in by naive bots. Must stay empty."""

    @field_validator("name", "company", "message")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class ContactRequestAccepted(BaseModel):
    id: uuid.UUID | None
    """None when the request was silently discarded (spam)."""
