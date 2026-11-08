"""AI business diagnostic (TASK-089 to TASK-095)."""

import hashlib
import secrets
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.config import get_settings
from app.core.errors import AppError, ConflictError, NotFoundError
from app.db.session import new_session
from app.modules.ai_gateway import gateway
from app.modules.ai_gateway.providers.base import TextDelta
from app.modules.crm.service import record_inbound
from app.modules.diagnostic import questionnaire as q
from app.modules.diagnostic.models import Diagnostic
from app.modules.diagnostic.schemas import (
    DiagnosticCreate,
    DiagnosticPage,
    DiagnosticResult,
    DiagnosticSummary,
    DimensionOut,
    DimensionScore,
    OptionOut,
    ProfileFieldOut,
    QuestionnaireOut,
    QuestionOut,
    RecommendationOut,
    Report,
    Unlock,
)
from app.modules.diagnostic.scoring import (
    InvalidAnswersError,
    Recommendation,
    level_texts,
    priorities,
    recommendations,
    score,
)
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext

PROMPT_KEY = "diagnostic.analysis"
CREATE_LIMIT, UNLOCK_LIMIT, WINDOW = 10, 5, 3600
ANALYSIS_TIMEOUT = timedelta(minutes=3)
"""A pending analysis older than this is considered abandoned and may be restarted."""


class UnprocessableError(AppError):
    status_code = 422
    code = "unprocessable"


class LockedError(AppError):
    status_code = 403
    code = "diagnostic_locked"


class DailyLimitError(AppError):
    status_code = 429
    code = "diagnostic_daily_limit"


def _now() -> datetime:
    return datetime.now(UTC)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --- Questionnaire (TASK-089) --------------------------------------------------------


def questionnaire(locale: q.Locale) -> QuestionnaireOut:
    return QuestionnaireOut(
        version=q.VERSION,
        profile=[
            ProfileFieldOut(
                id=field,
                label=label.get(locale),
                options=[OptionOut(id=value, label=text.get(locale)) for value, text in options],
            )
            for field, (label, options) in q.PROFILE.items()
        ],
        dimensions=[
            DimensionOut(
                id=d.id,
                label=d.label.get(locale),
                description=d.description.get(locale),
                questions=[
                    QuestionOut(
                        id=question.id,
                        label=question.label.get(locale),
                        options=[
                            OptionOut(id=o.id, label=o.label.get(locale)) for o in question.options
                        ],
                    )
                    for question in d.questions
                ],
            )
            for d in q.DIMENSIONS
        ],
    )


# --- Results (TASK-090, TASK-091, TASK-093) ------------------------------------------


def _recommendation(r: Recommendation, locale: q.Locale, *, full: bool) -> RecommendationOut:
    return RecommendationOut(
        id=r.id,
        dimension=r.dimension,
        title=r.title.get(locale),
        text=r.text.get(locale) if full else None,
        horizon=r.horizon,
        service=r.service,
    )


def result_out(diagnostic: Diagnostic, *, staff: bool = False) -> DiagnosticResult:
    """The full report once unlocked; staff always see it (to prepare a call)."""
    locale: q.Locale = "en" if diagnostic.locale == "en" else "fr"
    label, description = level_texts(diagnostic.level)  # type: ignore[arg-type]
    unlocked = diagnostic.unlocked_at is not None
    full = unlocked or staff
    labels = {d.id: d.label.get(locale) for d in q.DIMENSIONS}
    return DiagnosticResult(
        id=diagnostic.id,
        created_at=diagnostic.created_at,
        locale=locale,
        questionnaire_version=diagnostic.questionnaire_version,
        overall_score=diagnostic.overall_score,
        level=diagnostic.level,
        level_label=label.get(locale),
        level_description=description.get(locale),
        dimensions=[
            DimensionScore(id=d, label=labels.get(d, d), score=value)
            for d, value in diagnostic.scores.items()
        ],
        priorities=[_recommendation(r, locale, full=full) for r in priorities(diagnostic.scores)],
        unlocked=unlocked,
        report=Report(
            recommendations=[
                _recommendation(r, locale, full=True) for r in recommendations(diagnostic.scores)
            ],
            ai_status=diagnostic.ai_status,
            ai_analysis=diagnostic.ai_analysis,
            company=diagnostic.contact_company,
        )
        if full
        else None,
    )


async def create(
    session: AsyncSession, redis: Redis, client: str, data: DiagnosticCreate
) -> tuple[str | None, Diagnostic | None]:
    """Scores the answers and stores them. Returns the secret token (None for bots)."""
    await rate_limit.hit(
        redis, scope="diagnostic:create", key=client, limit=CREATE_LIMIT, window_seconds=WINDOW
    )
    try:
        scores = score(data.answers)
    except InvalidAnswersError as error:
        raise UnprocessableError(
            "Every question needs one of its answers",
            {"missing": error.missing, "invalid": error.invalid},
        ) from error
    profile = {}
    for field, value in data.profile.items():
        allowed = {v for v, _ in q.PROFILE.get(field, (None, ()))[1]}
        if value not in allowed:
            raise UnprocessableError("Unknown profile value", {"field": field})
        profile[field] = value
    if data.website:
        return None, None  # honeypot: looks like a success, stores nothing
    token = secrets.token_urlsafe(32)
    diagnostic = Diagnostic(
        organization_id=INTERNAL_ORGANIZATION_ID,
        token_hash=_hash(token),
        questionnaire_version=q.VERSION,
        locale=data.locale,
        answers=data.answers,
        profile=profile,
        scores=scores.dimensions,
        overall_score=scores.overall,
        level=scores.level,
    )
    session.add(diagnostic)
    await session.commit()
    return token, diagnostic


async def by_token(session: AsyncSession, token: str, *, lock: bool = False) -> Diagnostic:
    query = select(Diagnostic).where(Diagnostic.token_hash == _hash(token))
    diagnostic = await session.scalar(query.with_for_update() if lock else query)
    if diagnostic is None:
        raise NotFoundError("Diagnostic not found")
    return diagnostic


# --- Full report and CRM (TASK-093, TASK-095) ----------------------------------------


async def unlock(
    session: AsyncSession, redis: Redis, client: str, token: str, data: Unlock
) -> Diagnostic:
    await rate_limit.hit(
        redis, scope="diagnostic:unlock", key=client, limit=UNLOCK_LIMIT, window_seconds=WINDOW
    )
    diagnostic = await by_token(session, token, lock=True)
    if data.website or diagnostic.unlocked_at is not None:
        return diagnostic  # honeypot, or already unlocked: nothing new to record
    email = data.email.lower()
    locale: q.Locale = "en" if diagnostic.locale == "en" else "fr"
    label, _ = level_texts(diagnostic.level)  # type: ignore[arg-type]
    lead = await record_inbound(
        session,
        email=email,
        name=data.name,
        company=data.company,
        locale=diagnostic.locale,
        source="diagnostic",
        activity_type="diagnostic",
        body="",
        details={
            "diagnostic_id": str(diagnostic.id),
            "score": diagnostic.overall_score,
            "level": diagnostic.level,
            "level_label": label.get(locale),
            "scores": diagnostic.scores,
            "profile": diagnostic.profile,
        },
    )
    diagnostic.contact_name = data.name
    diagnostic.contact_email = email
    diagnostic.contact_company = data.company
    diagnostic.consent_at = diagnostic.unlocked_at = _now()
    diagnostic.lead_id = lead.id
    await session.commit()
    return diagnostic


# --- AI analysis (TASK-092) ----------------------------------------------------------


def _prompt_variables(diagnostic: Diagnostic) -> dict[str, str]:
    locale: q.Locale = "en" if diagnostic.locale == "en" else "fr"
    label, _ = level_texts(diagnostic.level)  # type: ignore[arg-type]
    profile_lines = []
    for field, (field_label, options) in q.PROFILE.items():
        value = diagnostic.profile.get(field)
        text = next((t.get(locale) for v, t in options if v == value), "-")
        profile_lines.append(f"{field_label.get(locale)}: {text}")
    score_lines = [f"Overall: {diagnostic.overall_score}/100 ({label.get(locale)})"]
    answer_lines = []
    for dimension in q.DIMENSIONS:
        score_lines.append(
            f"- {dimension.label.get(locale)}: {diagnostic.scores.get(dimension.id, 0)}/100"
        )
        answer_lines.append(f"{dimension.label.get(locale)}:")
        for question in dimension.questions:
            option = q.OPTIONS.get(diagnostic.answers.get(question.id, ""))
            answer_lines.append(
                f"- {question.label.get(locale)} {option.label.get(locale) if option else '-'}"
            )
    return {
        "language": "French" if locale == "fr" else "English",
        "profile": "\n".join(profile_lines),
        "scores": "\n".join(score_lines),
        "answers": "\n".join(answer_lines),
        "recommendations": "\n".join(
            f"- {r.title.get(locale)}" for r in recommendations(diagnostic.scores)
        ),
    }


@dataclass(frozen=True)
class AnalysisCall:
    diagnostic_id: uuid.UUID
    call: gateway.PreparedCall | None
    """None when the analysis already exists: it is replayed."""
    existing: str | None = None


async def prepare_analysis(session: AsyncSession, redis: Redis, token: str) -> AnalysisCall:
    diagnostic = await by_token(session, token, lock=True)
    if diagnostic.unlocked_at is None:
        raise LockedError("Leave your email first to get the full report")
    if diagnostic.ai_status == "done" and diagnostic.ai_analysis:
        return AnalysisCall(diagnostic.id, None, diagnostic.ai_analysis)
    if (
        diagnostic.ai_status == "pending"
        and diagnostic.ai_started_at
        and diagnostic.ai_started_at > _now() - ANALYSIS_TIMEOUT
    ):
        raise ConflictError("The analysis is already being written")

    # Abuse limit: public analyses per day, all respondents together (DEV4INNOVA pays them).
    settings = get_settings()
    key = f"d4i:{settings.app_env}:diagnostic:analyses:{_now():%Y%m%d}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60 * 60 * 25)
    if count > settings.ai_diagnostic_daily_analyses:
        raise DailyLimitError("Too many analyses today, please try again tomorrow")

    call = await gateway.prepare(
        session,
        redis,
        organization_id=INTERNAL_ORGANIZATION_ID,
        user_id=None,
        feature="diagnostic",
        prompt_key=PROMPT_KEY,
        variables=_prompt_variables(diagnostic),
    )
    diagnostic.ai_status = "pending"
    diagnostic.ai_started_at = _now()
    await session.commit()
    return AnalysisCall(diagnostic.id, call)


async def stream_analysis(prepared: AnalysisCall) -> AsyncIterator[TextDelta | gateway.Done]:
    if prepared.call is None:
        yield TextDelta(prepared.existing or "")
        yield gateway.Done(0, 0, Decimal(0), "end", "", 0)
        return
    parts: list[str] = []
    try:
        async for event in gateway.run(prepared.call):
            if isinstance(event, TextDelta):
                parts.append(event.text)
            else:
                ok = event.stop_reason in ("end", "max_tokens") and parts
                await _save_analysis(prepared.diagnostic_id, "".join(parts) if ok else None)
            yield event
    except AppError:
        await _save_analysis(prepared.diagnostic_id, None)
        raise


async def _save_analysis(diagnostic_id: uuid.UUID, text: str | None) -> None:
    async with new_session() as session:
        diagnostic = await session.get(Diagnostic, diagnostic_id)
        if diagnostic is not None:
            diagnostic.ai_status = "done" if text else "error"
            diagnostic.ai_analysis = text
            await session.commit()


# --- Back office (TASK-093, TASK-095) ------------------------------------------------


async def list_diagnostics(
    session: AsyncSession,
    ctx: OrganizationContext,
    *,
    unlocked_only: bool,
    page: int,
    page_size: int,
) -> DiagnosticPage:
    ctx.require(Permission.CRM_READ)
    query = select(Diagnostic).where(Diagnostic.organization_id == ctx.organization_id)
    if unlocked_only:
        query = query.where(Diagnostic.unlocked_at.is_not(None))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.scalars(
        query.order_by(Diagnostic.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return DiagnosticPage(
        items=[
            DiagnosticSummary(
                id=d.id,
                created_at=d.created_at,
                locale=d.locale,
                overall_score=d.overall_score,
                level=d.level,
                unlocked=d.unlocked_at is not None,
                contact_name=d.contact_name,
                contact_email=d.contact_email,
                contact_company=d.contact_company,
                sector=d.profile.get("sector"),
                size=d.profile.get("size"),
                lead_id=d.lead_id,
                ai_status=d.ai_status,
            )
            for d in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_for_staff(
    session: AsyncSession, ctx: OrganizationContext, diagnostic_id: uuid.UUID
) -> Diagnostic:
    ctx.require(Permission.CRM_READ)
    diagnostic = await session.scalar(
        select(Diagnostic).where(
            Diagnostic.id == diagnostic_id, Diagnostic.organization_id == ctx.organization_id
        )
    )
    if diagnostic is None:
        raise NotFoundError("Diagnostic not found")
    return diagnostic


async def purge_anonymous(session: AsyncSession, days: int = 30) -> int:
    """Diagnostics never unlocked hold no contact: kept 30 days for statistics, then deleted."""
    from sqlalchemy import delete

    result = await session.execute(
        delete(Diagnostic).where(
            Diagnostic.unlocked_at.is_(None), Diagnostic.created_at < _now() - timedelta(days=days)
        )
    )
    await session.commit()
    return int(result.rowcount or 0)  # type: ignore[attr-defined]
