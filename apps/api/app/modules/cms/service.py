"""CMS business rules (TASK-058 to TASK-066). Every query is scoped to the caller's
organization (the internal DEV4INNOVA organization for the back office)."""

import io
import uuid
from datetime import UTC, datetime
from typing import cast

from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.storage import ObjectStorage
from app.modules.cms.markdown import render_markdown
from app.modules.cms.models import LOCALES, Document, DocumentTranslation, Media
from app.modules.cms.schemas import (
    DocumentCreate,
    DocumentListItem,
    DocumentOut,
    DocumentUpdate,
    Locale,
    MediaOut,
    PublicContent,
    PublicContentSummary,
    PublicImage,
    TranslationIn,
    TranslationOut,
)
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext


class UnprocessableError(AppError):
    status_code = 422
    code = "unprocessable"


# --- Mapping -------------------------------------------------------------------------


def media_out(media: Media, storage: ObjectStorage) -> MediaOut:
    return MediaOut(
        id=media.id,
        url=storage.public_url(media.storage_key),
        filename=media.filename,
        content_type=media.content_type,
        size_bytes=media.size_bytes,
        width=media.width,
        height=media.height,
        alt_fr=media.alt_fr,
        alt_en=media.alt_en,
        created_at=media.created_at,
    )


def document_out(document: Document, storage: ObjectStorage) -> DocumentOut:
    return DocumentOut.model_validate(
        {
            "id": document.id,
            "type": document.type,
            "status": document.status,
            "published_at": document.published_at,
            "position": document.position,
            "attributes": document.attributes,
            "cover": media_out(document.cover, storage) if document.cover else None,
            "translations": [
                TranslationOut.model_validate(t)
                for t in sorted(document.translations, key=lambda t: t.locale)
            ],
            "updated_at": document.updated_at,
        }
    )


def _public_image(
    media: Media | None, locale: Locale, storage: ObjectStorage
) -> PublicImage | None:
    if media is None:
        return None
    return PublicImage(
        url=storage.public_url(media.storage_key),
        alt=media.alt_fr if locale == "fr" else media.alt_en,
        width=media.width,
        height=media.height,
    )


def public_summary(
    document: Document, locale: Locale, storage: ObjectStorage
) -> PublicContentSummary:
    translation = document.translation(locale)
    assert translation is not None  # published documents have every locale
    return PublicContentSummary.model_validate(
        {
            "id": document.id,
            "type": document.type,
            "slug": translation.slug,
            "title": translation.title,
            "summary": translation.summary,
            "published_at": document.published_at,
            "attributes": document.attributes,
            "cover": _public_image(document.cover, locale, storage),
        }
    )


def public_content(document: Document, locale: Locale, storage: ObjectStorage) -> PublicContent:
    translation = document.translation(locale)
    assert translation is not None
    return PublicContent(
        **public_summary(document, locale, storage).model_dump(),
        body_html=render_markdown(translation.body_md),
        seo_title=translation.seo_title,
        seo_description=translation.seo_description,
        slugs={cast(Locale, t.locale): t.slug for t in document.translations},
    )


# --- Back office: documents ----------------------------------------------------------


async def _get_document(
    session: AsyncSession, ctx: OrganizationContext, document_id: uuid.UUID
) -> Document:
    document = await session.scalar(
        select(Document).where(
            Document.id == document_id, Document.organization_id == ctx.organization_id
        )
    )
    if document is None:
        raise NotFoundError("Content not found")
    return document


async def _get_media(session: AsyncSession, ctx: OrganizationContext, media_id: uuid.UUID) -> Media:
    media = await session.scalar(
        select(Media).where(Media.id == media_id, Media.organization_id == ctx.organization_id)
    )
    if media is None:
        raise NotFoundError("Media not found", {"field": "cover_media_id"})
    return media


async def list_documents(
    session: AsyncSession, ctx: OrganizationContext, document_type: str
) -> list[DocumentListItem]:
    ctx.require(Permission.CONTENT_READ)
    documents = await session.scalars(
        select(Document)
        .where(Document.organization_id == ctx.organization_id, Document.type == document_type)
        .order_by(Document.position, Document.updated_at.desc())
    )
    return [
        DocumentListItem.model_validate(
            {
                "id": d.id,
                "type": d.type,
                "status": d.status,
                "published_at": d.published_at,
                "position": d.position,
                "titles": {t.locale: t.title for t in d.translations},
                "updated_at": d.updated_at,
            }
        )
        for d in documents
    ]


async def get_document(
    session: AsyncSession, ctx: OrganizationContext, document_id: uuid.UUID
) -> Document:
    ctx.require(Permission.CONTENT_READ)
    return await _get_document(session, ctx, document_id)


def _apply_translation(document: Document, locale: str, data: TranslationIn) -> None:
    translation = document.translation(locale)
    if translation is None:
        translation = DocumentTranslation(
            locale=locale, organization_id=document.organization_id, type=document.type
        )
        document.translations.append(translation)
    for field, value in data.model_dump().items():
        setattr(translation, field, value)


async def _commit(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError(
            "This slug is already used for this content type", {"field": "slug"}
        ) from exc


async def create_document(
    session: AsyncSession, ctx: OrganizationContext, data: DocumentCreate
) -> Document:
    ctx.require(Permission.CONTENT_WRITE)
    if data.cover_media_id:
        await _get_media(session, ctx, data.cover_media_id)
    document = Document(
        organization_id=ctx.organization_id,
        type=data.type,
        attributes=data.attributes,
        position=data.position,
        cover_media_id=data.cover_media_id,
        created_by_id=ctx.user.id,
        updated_by_id=ctx.user.id,
        translations=[],
    )
    for locale, translation in data.translations.items():
        _apply_translation(document, locale, translation)
    session.add(document)
    await _commit(session)
    return await _get_document(session, ctx, document.id)


async def update_document(
    session: AsyncSession, ctx: OrganizationContext, document_id: uuid.UUID, data: DocumentUpdate
) -> Document:
    ctx.require(Permission.CONTENT_WRITE)
    document = await _get_document(session, ctx, document_id)
    if data.translations is not None:
        for locale, translation in data.translations.items():
            _apply_translation(document, locale, translation)
    if data.attributes is not None:
        document.attributes = data.attributes
    if data.position is not None:
        document.position = data.position
    if data.clear_cover:
        document.cover_media_id = None
    elif data.cover_media_id:
        await _get_media(session, ctx, data.cover_media_id)
        document.cover_media_id = data.cover_media_id
    document.updated_by_id = ctx.user.id
    document.updated_at = datetime.now(UTC)
    await _commit(session)
    session.expire(document)
    return await _get_document(session, ctx, document_id)


async def set_published(
    session: AsyncSession, ctx: OrganizationContext, document_id: uuid.UUID, *, published: bool
) -> Document:
    ctx.require(Permission.CONTENT_PUBLISH)
    document = await _get_document(session, ctx, document_id)
    if published:
        missing = [locale for locale in LOCALES if document.translation(locale) is None]
        if missing:
            raise UnprocessableError(
                "Every language must be filled in before publishing", {"missing_locales": missing}
            )
        document.status = "published"
        document.published_at = document.published_at or datetime.now(UTC)
    else:
        document.status = "draft"
    document.updated_by_id = ctx.user.id
    await session.commit()
    session.expire(document)
    return await _get_document(session, ctx, document_id)


async def delete_document(
    session: AsyncSession, ctx: OrganizationContext, document_id: uuid.UUID
) -> None:
    ctx.require(Permission.CONTENT_WRITE)
    document = await _get_document(session, ctx, document_id)
    if document.status == "published":
        raise ConflictError("Unpublish this content before deleting it")
    await session.delete(document)
    await session.commit()


# --- Back office: media (TASK-065) ---------------------------------------------------

ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}
MAX_PIXELS = 40_000_000


async def upload_media(
    session: AsyncSession,
    ctx: OrganizationContext,
    storage: ObjectStorage,
    *,
    filename: str,
    data: bytes,
) -> Media:
    """Validates the real file type (not the declared one), then re-encodes the image:
    this strips metadata such as GPS coordinates and neutralizes polyglot files."""
    ctx.require(Permission.MEDIA_MANAGE)
    if len(data) > get_settings().media_max_bytes:
        raise UnprocessableError("File too large", {"max_bytes": get_settings().media_max_bytes})
    try:
        with Image.open(io.BytesIO(data)) as probe:
            image_format = probe.format or ""
            if image_format not in ALLOWED_FORMATS:
                raise UnprocessableError("Only JPEG, PNG and WebP images are accepted")
            if probe.width * probe.height > MAX_PIXELS:
                raise UnprocessableError("Image dimensions are too large")
            probe.load()
            image = probe.copy()
    except (UnidentifiedImageError, OSError) as exc:
        raise UnprocessableError("The file is not a valid image") from exc

    content_type, extension = ALLOWED_FORMATS[image_format]
    output = io.BytesIO()
    save_kwargs: dict[str, object] = {"optimize": True}
    if image_format == "JPEG":
        image = image.convert("RGB")
        save_kwargs["quality"] = 88
    image.save(output, format=image_format, **save_kwargs)
    body = output.getvalue()

    media_id = uuid.uuid4()
    key = f"media/{media_id}.{extension}"
    await storage.put(key, body, content_type)

    media = Media(
        id=media_id,
        organization_id=ctx.organization_id,
        storage_key=key,
        filename=filename[-255:] or f"image.{extension}",
        content_type=content_type,
        size_bytes=len(body),
        width=image.width,
        height=image.height,
        created_by_id=ctx.user.id,
    )
    session.add(media)
    await session.commit()
    return media


async def list_media(session: AsyncSession, ctx: OrganizationContext) -> list[Media]:
    ctx.require(Permission.CONTENT_READ)
    return list(
        await session.scalars(
            select(Media)
            .where(Media.organization_id == ctx.organization_id)
            .order_by(Media.created_at.desc())
        )
    )


async def update_media(
    session: AsyncSession,
    ctx: OrganizationContext,
    media_id: uuid.UUID,
    *,
    alt_fr: str | None,
    alt_en: str | None,
) -> Media:
    ctx.require(Permission.MEDIA_MANAGE)
    media = await _get_media(session, ctx, media_id)
    if alt_fr is not None:
        media.alt_fr = alt_fr.strip()
    if alt_en is not None:
        media.alt_en = alt_en.strip()
    await session.commit()
    return media


async def delete_media(
    session: AsyncSession, ctx: OrganizationContext, storage: ObjectStorage, media_id: uuid.UUID
) -> None:
    ctx.require(Permission.MEDIA_MANAGE)
    media = await _get_media(session, ctx, media_id)
    await session.delete(media)  # covers referencing it are set to NULL by the database
    await session.commit()
    await storage.delete(media.storage_key)


# --- Public website (TASK-061 to TASK-064) -------------------------------------------


async def list_published(
    session: AsyncSession, organization_id: uuid.UUID, document_type: str
) -> list[Document]:
    order = (
        [Document.published_at.desc()]
        if document_type == "article"
        else [Document.position, Document.published_at.desc()]
    )
    return list(
        await session.scalars(
            select(Document)
            .where(
                Document.organization_id == organization_id,
                Document.type == document_type,
                Document.status == "published",
            )
            .order_by(*order)
        )
    )


async def get_published(
    session: AsyncSession, organization_id: uuid.UUID, document_type: str, locale: str, slug: str
) -> Document:
    document = await session.scalar(
        select(Document)
        .join(DocumentTranslation)
        .where(
            Document.organization_id == organization_id,
            Document.type == document_type,
            Document.status == "published",
            DocumentTranslation.locale == locale,
            DocumentTranslation.slug == slug,
        )
    )
    if document is None:
        raise NotFoundError("Content not found")
    return document
