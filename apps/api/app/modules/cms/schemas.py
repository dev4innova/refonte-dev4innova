import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DocumentType = Literal["article", "project", "service", "page"]
DocumentStatus = Literal["draft", "published"]
Locale = Literal["fr", "en"]

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class TranslationIn(BaseModel):
    slug: str = Field(min_length=2, max_length=120, pattern=SLUG_PATTERN)
    title: str = Field(min_length=2, max_length=200)
    summary: str = Field(default="", max_length=500)
    body_md: str = Field(default="", max_length=100_000)
    seo_title: str = Field(default="", max_length=70)
    seo_description: str = Field(default="", max_length=170)

    @field_validator("title", "summary", "seo_title", "seo_description")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


Attributes = dict[str, str]


class DocumentCreate(BaseModel):
    type: DocumentType
    translations: dict[Locale, TranslationIn] = Field(min_length=1)
    attributes: Attributes = Field(default_factory=dict, max_length=10)
    position: int = Field(default=0, ge=0, le=10_000)
    cover_media_id: uuid.UUID | None = None


class DocumentUpdate(BaseModel):
    translations: dict[Locale, TranslationIn] | None = None
    attributes: Attributes | None = Field(default=None, max_length=10)
    position: int | None = Field(default=None, ge=0, le=10_000)
    cover_media_id: uuid.UUID | None = None
    clear_cover: bool = False


class TranslationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    locale: Locale
    slug: str
    title: str
    summary: str
    body_md: str
    seo_title: str
    seo_description: str


class MediaOut(BaseModel):
    id: uuid.UUID
    url: str
    filename: str
    content_type: str
    size_bytes: int
    width: int
    height: int
    alt_fr: str
    alt_en: str
    created_at: datetime


class MediaUpdate(BaseModel):
    alt_fr: str | None = Field(default=None, max_length=300)
    alt_en: str | None = Field(default=None, max_length=300)


class DocumentOut(BaseModel):
    """Back-office view: every locale, drafts included."""

    id: uuid.UUID
    type: DocumentType
    status: DocumentStatus
    published_at: datetime | None
    position: int
    attributes: Attributes
    cover: MediaOut | None
    translations: list[TranslationOut]
    updated_at: datetime


class DocumentListItem(BaseModel):
    id: uuid.UUID
    type: DocumentType
    status: DocumentStatus
    published_at: datetime | None
    position: int
    titles: dict[Locale, str]
    updated_at: datetime


class PreviewIn(BaseModel):
    body_md: str = Field(max_length=100_000)


class PreviewOut(BaseModel):
    html: str


# --- Public website -----------------------------------------------------------------


class PublicImage(BaseModel):
    url: str
    alt: str
    width: int
    height: int


class PublicContentSummary(BaseModel):
    id: uuid.UUID
    type: DocumentType
    slug: str
    title: str
    summary: str
    published_at: datetime | None
    attributes: Attributes
    cover: PublicImage | None


class PublicContent(PublicContentSummary):
    body_html: str
    seo_title: str
    seo_description: str
    slugs: dict[Locale, str]
    """Slug of the same document in each locale, for the language switcher and hreflang."""
