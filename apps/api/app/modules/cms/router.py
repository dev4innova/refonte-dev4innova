import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.storage import ObjectStorage, get_storage
from app.db.session import get_session
from app.modules.cms import service
from app.modules.cms.markdown import render_markdown
from app.modules.cms.schemas import (
    DocumentCreate,
    DocumentListItem,
    DocumentOut,
    DocumentType,
    DocumentUpdate,
    Locale,
    MediaOut,
    MediaUpdate,
    PreviewIn,
    PreviewOut,
    PublicContent,
    PublicContentSummary,
)
from app.modules.identity.dependencies import StaffContext
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID
from app.modules.identity.permissions import Permission

Session = Annotated[AsyncSession, Depends(get_session)]
Storage = Annotated[ObjectStorage, Depends(get_storage)]

STAFF_ERRORS: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing or invalid access token"},
    403: {"description": "The staff role does not allow this action"},
    404: {"description": "Not found, or the user is not DEV4INNOVA staff"},
}

admin_router = APIRouter(prefix="/admin/cms", tags=["cms-admin"], responses=STAFF_ERRORS)
public_router = APIRouter(prefix="/content", tags=["content"])


# --- Back office: documents (TASK-060 to TASK-064, TASK-066) --------------------------


@admin_router.get("/documents", response_model=list[DocumentListItem], summary="List contents")
async def list_documents(
    ctx: StaffContext,
    session: Session,
    document_type: Annotated[DocumentType, Query(alias="type")],
) -> list[DocumentListItem]:
    return await service.list_documents(session, ctx, document_type)


@admin_router.post(
    "/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a content (draft)",
    responses={409: {"description": "Slug already used"}},
)
async def create_document(
    data: DocumentCreate, ctx: StaffContext, session: Session, storage: Storage
) -> DocumentOut:
    return service.document_out(await service.create_document(session, ctx, data), storage)


@admin_router.get("/documents/{document_id}", response_model=DocumentOut, summary="Content")
async def get_document(
    document_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> DocumentOut:
    return service.document_out(await service.get_document(session, ctx, document_id), storage)


@admin_router.patch(
    "/documents/{document_id}",
    response_model=DocumentOut,
    summary="Update a content (translations, SEO, cover...)",
    responses={409: {"description": "Slug already used"}},
)
async def update_document(
    document_id: uuid.UUID,
    data: DocumentUpdate,
    ctx: StaffContext,
    session: Session,
    storage: Storage,
) -> DocumentOut:
    document = await service.update_document(session, ctx, document_id, data)
    return service.document_out(document, storage)


@admin_router.post(
    "/documents/{document_id}/publish",
    response_model=DocumentOut,
    summary="Publish a content",
    responses={422: {"description": "A language is missing"}},
)
async def publish_document(
    document_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> DocumentOut:
    document = await service.set_published(session, ctx, document_id, published=True)
    return service.document_out(document, storage)


@admin_router.post(
    "/documents/{document_id}/unpublish", response_model=DocumentOut, summary="Unpublish a content"
)
async def unpublish_document(
    document_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> DocumentOut:
    document = await service.set_published(session, ctx, document_id, published=False)
    return service.document_out(document, storage)


@admin_router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a draft",
    responses={409: {"description": "Published contents must be unpublished first"}},
)
async def delete_document(document_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
    await service.delete_document(session, ctx, document_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.post("/preview", response_model=PreviewOut, summary="Render Markdown as on the site")
async def preview(data: PreviewIn, ctx: StaffContext) -> PreviewOut:
    ctx.require(Permission.CONTENT_READ)
    return PreviewOut(html=render_markdown(data.body_md))


# --- Back office: media (TASK-065) ----------------------------------------------------


@admin_router.get("/media", response_model=list[MediaOut], summary="Media library")
async def list_media(ctx: StaffContext, session: Session, storage: Storage) -> list[MediaOut]:
    return [service.media_out(m, storage) for m in await service.list_media(session, ctx)]


@admin_router.post(
    "/media",
    response_model=MediaOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image (JPEG, PNG or WebP)",
    responses={422: {"description": "Not an accepted image, or too large"}},
)
async def upload_media(
    ctx: StaffContext, session: Session, storage: Storage, file: Annotated[UploadFile, File()]
) -> MediaOut:
    data = await file.read(get_settings().media_max_bytes + 1)
    media = await service.upload_media(
        session, ctx, storage, filename=file.filename or "", data=data
    )
    return service.media_out(media, storage)


@admin_router.patch("/media/{media_id}", response_model=MediaOut, summary="Edit alternative texts")
async def update_media(
    media_id: uuid.UUID, data: MediaUpdate, ctx: StaffContext, session: Session, storage: Storage
) -> MediaOut:
    media = await service.update_media(
        session, ctx, media_id, alt_fr=data.alt_fr, alt_en=data.alt_en
    )
    return service.media_out(media, storage)


@admin_router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete")
async def delete_media(
    media_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> Response:
    await service.delete_media(session, ctx, storage, media_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Public website: published DEV4INNOVA content --------------------------------------


@public_router.get(
    "/{document_type}",
    response_model=list[PublicContentSummary],
    summary="Published contents (public)",
)
async def list_public(
    document_type: DocumentType, session: Session, storage: Storage, locale: Locale = "fr"
) -> list[PublicContentSummary]:
    documents = await service.list_published(session, INTERNAL_ORGANIZATION_ID, document_type)
    return [service.public_summary(d, locale, storage) for d in documents]


@public_router.get(
    "/{document_type}/{slug}",
    response_model=PublicContent,
    summary="A published content (public)",
    responses={404: {"description": "No published content with this slug"}},
)
async def get_public(
    document_type: DocumentType,
    slug: str,
    session: Session,
    storage: Storage,
    locale: Locale = "fr",
) -> PublicContent:
    document = await service.get_published(
        session, INTERNAL_ORGANIZATION_ID, document_type, locale, slug
    )
    return service.public_content(document, locale, storage)
