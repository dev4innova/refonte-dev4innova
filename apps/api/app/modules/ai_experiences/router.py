import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_redis
from app.db.session import get_session
from app.modules.ai_experiences import service
from app.modules.ai_experiences.documents import DocumentError
from app.modules.ai_experiences.schemas import (
    AssistantSessionCreate,
    ContentSessionCreate,
    MessageIn,
    OrganizationAIUsage,
    SessionOut,
    SessionPage,
    SessionRename,
)
from app.modules.ai_gateway import sse
from app.modules.identity.dependencies import OrgContext

Session = Annotated[AsyncSession, Depends(get_session)]
RedisClient = Annotated[Redis, Depends(get_redis)]

router = APIRouter(
    prefix="/organizations/{organization_id}/ai",
    tags=["ai"],
    responses={
        401: {"description": "Missing or invalid access token"},
        404: {"description": "Not found, or not a member of the organization"},
    },
)


@router.get("/sessions", response_model=SessionPage, summary="My AI sessions in this organization")
async def list_sessions(
    ctx: OrgContext,
    session: Session,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 30,
) -> SessionPage:
    return await service.list_sessions(session, ctx, page=page, page_size=page_size)


@router.post(
    "/sessions",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start a conversation with the assistant",
)
async def create_assistant_session(
    data: AssistantSessionCreate, ctx: OrgContext, session: Session
) -> SessionOut:
    session_id = await service.create_assistant_session(session, ctx, data.title)
    return await service.session_out(session, ctx, session_id)


@router.post(
    "/sessions/content",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start a content generation (the first message generates it)",
)
async def create_content_session(
    data: ContentSessionCreate, ctx: OrgContext, session: Session
) -> SessionOut:
    session_id = await service.create_content_session(session, ctx, data)
    return await service.session_out(session, ctx, session_id)


@router.post(
    "/documents",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Analyze a document (PDF, DOCX, text): its text is extracted, the file is not kept",
    responses={422: {"description": "Unsupported, unreadable, empty, too large or too long"}},
)
async def upload_document(
    ctx: OrgContext,
    session: Session,
    redis: RedisClient,
    file: Annotated[UploadFile, File()],
) -> SessionOut:
    limit = get_settings().ai_document_max_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise DocumentError("This file is too large", {"reason": "too_large", "max_bytes": limit})
    session_id = await service.create_document_session(
        session, redis, ctx, file.filename or "document", data
    )
    return await service.session_out(session, ctx, session_id)


@router.get(
    "/sessions/{session_id}", response_model=SessionOut, summary="A session and its history"
)
async def get_session_detail(
    session_id: uuid.UUID, ctx: OrgContext, session: Session
) -> SessionOut:
    return await service.session_out(session, ctx, session_id)


@router.patch("/sessions/{session_id}", response_model=SessionOut, summary="Rename a session")
async def rename_session(
    session_id: uuid.UUID, data: SessionRename, ctx: OrgContext, session: Session
) -> SessionOut:
    await service.rename_session(session, ctx, session_id, data.title)
    return await service.session_out(session, ctx, session_id)


@router.delete(
    "/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a session"
)
async def delete_session(session_id: uuid.UUID, ctx: OrgContext, session: Session) -> Response:
    await service.delete_session(session, ctx, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/sessions", status_code=status.HTTP_204_NO_CONTENT, summary="Delete all my sessions here"
)
async def delete_all_sessions(ctx: OrgContext, session: Session) -> Response:
    await service.delete_all_sessions(session, ctx)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/sessions/{session_id}/messages",
    summary="Send a message; the answer streams (Server-Sent Events: delta, done, error)",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"text/event-stream": {}}},
        422: {"description": "Empty message"},
        429: {"description": "Rate limit, daily limit or monthly budget reached"},
        503: {"description": "AI unavailable"},
    },
)
async def send_message(
    session_id: uuid.UUID,
    data: MessageIn,
    ctx: OrgContext,
    session: Session,
    redis: RedisClient,
) -> StreamingResponse:
    prepared = await service.prepare_message(session, redis, ctx, session_id, data.text)
    return StreamingResponse(
        sse.events(service.stream_answer(prepared), with_costs=False),
        media_type="text/event-stream",
        headers=sse.SSE_HEADERS,
    )


@router.get(
    "/usage",
    response_model=OrganizationAIUsage,
    summary="AI usage and budget of the month (owners and admins, no content)",
    responses={403: {"description": "Reserved to owners and admins"}},
)
async def usage(ctx: OrgContext, session: Session) -> OrganizationAIUsage:
    return await service.organization_usage(session, ctx)
