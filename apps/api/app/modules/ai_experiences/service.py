"""AI experiences (TASK-083 to TASK-088): sessions private to their author, inside an
organization, on top of the AI Gateway (budgets, rate limits, usage records)."""

import asyncio
import uuid
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from redis.asyncio import Redis
from sqlalchemy import ColumnElement, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.db.session import new_session
from app.modules.ai_experiences.documents import extract_text
from app.modules.ai_experiences.models import AIMessage, AISession
from app.modules.ai_experiences.schemas import (
    ContentSessionCreate,
    FeatureUsage,
    MessageOut,
    OrganizationAIUsage,
    SessionOut,
    SessionPage,
    SessionSummary,
)
from app.modules.ai_gateway import gateway
from app.modules.ai_gateway.models import AIUsage
from app.modules.ai_gateway.providers.base import ChatMessage, TextDelta
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext

PROMPTS = {
    "assistant": "assistant.default",
    "document": "document.analyze",
    "content": "content.generate",
}
HISTORY_LIMIT = 30
"""Messages replayed to the model: older ones are left out (cost and context bound)."""

# Values given to the content generator prompt (the model works best with descriptions).
FORMATS = {
    "blog_post": "blog article with a title and subheadings",
    "linkedin_post": "LinkedIn post",
    "newsletter": "newsletter section",
    "product_description": "product or service description",
    "email": "professional email with a subject line",
}
TONES = {
    "professional": "professional",
    "friendly": "warm and friendly",
    "inspiring": "inspiring",
    "didactic": "educational and clear",
}
LANGUAGES = {"fr": "French", "en": "English"}
LENGTHS = {
    "short": "short (about 100 words)",
    "medium": "medium (about 300 words)",
    "long": "long (about 700 words)",
}


class DailyLimitError(AppError):
    status_code = 429
    code = "ai_daily_limit"


class UnprocessableError(AppError):
    status_code = 422
    code = "unprocessable"


def _now() -> datetime:
    return datetime.now(UTC)


# --- Sessions (TASK-086, TASK-087) ---------------------------------------------------


def _scope(ctx: OrganizationContext) -> tuple[ColumnElement[bool], ColumnElement[bool]]:
    """Private sessions: the organization AND the author, always."""
    return (
        AISession.organization_id == ctx.organization_id,
        AISession.user_id == ctx.user.id,
    )


async def list_sessions(
    session: AsyncSession, ctx: OrganizationContext, *, page: int, page_size: int
) -> SessionPage:
    ctx.require(Permission.AI_USE)
    scope = _scope(ctx)
    total = await session.scalar(select(func.count()).select_from(AISession).where(*scope)) or 0
    items = await session.scalars(
        select(AISession)
        .where(*scope)
        .order_by(AISession.last_activity_at.desc(), AISession.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return SessionPage(
        items=[SessionSummary.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )


async def _get(
    session: AsyncSession, ctx: OrganizationContext, session_id: uuid.UUID, *, lock: bool = False
) -> AISession:
    ctx.require(Permission.AI_USE)
    query = select(AISession).where(AISession.id == session_id, *_scope(ctx))
    found = await session.scalar(query.with_for_update() if lock else query)
    if found is None:
        raise NotFoundError("Session not found")
    return found


async def _messages(session: AsyncSession, ai_session: AISession) -> Sequence[AIMessage]:
    return (
        await session.scalars(
            select(AIMessage)
            .where(
                AIMessage.session_id == ai_session.id,
                AIMessage.organization_id == ai_session.organization_id,
            )
            .order_by(AIMessage.created_at, AIMessage.id)
        )
    ).all()


async def session_out(
    session: AsyncSession, ctx: OrganizationContext, session_id: uuid.UUID
) -> SessionOut:
    ai_session = await _get(session, ctx, session_id)
    messages = await _messages(session, ai_session)
    return SessionOut(
        **SessionSummary.model_validate(ai_session).model_dump(),
        options={k: str(v) for k, v in ai_session.options.items()},
        document_chars=len(ai_session.document_text) if ai_session.document_text else None,
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                text=m.display if m.display is not None else m.content,
                status=m.status,
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


def _new_session(ctx: OrganizationContext, kind: str, title: str, **values: object) -> AISession:
    return AISession(
        organization_id=ctx.organization_id,
        user_id=ctx.user.id,
        kind=kind,
        title=title,
        last_activity_at=_now(),
        **values,
    )


async def create_assistant_session(
    session: AsyncSession, ctx: OrganizationContext, title: str
) -> uuid.UUID:
    ctx.require(Permission.AI_USE)
    ai_session = _new_session(ctx, "assistant", title.strip())
    session.add(ai_session)
    await session.commit()
    return ai_session.id


async def create_document_session(
    session: AsyncSession, redis: Redis, ctx: OrganizationContext, filename: str, data: bytes
) -> uuid.UUID:
    ctx.require(Permission.AI_USE)
    await _count_daily(redis, ctx)
    document = await asyncio.to_thread(extract_text, data)
    name = (filename or "document").strip()[:255]
    ai_session = _new_session(
        ctx, "document", name[:200], document_name=name, document_text=document.text
    )
    session.add(ai_session)
    await session.commit()
    return ai_session.id


async def create_content_session(
    session: AsyncSession, ctx: OrganizationContext, data: ContentSessionCreate
) -> uuid.UUID:
    ctx.require(Permission.AI_USE)
    options = data.model_dump(include={"format", "tone", "language", "length"})
    ai_session = _new_session(
        ctx,
        "content",
        data.topic[:200],
        options={**options, "topic": data.topic, "details": data.details},
    )
    session.add(ai_session)
    await session.commit()
    return ai_session.id


async def rename_session(
    session: AsyncSession, ctx: OrganizationContext, session_id: uuid.UUID, title: str
) -> None:
    ai_session = await _get(session, ctx, session_id, lock=True)
    ai_session.title = title.strip()
    await session.commit()


async def delete_session(
    session: AsyncSession, ctx: OrganizationContext, session_id: uuid.UUID
) -> None:
    ai_session = await _get(session, ctx, session_id, lock=True)
    await session.delete(ai_session)
    await session.commit()


async def delete_all_sessions(session: AsyncSession, ctx: OrganizationContext) -> int:
    ctx.require(Permission.AI_USE)
    result = await session.execute(delete(AISession).where(*_scope(ctx)))
    await session.commit()
    return int(result.rowcount or 0)  # type: ignore[attr-defined]


async def purge_inactive_sessions(session: AsyncSession, days: int | None = None) -> int:
    """Retention (TASK-087): deletes sessions inactive for longer than the retention period."""
    cutoff = _now() - timedelta(days=days or get_settings().ai_session_retention_days)
    result = await session.execute(delete(AISession).where(AISession.last_activity_at < cutoff))
    await session.commit()
    return int(result.rowcount or 0)  # type: ignore[attr-defined]


# --- Messages (TASK-083 to TASK-085, TASK-088) --------------------------------------


async def _count_daily(redis: Redis, ctx: OrganizationContext) -> None:
    """Abuse limit: messages and documents per user and per day, all organizations."""
    settings = get_settings()
    key = f"d4i:{settings.app_env}:ai:daily:{ctx.user.id}:{_now():%Y%m%d}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60 * 60 * 25)
    if count > settings.ai_daily_messages_per_user:
        raise DailyLimitError(
            "Daily AI limit reached, please come back tomorrow",
            {"limit": settings.ai_daily_messages_per_user},
        )


def _document_block(ai_session: AISession) -> str:
    # The document is data: it is delimited and the instructions say to ignore any order
    # it contains (prompt injection defense).
    return (
        f'<document name="{ai_session.document_name}">\n{ai_session.document_text}\n</document>\n\n'
    )


def _conversation(ai_session: AISession, history: Sequence[AIMessage]) -> list[ChatMessage]:
    usable = [m for m in history if m.role == "user" or m.status in ("ok", "incomplete")]
    recent = usable[-HISTORY_LIMIT:]
    messages: list[ChatMessage] = []
    for index, message in enumerate(recent):
        content = message.content
        if ai_session.kind == "document" and index == 0 and message.role == "user":
            content = _document_block(ai_session) + content
        messages.append(ChatMessage(message.role, content))  # type: ignore[arg-type]
    if ai_session.kind == "document" and recent and recent[0].role != "user":
        messages.insert(0, ChatMessage("user", _document_block(ai_session)))
    return messages


async def _content_request(session: AsyncSession, ai_session: AISession) -> str:
    options = ai_session.options
    return await gateway.render_prompt_template(
        session,
        PROMPTS["content"],
        {
            "format": FORMATS[options["format"]],
            "tone": TONES[options["tone"]],
            "language": LANGUAGES[options["language"]],
            "length": LENGTHS[options["length"]],
            "topic": options["topic"],
            "details": options.get("details") or "-",
        },
    )


@dataclass(frozen=True)
class PreparedMessage:
    call: gateway.PreparedCall
    session_id: uuid.UUID
    organization_id: uuid.UUID


async def prepare_message(
    session: AsyncSession,
    redis: Redis,
    ctx: OrganizationContext,
    session_id: uuid.UUID,
    text: str,
) -> PreparedMessage:
    """Checks everything, records the user's message, prepares the gateway call."""
    ai_session = await _get(session, ctx, session_id, lock=True)
    history = await _messages(session, ai_session)
    text = text.strip()
    first_content_turn = ai_session.kind == "content" and not history
    if not text and not first_content_turn:
        raise UnprocessableError("The message is empty", {"field": "text"})
    await _count_daily(redis, ctx)

    if first_content_turn:
        content, display = await _content_request(session, ai_session), ai_session.options["topic"]
    else:
        content, display = text, None
    user_message = AIMessage(
        session_id=ai_session.id,
        organization_id=ai_session.organization_id,
        role="user",
        content=content,
        display=display,
    )
    conversation = _conversation(ai_session, [*history, user_message])
    call = await gateway.prepare(
        session,
        redis,
        organization_id=ctx.organization_id,
        user_id=ctx.user.id,
        feature=ai_session.kind,
        prompt_key=PROMPTS[ai_session.kind],
        messages=conversation,
        append_template=False,  # the generator's request is the first turn, built above
    )
    # Recorded only once every check passed (budget, rate limits, configuration).
    session.add(user_message)
    ai_session.last_activity_at = _now()
    if not ai_session.title:
        ai_session.title = text[:80]
    await session.commit()
    return PreparedMessage(
        call=call, session_id=ai_session.id, organization_id=ai_session.organization_id
    )


_STATUS = {"end": "ok", "refusal": "refused", "max_tokens": "incomplete", "other": "ok"}


async def stream_answer(prepared: PreparedMessage) -> AsyncIterator[TextDelta | gateway.Done]:
    """Streams the answer and records it, complete or not."""
    parts: list[str] = []
    try:
        async for event in gateway.run(prepared.call):
            if isinstance(event, TextDelta):
                parts.append(event.text)
            else:
                await _save_answer(
                    prepared,
                    "".join(parts),
                    _STATUS[event.stop_reason],
                    event.input_tokens,
                    event.output_tokens,
                    event.cost_eur,
                )
            yield event
    except AppError:
        await _save_answer(prepared, "".join(parts), "error", 0, 0, Decimal(0))
        raise


async def _save_answer(
    prepared: PreparedMessage,
    text: str,
    status: str,
    input_tokens: int,
    output_tokens: int,
    cost_eur: Decimal,
) -> None:
    async with new_session() as session:
        session.add(
            AIMessage(
                session_id=prepared.session_id,
                organization_id=prepared.organization_id,
                role="assistant",
                content=text,
                status=status,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_eur=cost_eur,
            )
        )
        ai_session = await session.get(AISession, prepared.session_id)
        if ai_session is not None:
            ai_session.last_activity_at = _now()
        await session.commit()


# --- Organization usage (owners and admins) -----------------------------------------


async def organization_usage(
    session: AsyncSession, ctx: OrganizationContext
) -> OrganizationAIUsage:
    ctx.require(Permission.AI_USAGE_READ)
    since = gateway.month_start()
    rows = await session.execute(
        select(AIUsage.feature, func.count(), func.coalesce(func.sum(AIUsage.cost_eur), 0))
        .where(AIUsage.organization_id == ctx.organization_id, AIUsage.created_at >= since)
        .group_by(AIUsage.feature)
        .order_by(AIUsage.feature)
    )
    features = [
        FeatureUsage(feature=feature, calls=calls, cost_eur=Decimal(cost).quantize(Decimal("0.01")))
        for feature, calls, cost in rows
    ]
    spent = await gateway.monthly_spend(session, ctx.organization_id)
    return OrganizationAIUsage(
        month=since.strftime("%Y-%m"),
        monthly_budget_eur=await gateway.monthly_budget(session, ctx.organization_id),
        spent_eur=spent.quantize(Decimal("0.01")),
        calls=sum(f.calls for f in features),
        features=features,
    )
