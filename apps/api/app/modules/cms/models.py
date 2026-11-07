"""CMS models (TASK-058, TASK-059, TASK-065, TASK-066).

One generic document table for every editorial content type, a translation per locale
(title, slug, summary, Markdown body, SEO fields) and a media library. Content belongs to
an organization (the internal DEV4INNOVA one), like every business record (ADR-0006).
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

DOCUMENT_TYPES = ("article", "project", "service", "page")
DOCUMENT_STATUSES = ("draft", "published")
LOCALES = ("fr", "en")


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


class Media(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "cms_media"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    storage_key: Mapped[str] = mapped_column(String(200), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int] = mapped_column(Integer)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    alt_fr: Mapped[str] = mapped_column(String(300), default="", server_default="")
    alt_en: Mapped[str] = mapped_column(String(300), default="", server_default="")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class Document(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "cms_documents"
    __table_args__ = (
        CheckConstraint(f"type IN ({_in(DOCUMENT_TYPES)})", name="type"),
        CheckConstraint(f"status IN ({_in(DOCUMENT_STATUSES)})", name="status"),
        Index("ix_cms_documents_org_type_status", "organization_id", "type", "status"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    """Manual ordering (services, projects); articles are ordered by publication date."""
    attributes: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    """Type-specific fields, e.g. a service icon or a project's industry."""
    cover_media_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cms_media.id", ondelete="SET NULL")
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    translations: Mapped[list["DocumentTranslation"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", lazy="selectin"
    )
    cover: Mapped[Media | None] = relationship(lazy="selectin")

    def translation(self, locale: str) -> "DocumentTranslation | None":
        return next((t for t in self.translations if t.locale == locale), None)


class DocumentTranslation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "cms_document_translations"
    __table_args__ = (
        UniqueConstraint(
            "document_id", "locale", name="uq_cms_document_translations_document_locale"
        ),
        # Slugs are unique per organization, content type and locale (denormalized columns).
        UniqueConstraint(
            "organization_id", "type", "locale", "slug", name="uq_cms_document_translations_slug"
        ),
        CheckConstraint(f"locale IN ({_in(LOCALES)})", name="locale"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cms_documents.id", ondelete="CASCADE")
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE")
    )
    type: Mapped[str] = mapped_column(String(20))
    locale: Mapped[str] = mapped_column(String(2))
    slug: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(String(500), default="", server_default="")
    body_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    seo_title: Mapped[str] = mapped_column(String(70), default="", server_default="")
    seo_description: Mapped[str] = mapped_column(String(170), default="", server_default="")

    document: Mapped[Document] = relationship(back_populates="translations")
