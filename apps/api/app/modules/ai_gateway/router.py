import json
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.redis import get_redis
from app.db.session import get_session
from app.modules.ai_gateway import admin, gateway
from app.modules.ai_gateway.providers.base import ChatMessage, TextDelta
from app.modules.ai_gateway.schemas import (
    ModelIn,
    ModelOut,
    ModelUpdate,
    PlaygroundIn,
    PromptCreate,
    PromptOut,
    PromptSummary,
    PromptVersionIn,
    QuotaIn,
    UsageReport,
)
from app.modules.identity.dependencies import StaffContext
from app.modules.identity.permissions import Permission

Session = Annotated[AsyncSession, Depends(get_session)]
RedisClient = Annotated[Redis, Depends(get_redis)]

STAFF_ERRORS: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing or invalid access token"},
    403: {"description": "Reserved to staff admins (ai:manage)"},
    404: {"description": "Not found, or the user is not DEV4INNOVA staff"},
}

router = APIRouter(prefix="/admin/ai", tags=["ai-admin"], responses=STAFF_ERRORS)


# --- Registry (TASK-077) -------------------------------------------------------------


@router.get("/models", response_model=list[ModelOut], summary="Model registry")
async def list_models(ctx: StaffContext, session: Session) -> list[ModelOut]:
    return await admin.list_models(session, ctx)


@router.post(
    "/models",
    response_model=ModelOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a model",
    responses={409: {"description": "Already in the registry"}},
)
async def create_model(data: ModelIn, ctx: StaffContext, session: Session) -> ModelOut:
    return admin.model_out(await admin.create_model(session, ctx, data))


@router.patch("/models/{model_id}", response_model=ModelOut, summary="Update a model")
async def update_model(
    model_id: uuid.UUID, data: ModelUpdate, ctx: StaffContext, session: Session
) -> ModelOut:
    return admin.model_out(await admin.update_model(session, ctx, model_id, data))


# --- Prompts (TASK-078) --------------------------------------------------------------


@router.get("/prompts", response_model=list[PromptSummary], summary="Prompts")
async def list_prompts(ctx: StaffContext, session: Session) -> list[PromptSummary]:
    return await admin.list_prompts(session, ctx)


@router.post(
    "/prompts",
    response_model=PromptOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a prompt (version 1, active)",
    responses={409: {"description": "Key already used"}},
)
async def create_prompt(data: PromptCreate, ctx: StaffContext, session: Session) -> PromptOut:
    return admin.prompt_out(await admin.create_prompt(session, ctx, data))


@router.get("/prompts/{key}", response_model=PromptOut, summary="Prompt and its versions")
async def get_prompt(key: str, ctx: StaffContext, session: Session) -> PromptOut:
    return admin.prompt_out(await admin.get_prompt(session, ctx, key))


@router.post(
    "/prompts/{key}/versions",
    response_model=PromptOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save a new version (versions are immutable)",
)
async def add_version(
    key: str, data: PromptVersionIn, ctx: StaffContext, session: Session
) -> PromptOut:
    return admin.prompt_out(await admin.add_version(session, ctx, key, data))


@router.post(
    "/prompts/{key}/versions/{version}/activate",
    response_model=PromptOut,
    summary="Make a version the active one (or roll back)",
)
async def activate_version(
    key: str, version: int, ctx: StaffContext, session: Session
) -> PromptOut:
    return admin.prompt_out(await admin.activate_version(session, ctx, key, version))


# --- Usage and quotas (TASK-080, TASK-081) -------------------------------------------


@router.get("/usage", response_model=UsageReport, summary="Usage and costs of the month")
async def usage(ctx: StaffContext, session: Session) -> UsageReport:
    return await admin.usage_report(session, ctx)


@router.put(
    "/quotas/{organization_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set the monthly budget of an organization (null: default budget)",
)
async def set_quota(
    organization_id: uuid.UUID, data: QuotaIn, ctx: StaffContext, session: Session
) -> Response:
    await admin.set_quota(session, ctx, organization_id, data.monthly_budget_eur)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Playground (TASK-079) -----------------------------------------------------------


def _sse(event: str, data: dict[str, Any]) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


async def _events(call: gateway.PreparedCall) -> AsyncIterator[bytes]:
    try:
        async for event in gateway.run(call):
            if isinstance(event, TextDelta):
                yield _sse("delta", {"text": event.text})
            else:
                yield _sse(
                    "done",
                    {
                        "input_tokens": event.input_tokens,
                        "output_tokens": event.output_tokens,
                        "cost_eur": str(event.cost_eur),
                        "stop_reason": event.stop_reason,
                        "served_model": event.served_model,
                        "latency_ms": event.latency_ms,
                    },
                )
    except AppError as error:
        # Headers are already sent: the error travels as the last event.
        yield _sse("error", {"code": error.code, "message": error.message})


@router.post(
    "/playground",
    summary="Try a model or a prompt (Server-Sent Events: delta, done, error)",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"text/event-stream": {}}},
        422: {"description": "Missing variables, unknown model..."},
        429: {"description": "Rate limit or monthly budget reached"},
        503: {"description": "Provider not configured"},
    },
)
async def playground(
    data: PlaygroundIn, ctx: StaffContext, session: Session, redis: RedisClient
) -> StreamingResponse:
    ctx.require(Permission.AI_MANAGE)
    # Every check happens before streaming starts, so failures are plain HTTP errors.
    call = await gateway.prepare(
        session,
        redis,
        organization_id=ctx.organization_id,
        user_id=ctx.user.id,
        feature="playground",
        model_id=data.model_id,
        prompt_key=data.prompt_key,
        prompt_version=data.prompt_version,
        system=data.system,
        messages=[ChatMessage("user", data.message)] if data.message.strip() else [],
        variables=data.variables,
        max_tokens=data.max_tokens,
    )
    return StreamingResponse(
        _events(call),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
