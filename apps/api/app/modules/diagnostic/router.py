import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.db.session import get_session
from app.modules.ai_gateway import sse
from app.modules.contact.router import client_key
from app.modules.diagnostic import report_pdf, service
from app.modules.diagnostic.schemas import (
    DiagnosticCreate,
    DiagnosticCreated,
    DiagnosticPage,
    DiagnosticResult,
    Locale,
    QuestionnaireOut,
    Unlock,
)
from app.modules.identity.dependencies import StaffContext

Session = Annotated[AsyncSession, Depends(get_session)]
RedisClient = Annotated[Redis, Depends(get_redis)]
Token = Annotated[str, Query(min_length=20, max_length=100)]

public_router = APIRouter(prefix="/diagnostic", tags=["diagnostic"])
admin_router = APIRouter(
    prefix="/admin/crm/diagnostics",
    tags=["crm-admin"],
    responses={
        401: {"description": "Missing or invalid access token"},
        403: {"description": "The staff role does not allow this action"},
        404: {"description": "Not found, or the user is not DEV4INNOVA staff"},
    },
)

PDF_HEADERS = {"Cache-Control": "private, no-store"}


def _pdf(result: DiagnosticResult) -> Response:
    filename = "diagnostic-ia.pdf" if result.locale == "fr" else "ai-diagnostic.pdf"
    return Response(
        report_pdf.render(result),
        media_type="application/pdf",
        headers={**PDF_HEADERS, "Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Public: questionnaire, result, report (TASK-089 to TASK-094) -----------------------
# The secret token travels in the query string of POST/GET calls made by the web server,
# never in a path that could end up in access logs of intermediaries in clear.


@public_router.get("/questionnaire", response_model=QuestionnaireOut, summary="The questionnaire")
async def get_questionnaire(locale: Locale = "fr") -> QuestionnaireOut:
    return service.questionnaire(locale)


@public_router.post(
    "",
    response_model=DiagnosticCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Submit the answers; returns the secret token of the result",
    responses={
        422: {"description": "Missing or invalid answers"},
        429: {"description": "Too many diagnostics"},
    },
)
async def create_diagnostic(
    data: DiagnosticCreate, request: Request, session: Session, redis: RedisClient
) -> DiagnosticCreated:
    token, _ = await service.create(session, redis, client_key(request), data)
    # Honeypot: a random, unknown token (looks like a success, leads nowhere).
    return DiagnosticCreated(token=token or secrets.token_urlsafe(32))


@public_router.get(
    "/result", response_model=DiagnosticResult, summary="Result (full once unlocked)"
)
async def get_result(token: Token, session: Session) -> DiagnosticResult:
    return service.result_out(await service.by_token(session, token))


@public_router.post(
    "/unlock",
    response_model=DiagnosticResult,
    summary="Leave an email to get the full report (creates the CRM prospect)",
    responses={429: {"description": "Too many attempts"}},
)
async def unlock(
    token: Token, data: Unlock, request: Request, session: Session, redis: RedisClient
) -> DiagnosticResult:
    diagnostic = await service.unlock(session, redis, client_key(request), token, data)
    return service.result_out(diagnostic)


@public_router.post(
    "/analysis",
    summary="Write the personalized AI analysis (Server-Sent Events: delta, done, error)",
    response_class=StreamingResponse,
    responses={
        200: {"content": {"text/event-stream": {}}},
        403: {"description": "Report not unlocked"},
        409: {"description": "Analysis already being written"},
        429: {"description": "Daily limit or budget reached"},
        503: {"description": "AI unavailable"},
    },
)
async def analysis(token: Token, session: Session, redis: RedisClient) -> StreamingResponse:
    prepared = await service.prepare_analysis(session, redis, token)
    return StreamingResponse(
        sse.events(service.stream_analysis(prepared), with_costs=False),
        media_type="text/event-stream",
        headers=sse.SSE_HEADERS,
    )


@public_router.get(
    "/report.pdf",
    summary="Full report as PDF",
    response_class=Response,
    responses={
        200: {"content": {"application/pdf": {}}},
        403: {"description": "Report not unlocked"},
    },
)
async def report(token: Token, session: Session) -> Response:
    result = service.result_out(await service.by_token(session, token))
    if not result.unlocked:
        raise service.LockedError("Leave your email first to get the full report")
    return _pdf(result)


# --- Back office: diagnostics of the prospects (TASK-093, TASK-095) --------------------


@admin_router.get("", response_model=DiagnosticPage, summary="Diagnostics")
async def list_diagnostics(
    ctx: StaffContext,
    session: Session,
    unlocked_only: bool = True,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> DiagnosticPage:
    return await service.list_diagnostics(
        session, ctx, unlocked_only=unlocked_only, page=page, page_size=page_size
    )


@admin_router.get("/{diagnostic_id}", response_model=DiagnosticResult, summary="Full result")
async def get_diagnostic(
    diagnostic_id: uuid.UUID, ctx: StaffContext, session: Session
) -> DiagnosticResult:
    diagnostic = await service.get_for_staff(session, ctx, diagnostic_id)
    return service.result_out(diagnostic, staff=True)


@admin_router.get(
    "/{diagnostic_id}/report.pdf",
    summary="Full report as PDF",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
async def get_report(diagnostic_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
    return _pdf(await get_diagnostic(diagnostic_id, ctx, session))
