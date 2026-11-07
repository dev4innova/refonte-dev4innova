import hashlib
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.redis import get_redis
from app.db.session import get_session
from app.modules.contact.router import client_key
from app.modules.crm import service
from app.modules.crm.schemas import (
    ActivityCreate,
    Dashboard,
    Inbox,
    LeadCreate,
    LeadDetail,
    LeadPage,
    LeadStatus,
    LeadUpdate,
    OpportunityCreate,
    OpportunityOut,
    OpportunityUpdate,
    OwnerFilter,
    OwnerUpdate,
    Person,
    QuoteRequestAccepted,
    QuoteRequestCreate,
    QuoteRequestOut,
    QuoteRequestUpdate,
    QuoteStatus,
)
from app.modules.identity.dependencies import StaffContext

Session = Annotated[AsyncSession, Depends(get_session)]

STAFF_ERRORS: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing or invalid access token"},
    403: {"description": "The staff role does not allow this action"},
    404: {"description": "Not found, or the user is not DEV4INNOVA staff"},
}

admin_router = APIRouter(prefix="/admin/crm", tags=["crm-admin"], responses=STAFF_ERRORS)
public_router = APIRouter(prefix="/quote-requests", tags=["crm"])

PER_CLIENT_LIMIT = 5
PER_EMAIL_LIMIT = 3
WINDOW_SECONDS = 3600


# --- Prospects (TASK-067, TASK-068, TASK-070) ----------------------------------------


@admin_router.get("/leads", response_model=LeadPage, summary="Search prospects")
async def list_leads(
    ctx: StaffContext,
    session: Session,
    lead_status: Annotated[LeadStatus | None, Query(alias="status")] = None,
    owner: OwnerFilter = "any",
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
) -> LeadPage:
    return await service.list_leads(
        session, ctx, status=lead_status, owner=owner, q=q, page=page, page_size=page_size
    )


@admin_router.post(
    "/leads",
    response_model=LeadDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a prospect",
    responses={409: {"description": "A prospect already uses this email address"}},
)
async def create_lead(data: LeadCreate, ctx: StaffContext, session: Session) -> LeadDetail:
    lead = await service.create_lead(session, ctx, data)
    return await service.lead_detail(session, ctx, lead.id)


@admin_router.get("/leads/{lead_id}", response_model=LeadDetail, summary="Prospect and history")
async def get_lead(lead_id: uuid.UUID, ctx: StaffContext, session: Session) -> LeadDetail:
    return await service.lead_detail(session, ctx, lead_id)


@admin_router.patch("/leads/{lead_id}", response_model=LeadDetail, summary="Update a prospect")
async def update_lead(
    lead_id: uuid.UUID, data: LeadUpdate, ctx: StaffContext, session: Session
) -> LeadDetail:
    await service.update_lead(session, ctx, lead_id, data)
    return await service.lead_detail(session, ctx, lead_id)


@admin_router.put(
    "/leads/{lead_id}/owner",
    response_model=LeadDetail,
    summary="Assign a prospect to a sales person (or unassign it)",
    responses={422: {"description": "This person cannot be assigned prospects"}},
)
async def set_owner(
    lead_id: uuid.UUID, data: OwnerUpdate, ctx: StaffContext, session: Session
) -> LeadDetail:
    await service.set_owner(session, ctx, lead_id, data.owner_id)
    return await service.lead_detail(session, ctx, lead_id)


@admin_router.post(
    "/leads/{lead_id}/activities",
    response_model=LeadDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Log a note, call, email or meeting",
)
async def add_activity(
    lead_id: uuid.UUID, data: ActivityCreate, ctx: StaffContext, session: Session
) -> LeadDetail:
    await service.add_activity(session, ctx, lead_id, data)
    return await service.lead_detail(session, ctx, lead_id)


@admin_router.delete(
    "/leads/{lead_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Erase a prospect and its history (GDPR)",
)
async def delete_lead(lead_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
    await service.delete_lead(session, ctx, lead_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.get("/team", response_model=list[Person], summary="Staff who can own prospects")
async def list_team(ctx: StaffContext, session: Session) -> list[Person]:
    return await service.list_team(session, ctx)


# --- Pipeline (TASK-069) -------------------------------------------------------------


@admin_router.get(
    "/opportunities", response_model=list[OpportunityOut], summary="Pipeline opportunities"
)
async def list_opportunities(
    ctx: StaffContext,
    session: Session,
    owner: OwnerFilter = "any",
    closed_within_days: Annotated[int, Query(ge=0, le=365)] = 30,
) -> list[OpportunityOut]:
    return await service.list_opportunities(
        session, ctx, owner=owner, closed_within_days=closed_within_days
    )


@admin_router.post(
    "/opportunities",
    response_model=OpportunityOut,
    status_code=status.HTTP_201_CREATED,
    summary="Open an opportunity for a prospect",
)
async def create_opportunity(
    data: OpportunityCreate, ctx: StaffContext, session: Session
) -> OpportunityOut:
    opportunity_id = await service.create_opportunity(session, ctx, data)
    return await service.opportunity_out(session, ctx, opportunity_id)


@admin_router.patch(
    "/opportunities/{opportunity_id}",
    response_model=OpportunityOut,
    summary="Update an opportunity or move it to another stage",
)
async def update_opportunity(
    opportunity_id: uuid.UUID, data: OpportunityUpdate, ctx: StaffContext, session: Session
) -> OpportunityOut:
    await service.update_opportunity(session, ctx, opportunity_id, data)
    return await service.opportunity_out(session, ctx, opportunity_id)


# --- Quote requests (TASK-072) -------------------------------------------------------


@admin_router.get("/quote-requests", response_model=list[QuoteRequestOut], summary="Quotes")
async def list_quote_requests(
    ctx: StaffContext,
    session: Session,
    quote_status: Annotated[QuoteStatus | None, Query(alias="status")] = None,
) -> list[QuoteRequestOut]:
    return await service.list_quote_requests(session, ctx, status=quote_status)


@admin_router.patch(
    "/quote-requests/{quote_id}", response_model=QuoteRequestOut, summary="Follow up a quote"
)
async def update_quote_request(
    quote_id: uuid.UUID, data: QuoteRequestUpdate, ctx: StaffContext, session: Session
) -> QuoteRequestOut:
    return await service.update_quote_request(session, ctx, quote_id, data.status)


# --- Dashboard (TASK-071) ------------------------------------------------------------


@admin_router.get("/dashboard", response_model=Dashboard, summary="Sales dashboard")
async def dashboard(ctx: StaffContext, session: Session) -> Dashboard:
    return await service.dashboard(session, ctx)


@admin_router.get("/inbox", response_model=Inbox, summary="New prospects and quote requests")
async def inbox(ctx: StaffContext, session: Session) -> Inbox:
    return await service.inbox(session, ctx)


# --- Public form ---------------------------------------------------------------------


@public_router.post(
    "",
    response_model=QuoteRequestAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ask for a quote from the website (public)",
    responses={429: {"description": "Too many requests from this client or email"}},
)
async def create_quote_request(
    data: QuoteRequestCreate,
    request: Request,
    session: Session,
    redis: Annotated[Redis, Depends(get_redis)],
) -> QuoteRequestAccepted:
    await rate_limit.hit(
        redis,
        scope="quote:client",
        key=client_key(request),
        limit=PER_CLIENT_LIMIT,
        window_seconds=WINDOW_SECONDS,
    )
    if data.website:
        # Honeypot filled in: answer like a success so bots learn nothing.
        return QuoteRequestAccepted(id=None)
    await rate_limit.hit(
        redis,
        scope="quote:email",
        key=hashlib.sha256(data.email.lower().encode()).hexdigest()[:32],
        limit=PER_EMAIL_LIMIT,
        window_seconds=WINDOW_SECONDS,
    )
    quote = await service.create_quote_request(session, data)
    await session.commit()
    return QuoteRequestAccepted(id=quote.id)
