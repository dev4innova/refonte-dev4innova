"""The AI Gateway (ADR-0007): the only entry point to AI providers for business code.

`prepare` checks everything before any provider call (rate limit, prompt, model, provider
configuration, monthly budget with the maximum possible cost of the call); `run` streams the
answer and records the usage (tokens, cost, latency, never the content).
"""

import math
import re
import time
import uuid
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, cast

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.db.session import new_session
from app.modules.ai_gateway.models import AIModel, AIQuota, AIUsage, Prompt, PromptVersion
from app.modules.ai_gateway.providers import get_provider
from app.modules.ai_gateway.providers.base import (
    AIProvider,
    ChatMessage,
    CompletionRequest,
    ProviderError,
    ProviderName,
    ProviderNotConfiguredError,
    StopReason,
    TextDelta,
)

VARIABLE = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}")
CHARS_PER_TOKEN_ESTIMATE = 3
"""Conservative: real texts average about 4 characters per token."""
MILLION = Decimal(1_000_000)


class UnprocessableError(AppError):
    status_code = 422
    code = "unprocessable"


class AIUnavailableError(AppError):
    status_code = 503
    code = "ai_unavailable"


class QuotaExceededError(AppError):
    status_code = 429
    code = "ai_quota_exceeded"


class AIProviderFailedError(AppError):
    status_code = 502
    code = "ai_provider_error"


# --- Prompts -----------------------------------------------------------------------


def template_variables(template: str) -> list[str]:
    return list(dict.fromkeys(VARIABLE.findall(template)))


def render(template: str, variables: dict[str, str]) -> str:
    missing = [name for name in template_variables(template) if name not in variables]
    if missing:
        raise UnprocessableError("Missing prompt variables", {"missing_variables": missing})
    return VARIABLE.sub(lambda m: variables[m.group(1)], template)


async def _prompt_version(session: AsyncSession, key: str, version: int | None) -> PromptVersion:
    prompt = await session.scalar(select(Prompt).where(Prompt.key == key))
    if prompt is None:
        raise NotFoundError("Prompt not found", {"prompt_key": key})
    query = select(PromptVersion).where(PromptVersion.prompt_id == prompt.id)
    query = (
        query.where(PromptVersion.version == version)
        if version is not None
        else query.where(PromptVersion.id == prompt.active_version_id)
    )
    found = await session.scalar(query)
    if found is None:
        raise NotFoundError("Prompt version not found", {"prompt_key": key, "version": version})
    return found


# --- Costs and quotas ------------------------------------------------------------------


def cost(model: AIModel, input_tokens: int, output_tokens: int) -> tuple[Decimal, Decimal]:
    """(USD, EUR) of a call, from the registry prices (USD per million tokens)."""
    usd = (
        Decimal(input_tokens) * model.input_price_usd_per_mtok
        + Decimal(output_tokens) * model.output_price_usd_per_mtok
    ) / MILLION
    eur = usd * get_settings().ai_eur_per_usd
    quantum = Decimal("0.000001")
    return usd.quantize(quantum, ROUND_HALF_UP), eur.quantize(quantum, ROUND_HALF_UP)


def month_start(now: datetime | None = None) -> datetime:
    now = now or datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def monthly_budget(session: AsyncSession, organization_id: uuid.UUID) -> Decimal:
    quota = await session.get(AIQuota, organization_id)
    return quota.monthly_budget_eur if quota else get_settings().ai_default_monthly_budget_eur


async def monthly_spend(session: AsyncSession, organization_id: uuid.UUID) -> Decimal:
    spent = await session.scalar(
        select(func.coalesce(func.sum(AIUsage.cost_eur), 0)).where(
            AIUsage.organization_id == organization_id, AIUsage.created_at >= month_start()
        )
    )
    return Decimal(spent or 0)


# --- Calls ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PreparedCall:
    organization_id: uuid.UUID
    user_id: uuid.UUID | None
    feature: str
    model: AIModel
    provider: AIProvider
    request: CompletionRequest
    prompt_key: str | None
    prompt_version: int | None


@dataclass(frozen=True)
class Done:
    input_tokens: int
    output_tokens: int
    cost_eur: Decimal
    stop_reason: StopReason
    served_model: str
    latency_ms: int


GatewayEvent = TextDelta | Done


async def _resolve_model(
    session: AsyncSession, model_id: uuid.UUID | None, prompt_model_id: uuid.UUID | None
) -> AIModel:
    if model_id is not None:
        model = await session.get(AIModel, model_id)
        if model is None or not model.is_enabled:
            raise UnprocessableError("This model is not available", {"field": "model_id"})
        return model
    if prompt_model_id is not None:
        model = await session.get(AIModel, prompt_model_id)
        if model is not None and model.is_enabled:
            return model
    model = await session.scalar(
        select(AIModel).where(AIModel.is_default.is_(True), AIModel.is_enabled.is_(True))
    )
    if model is None:
        raise AIUnavailableError("No default AI model is enabled")
    return model


async def prepare(
    session: AsyncSession,
    redis: Redis,
    *,
    organization_id: uuid.UUID,
    user_id: uuid.UUID | None,
    feature: str,
    model_id: uuid.UUID | None = None,
    prompt_key: str | None = None,
    prompt_version: int | None = None,
    system: str | None = None,
    messages: Sequence[ChatMessage] = (),
    variables: dict[str, str] | None = None,
    max_tokens: int | None = None,
) -> PreparedCall:
    settings = get_settings()
    if user_id is not None:
        await rate_limit.hit(
            redis,
            scope="ai:user",
            key=str(user_id),
            limit=settings.ai_user_requests_per_minute,
            window_seconds=60,
        )

    version = await _prompt_version(session, prompt_key, prompt_version) if prompt_key else None
    conversation = list(messages)
    if version is not None and version.template:
        conversation.append(ChatMessage("user", render(version.template, variables or {})))
    if not conversation or conversation[-1].role != "user" or not conversation[-1].content.strip():
        raise UnprocessableError(
            "The conversation must end with a user message", {"field": "message"}
        )

    model = await _resolve_model(session, model_id, version.model_id if version else None)
    try:
        provider = get_provider(cast(ProviderName, model.provider))
    except ProviderNotConfiguredError as error:
        raise AIUnavailableError(
            "This AI provider is not configured", {"provider": model.provider}
        ) from error

    limit = max_tokens or (version.max_tokens if version else None) or model.max_output_tokens
    request = CompletionRequest(
        model=model.model_id,
        system=version.system if version else (system or ""),
        messages=conversation,
        max_tokens=min(limit, model.max_output_tokens),
        options=dict(model.options),
    )

    # Budget: the call is refused if its maximum possible cost would exceed what is left.
    characters = len(request.system) + sum(len(m.content) for m in request.messages)
    _, worst_case = cost(
        model, math.ceil(characters / CHARS_PER_TOKEN_ESTIMATE), request.max_tokens
    )
    budget = await monthly_budget(session, organization_id)
    spent = await monthly_spend(session, organization_id)
    if spent + worst_case > budget:
        raise QuotaExceededError(
            "The monthly AI budget of this organization is reached",
            {"budget_eur": str(budget), "spent_eur": str(spent.quantize(Decimal("0.01")))},
        )

    return PreparedCall(
        organization_id=organization_id,
        user_id=user_id,
        feature=feature,
        model=model,
        provider=provider,
        request=request,
        prompt_key=prompt_key,
        prompt_version=version.version if version else None,
    )


async def _record(call: PreparedCall, **values: Any) -> None:
    async with new_session() as session:
        session.add(
            AIUsage(
                organization_id=call.organization_id,
                user_id=call.user_id,
                model_id=call.model.id,
                provider=call.model.provider,
                model=call.model.model_id,
                feature=call.feature,
                prompt_key=call.prompt_key,
                prompt_version=call.prompt_version,
                **values,
            )
        )
        await session.commit()


async def run(call: PreparedCall) -> AsyncIterator[GatewayEvent]:
    """Streams the answer, then one `Done`; records the usage either way."""
    started = time.monotonic()
    try:
        async for event in call.provider.stream(call.request):
            if isinstance(event, TextDelta):
                yield event
                continue
            latency = int((time.monotonic() - started) * 1000)
            usd, eur = cost(call.model, event.usage.input_tokens, event.usage.output_tokens)
            await _record(
                call,
                status="refused" if event.stop_reason == "refusal" else "ok",
                served_model=event.served_model,
                input_tokens=event.usage.input_tokens,
                output_tokens=event.usage.output_tokens,
                cost_usd=usd,
                cost_eur=eur,
                latency_ms=latency,
            )
            yield Done(
                input_tokens=event.usage.input_tokens,
                output_tokens=event.usage.output_tokens,
                cost_eur=eur,
                stop_reason=event.stop_reason,
                served_model=event.served_model,
                latency_ms=latency,
            )
    except ProviderError as error:
        await _record(
            call,
            status="error",
            error_code=error.code,
            latency_ms=int((time.monotonic() - started) * 1000),
        )
        failure = AIUnavailableError if error.retryable else AIProviderFailedError
        raise failure(
            "The AI provider could not answer", {"provider": error.provider, "reason": error.code}
        ) from error


@dataclass(frozen=True)
class Answer:
    text: str
    done: Done


async def complete(call: PreparedCall) -> Answer:
    """Non-streaming helper for business modules (EPIC 09-10)."""
    parts: list[str] = []
    async for event in run(call):
        if isinstance(event, TextDelta):
            parts.append(event.text)
        else:
            return Answer("".join(parts), event)
    raise AIUnavailableError("The AI provider could not answer")
