"""CRM business rules (TASK-067 to TASK-072). Every query is scoped to the caller's
organization (the internal DEV4INNOVA organization for the back office); the website
forms write into the internal organization only."""

import uuid
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import Select, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ConflictError, NotFoundError
from app.modules.contact.models import ContactRequest
from app.modules.crm.models import (
    CLOSED_STAGES,
    OPEN_LEAD_STATUSES,
    OPEN_STAGES,
    Activity,
    Lead,
    Opportunity,
    QuoteRequest,
)
from app.modules.crm.schemas import (
    ActivityCreate,
    ActivityOut,
    Dashboard,
    Inbox,
    LeadCreate,
    LeadDetail,
    LeadPage,
    LeadStatus,
    LeadSummary,
    LeadUpdate,
    OpportunityCreate,
    OpportunityOut,
    OpportunityUpdate,
    OwnerFilter,
    Person,
    QuoteRequestCreate,
    QuoteRequestOut,
    Stage,
    StageTotal,
)
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID, Membership, User
from app.modules.identity.permissions import Permission, permissions_for
from app.modules.identity.service import OrganizationContext


class UnprocessableError(AppError):
    status_code = 422
    code = "unprocessable"


def _now() -> datetime:
    return datetime.now(UTC)


# --- Mapping -------------------------------------------------------------------------


async def _people(
    session: AsyncSession, ids: Iterable[uuid.UUID | None]
) -> dict[uuid.UUID, Person]:
    """Users shown next to records, loaded in one query (no N+1)."""
    wanted = {i for i in ids if i is not None}
    if not wanted:
        return {}
    users = await session.scalars(select(User).where(User.id.in_(wanted)))
    return {u.id: Person(id=u.id, display_name=u.display_name, email=u.email) for u in users}


def _lead_summary(lead: Lead, people: dict[uuid.UUID, Person]) -> LeadSummary:
    return LeadSummary(
        id=lead.id,
        email=lead.email,
        name=lead.name,
        company=lead.company,
        status=lead.status,
        source=lead.source,
        owner=people.get(lead.owner_id) if lead.owner_id else None,
        last_activity_at=lead.last_activity_at,
        created_at=lead.created_at,
    )


def _opportunity_out(
    opportunity: Opportunity, lead: Lead, people: dict[uuid.UUID, Person]
) -> OpportunityOut:
    return OpportunityOut(
        id=opportunity.id,
        lead=_lead_summary(lead, people),
        title=opportunity.title,
        stage=opportunity.stage,
        amount=opportunity.amount,
        currency="EUR",
        expected_close_on=opportunity.expected_close_on,
        closed_at=opportunity.closed_at,
        owner=people.get(opportunity.owner_id) if opportunity.owner_id else None,
        updated_at=opportunity.updated_at,
    )


def _quote_out(quote: QuoteRequest, lead: Lead, people: dict[uuid.UUID, Person]) -> QuoteRequestOut:
    return QuoteRequestOut(
        id=quote.id,
        lead=_lead_summary(lead, people),
        opportunity_id=quote.opportunity_id,
        service=quote.service,
        need=quote.need,
        budget=quote.budget,
        timeline=quote.timeline,
        status=quote.status,
        locale=quote.locale,
        created_at=quote.created_at,
    )


def _log(
    session: AsyncSession,
    lead: Lead,
    activity_type: str,
    *,
    author_id: uuid.UUID | None,
    body: str = "",
    details: dict[str, Any] | None = None,
    opportunity_id: uuid.UUID | None = None,
    occurred_at: datetime | None = None,
) -> Activity:
    occurred = occurred_at or _now()
    activity = Activity(
        organization_id=lead.organization_id,
        lead_id=lead.id,
        opportunity_id=opportunity_id,
        type=activity_type,
        body=body,
        details=details or {},
        occurred_at=occurred,
        author_id=author_id,
    )
    session.add(activity)
    lead.last_activity_at = max(lead.last_activity_at or occurred, occurred)
    return activity


# --- Website forms: contact and quote requests (TASK-067, TASK-072) -------------------


async def record_inbound(
    session: AsyncSession,
    *,
    email: str,
    name: str,
    company: str | None,
    locale: str,
    source: str,
    activity_type: str,
    body: str,
    details: dict[str, Any],
    phone: str | None = None,
) -> Lead:
    """Creates the prospect of this address in the internal organization, or updates it,
    and logs the message. Concurrent submissions converge on one prospect (unique email).
    The caller commits."""
    now = _now()
    await session.execute(
        insert(Lead)
        .values(
            id=uuid.uuid4(),
            organization_id=INTERNAL_ORGANIZATION_ID,
            email=email,
            name=name,
            company=company,
            phone=phone,
            locale=locale,
            source=source,
            status="new",
            last_activity_at=now,
        )
        .on_conflict_do_nothing(constraint="uq_crm_leads_organization_id_email")
    )
    lead = await session.scalar(
        select(Lead)
        .where(Lead.organization_id == INTERNAL_ORGANIZATION_ID, Lead.email == email)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    assert lead is not None
    # The latest details given win; empty fields never erase known ones.
    lead.name = name
    lead.company = company or lead.company
    lead.phone = phone or lead.phone
    lead.locale = locale
    if lead.status == "unqualified":
        lead.status = "new"  # someone set aside comes back: look again
    _log(session, lead, activity_type, author_id=None, body=body, details=details, occurred_at=now)
    return lead


async def create_quote_request(session: AsyncSession, data: QuoteRequestCreate) -> QuoteRequest:
    """A quote request opens an opportunity on the prospect's pipeline (TASK-072)."""
    email = data.email.lower()
    lead = await record_inbound(
        session,
        email=email,
        name=data.name,
        company=data.company or None,
        phone=data.phone or None,
        locale=data.locale,
        source="quote_request",
        activity_type="quote_request",
        body=data.need,
        details={"service": data.service, "budget": data.budget, "timeline": data.timeline},
    )
    opportunity = Opportunity(
        organization_id=lead.organization_id,
        lead_id=lead.id,
        title=data.company or data.name,
        stage="qualification",
        owner_id=lead.owner_id,
    )
    session.add(opportunity)
    await session.flush()
    quote = QuoteRequest(
        organization_id=lead.organization_id,
        lead_id=lead.id,
        opportunity_id=opportunity.id,
        service=data.service,
        need=data.need,
        budget=data.budget,
        timeline=data.timeline,
        locale=data.locale,
        consent_at=_now(),
    )
    session.add(quote)
    await session.flush()
    return quote


# --- Prospects (TASK-067, TASK-070) --------------------------------------------------


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def list_leads(
    session: AsyncSession,
    ctx: OrganizationContext,
    *,
    status: LeadStatus | None,
    owner: OwnerFilter,
    q: str | None,
    page: int,
    page_size: int,
) -> LeadPage:
    ctx.require(Permission.CRM_READ)
    query: Select[Lead] = select(Lead).where(Lead.organization_id == ctx.organization_id)
    if status:
        query = query.where(Lead.status == status)
    if owner == "me":
        query = query.where(Lead.owner_id == ctx.user.id)
    elif owner == "unassigned":
        query = query.where(Lead.owner_id.is_(None))
    if q and q.strip():
        pattern = f"%{_escape_like(q.strip())}%"
        query = query.where(
            or_(
                Lead.email.ilike(pattern, escape="\\"),
                Lead.name.ilike(pattern, escape="\\"),
                Lead.company.ilike(pattern, escape="\\"),
            )
        )
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    leads = list(
        await session.scalars(
            query.order_by(Lead.last_activity_at.desc(), Lead.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    people = await _people(session, (lead.owner_id for lead in leads))
    return LeadPage(
        items=[_lead_summary(lead, people) for lead in leads],
        total=total,
        page=page,
        page_size=page_size,
    )


async def _get_lead(
    session: AsyncSession, ctx: OrganizationContext, lead_id: uuid.UUID, *, lock: bool = False
) -> Lead:
    query = select(Lead).where(Lead.id == lead_id, Lead.organization_id == ctx.organization_id)
    lead = await session.scalar(query.with_for_update() if lock else query)
    if lead is None:
        raise NotFoundError("Prospect not found")
    return lead


async def lead_detail(
    session: AsyncSession, ctx: OrganizationContext, lead_id: uuid.UUID
) -> LeadDetail:
    ctx.require(Permission.CRM_READ)
    lead = await _get_lead(session, ctx, lead_id)
    scope = (ctx.organization_id, lead.id)
    activities = list(
        await session.scalars(
            select(Activity)
            .where(Activity.organization_id == scope[0], Activity.lead_id == scope[1])
            .order_by(Activity.occurred_at.desc(), Activity.created_at.desc())
        )
    )
    opportunities = list(
        await session.scalars(
            select(Opportunity)
            .where(Opportunity.organization_id == scope[0], Opportunity.lead_id == scope[1])
            .order_by(Opportunity.created_at.desc())
        )
    )
    quotes = list(
        await session.scalars(
            select(QuoteRequest)
            .where(QuoteRequest.organization_id == scope[0], QuoteRequest.lead_id == scope[1])
            .order_by(QuoteRequest.created_at.desc())
        )
    )
    people = await _people(
        session,
        [lead.owner_id, *(a.author_id for a in activities), *(o.owner_id for o in opportunities)],
    )
    summary = _lead_summary(lead, people)
    return LeadDetail(
        **summary.model_dump(),
        phone=lead.phone,
        locale=lead.locale,
        activities=[
            ActivityOut(
                id=a.id,
                type=a.type,
                body=a.body,
                details=a.details,
                occurred_at=a.occurred_at,
                author=people.get(a.author_id) if a.author_id else None,
                opportunity_id=a.opportunity_id,
            )
            for a in activities
        ],
        opportunities=[_opportunity_out(o, lead, people) for o in opportunities],
        quote_requests=[_quote_out(q, lead, people) for q in quotes],
    )


async def create_lead(session: AsyncSession, ctx: OrganizationContext, data: LeadCreate) -> Lead:
    ctx.require(Permission.CRM_WRITE)
    email = data.email.lower()
    existing = await session.scalar(
        select(Lead.id).where(Lead.organization_id == ctx.organization_id, Lead.email == email)
    )
    if existing:
        raise ConflictError(
            "A prospect already uses this email address", {"lead_id": str(existing)}
        )
    lead = Lead(
        organization_id=ctx.organization_id,
        email=email,
        name=data.name,
        company=data.company,
        phone=data.phone,
        locale=data.locale,
        source="manual",
        status="new",
        owner_id=ctx.user.id,
        created_by_id=ctx.user.id,
        last_activity_at=_now(),
    )
    session.add(lead)
    await session.commit()
    return lead


async def update_lead(
    session: AsyncSession, ctx: OrganizationContext, lead_id: uuid.UUID, data: LeadUpdate
) -> None:
    ctx.require(Permission.CRM_WRITE)
    lead = await _get_lead(session, ctx, lead_id, lock=True)
    fields = data.model_fields_set
    if data.name:
        lead.name = data.name
    for field in ("company", "phone"):
        if field in fields:
            setattr(lead, field, getattr(data, field))
    if data.locale:
        lead.locale = data.locale
    if data.status and data.status != lead.status:
        _log(
            session,
            lead,
            "status_change",
            author_id=ctx.user.id,
            details={"from": lead.status, "to": data.status},
        )
        lead.status = data.status
    await session.commit()


async def _ensure_assignable(
    session: AsyncSession, ctx: OrganizationContext, user_id: uuid.UUID
) -> None:
    """Only staff of the same organization who can work on prospects may own them."""
    membership = await session.scalar(
        select(Membership).where(
            Membership.organization_id == ctx.organization_id, Membership.user_id == user_id
        )
    )
    if membership is None or Permission.CRM_WRITE not in permissions_for(membership.role):
        raise UnprocessableError("This person cannot be assigned prospects", {"field": "owner_id"})


async def set_owner(
    session: AsyncSession, ctx: OrganizationContext, lead_id: uuid.UUID, owner_id: uuid.UUID | None
) -> None:
    ctx.require(Permission.CRM_ASSIGN)
    lead = await _get_lead(session, ctx, lead_id, lock=True)
    if owner_id is not None:
        await _ensure_assignable(session, ctx, owner_id)
    if owner_id != lead.owner_id:
        _log(
            session,
            lead,
            "assignment",
            author_id=ctx.user.id,
            details={
                "from": str(lead.owner_id) if lead.owner_id else None,
                "to": str(owner_id) if owner_id else None,
            },
        )
        lead.owner_id = owner_id
    await session.commit()


async def add_activity(
    session: AsyncSession, ctx: OrganizationContext, lead_id: uuid.UUID, data: ActivityCreate
) -> None:
    ctx.require(Permission.CRM_WRITE)
    lead = await _get_lead(session, ctx, lead_id, lock=True)
    if data.opportunity_id is not None:
        found = await session.scalar(
            select(Opportunity.id).where(
                Opportunity.id == data.opportunity_id,
                Opportunity.organization_id == ctx.organization_id,
                Opportunity.lead_id == lead.id,
            )
        )
        if found is None:
            raise UnprocessableError(
                "This opportunity does not belong to the prospect", {"field": "opportunity_id"}
            )
    _log(
        session,
        lead,
        data.type,
        author_id=ctx.user.id,
        body=data.body.strip(),
        opportunity_id=data.opportunity_id,
        occurred_at=data.occurred_at,
    )
    await session.commit()


async def delete_lead(session: AsyncSession, ctx: OrganizationContext, lead_id: uuid.UUID) -> None:
    """GDPR erasure: the prospect, its history, opportunities, quote requests and the raw
    website messages it came from."""
    ctx.require(Permission.CRM_DELETE)
    lead = await _get_lead(session, ctx, lead_id, lock=True)
    await session.execute(delete(ContactRequest).where(ContactRequest.lead_id == lead.id))
    await session.delete(lead)
    await session.commit()


async def list_team(session: AsyncSession, ctx: OrganizationContext) -> list[Person]:
    """Staff who can be assigned prospects and opportunities."""
    ctx.require(Permission.CRM_READ)
    rows = await session.execute(
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.organization_id == ctx.organization_id)
        .order_by(User.display_name, User.email)
    )
    return [
        Person(id=user.id, display_name=user.display_name, email=user.email)
        for user, role in rows
        if Permission.CRM_WRITE in permissions_for(role)
    ]


# --- Opportunities and pipeline (TASK-069) -------------------------------------------


async def _get_opportunity(
    session: AsyncSession, ctx: OrganizationContext, opportunity_id: uuid.UUID
) -> Opportunity:
    opportunity = await session.scalar(
        select(Opportunity)
        .where(Opportunity.id == opportunity_id, Opportunity.organization_id == ctx.organization_id)
        .with_for_update()
    )
    if opportunity is None:
        raise NotFoundError("Opportunity not found")
    return opportunity


async def opportunity_out(
    session: AsyncSession, ctx: OrganizationContext, opportunity_id: uuid.UUID
) -> OpportunityOut:
    opportunity = await _get_opportunity(session, ctx, opportunity_id)
    lead = await _get_lead(session, ctx, opportunity.lead_id)
    people = await _people(session, [lead.owner_id, opportunity.owner_id])
    return _opportunity_out(opportunity, lead, people)


async def list_opportunities(
    session: AsyncSession,
    ctx: OrganizationContext,
    *,
    owner: OwnerFilter,
    closed_within_days: int,
) -> list[OpportunityOut]:
    """Open opportunities, plus those closed in the last `closed_within_days` days."""
    ctx.require(Permission.CRM_READ)
    since = _now() - timedelta(days=closed_within_days)
    query = (
        select(Opportunity, Lead)
        .join(Lead, Lead.id == Opportunity.lead_id)
        .where(
            Opportunity.organization_id == ctx.organization_id,
            Lead.organization_id == ctx.organization_id,
            or_(Opportunity.stage.in_(OPEN_STAGES), Opportunity.closed_at >= since),
        )
        .order_by(Opportunity.updated_at.desc())
    )
    if owner == "me":
        query = query.where(Opportunity.owner_id == ctx.user.id)
    elif owner == "unassigned":
        query = query.where(Opportunity.owner_id.is_(None))
    rows = list(await session.execute(query))
    people = await _people(session, [i for o, lead in rows for i in (o.owner_id, lead.owner_id)])
    return [_opportunity_out(o, lead, people) for o, lead in rows]


def _move(
    session: AsyncSession, ctx: OrganizationContext, opportunity: Opportunity, lead: Lead, to: Stage
) -> None:
    if to == opportunity.stage:
        return
    _log(
        session,
        lead,
        "stage_change",
        author_id=ctx.user.id,
        opportunity_id=opportunity.id,
        details={"from": opportunity.stage, "to": to, "title": opportunity.title},
    )
    opportunity.stage = to
    opportunity.closed_at = _now() if to in CLOSED_STAGES else None
    if to == "won":
        lead.status = "customer"


async def create_opportunity(
    session: AsyncSession, ctx: OrganizationContext, data: OpportunityCreate
) -> uuid.UUID:
    ctx.require(Permission.CRM_WRITE)
    lead = await _get_lead(session, ctx, data.lead_id, lock=True)
    opportunity = Opportunity(
        organization_id=ctx.organization_id,
        lead_id=lead.id,
        title=data.title,
        stage="qualification",
        amount=data.amount,
        currency=data.currency,
        expected_close_on=data.expected_close_on,
        owner_id=lead.owner_id or ctx.user.id,
    )
    session.add(opportunity)
    await session.flush()
    _move(session, ctx, opportunity, lead, data.stage)
    await session.commit()
    return opportunity.id


async def update_opportunity(
    session: AsyncSession,
    ctx: OrganizationContext,
    opportunity_id: uuid.UUID,
    data: OpportunityUpdate,
) -> None:
    ctx.require(Permission.CRM_WRITE)
    opportunity = await _get_opportunity(session, ctx, opportunity_id)
    lead = await _get_lead(session, ctx, opportunity.lead_id, lock=True)
    if data.title:
        opportunity.title = data.title
    if data.clear_amount:
        opportunity.amount = None
    elif data.amount is not None:
        opportunity.amount = data.amount
    if data.clear_expected_close_on:
        opportunity.expected_close_on = None
    elif data.expected_close_on is not None:
        opportunity.expected_close_on = data.expected_close_on
    if data.clear_owner or data.owner_id is not None:
        ctx.require(Permission.CRM_ASSIGN)
        if data.owner_id is not None and not data.clear_owner:
            await _ensure_assignable(session, ctx, data.owner_id)
            opportunity.owner_id = data.owner_id
        else:
            opportunity.owner_id = None
    if data.stage:
        _move(session, ctx, opportunity, lead, data.stage)
    await session.commit()


# --- Quote requests (TASK-072) -------------------------------------------------------


async def list_quote_requests(
    session: AsyncSession, ctx: OrganizationContext, *, status: str | None
) -> list[QuoteRequestOut]:
    ctx.require(Permission.CRM_READ)
    query = (
        select(QuoteRequest, Lead)
        .join(Lead, Lead.id == QuoteRequest.lead_id)
        .where(
            QuoteRequest.organization_id == ctx.organization_id,
            Lead.organization_id == ctx.organization_id,
        )
        .order_by(QuoteRequest.created_at.desc())
        .limit(200)
    )
    if status:
        query = query.where(QuoteRequest.status == status)
    rows = list(await session.execute(query))
    people = await _people(session, (lead.owner_id for _, lead in rows))
    return [_quote_out(quote, lead, people) for quote, lead in rows]


async def update_quote_request(
    session: AsyncSession, ctx: OrganizationContext, quote_id: uuid.UUID, status: str
) -> QuoteRequestOut:
    ctx.require(Permission.CRM_WRITE)
    row = (
        await session.execute(
            select(QuoteRequest, Lead)
            .join(Lead, Lead.id == QuoteRequest.lead_id)
            .where(
                QuoteRequest.id == quote_id,
                QuoteRequest.organization_id == ctx.organization_id,
                Lead.organization_id == ctx.organization_id,
            )
        )
    ).first()
    if row is None:
        raise NotFoundError("Quote request not found")
    quote, lead = row
    quote.status = status
    await session.commit()
    people = await _people(session, [lead.owner_id])
    return _quote_out(quote, lead, people)


# --- Dashboard (TASK-071) ------------------------------------------------------------


async def dashboard(session: AsyncSession, ctx: OrganizationContext) -> Dashboard:
    ctx.require(Permission.CRM_READ)
    org = ctx.organization_id
    now = _now()
    month_ago, quarter_ago = now - timedelta(days=30), now - timedelta(days=90)

    by_status: dict[str, int] = {
        status: count
        for status, count in await session.execute(
            select(Lead.status, func.count())
            .where(Lead.organization_id == org)
            .group_by(Lead.status)
        )
    }
    by_source: dict[str, int] = {
        source: count
        for source, count in await session.execute(
            select(Lead.source, func.count())
            .where(Lead.organization_id == org, Lead.created_at >= month_ago)
            .group_by(Lead.source)
        )
    }
    open_leads = (Lead.organization_id == org, Lead.status.in_(OPEN_LEAD_STATUSES))
    unassigned = await session.scalar(
        select(func.count()).where(*open_leads, Lead.owner_id.is_(None))
    )
    mine = await session.scalar(
        select(func.count()).where(*open_leads, Lead.owner_id == ctx.user.id)
    )
    new_quotes = await session.scalar(
        select(func.count()).where(
            QuoteRequest.organization_id == org, QuoteRequest.status == "new"
        )
    )
    totals = {
        stage: (count, amount)
        for stage, count, amount in (
            await session.execute(
                select(
                    Opportunity.stage,
                    func.count(),
                    func.coalesce(func.sum(Opportunity.amount), 0),
                )
                .where(
                    Opportunity.organization_id == org,
                    or_(Opportunity.stage.in_(OPEN_STAGES), Opportunity.closed_at >= quarter_ago),
                )
                .group_by(Opportunity.stage)
            )
        )
    }

    def total(stage: Stage) -> StageTotal:
        count, amount = totals.get(stage, (0, Decimal(0)))
        return StageTotal(stage=stage, count=count, amount=Decimal(amount or 0))

    open_stages: tuple[Stage, ...] = ("qualification", "proposal", "negotiation")
    pipeline = [total(stage) for stage in open_stages]
    won, lost = total("won"), total("lost").count
    return Dashboard(
        leads_by_status={
            status: by_status.get(status, 0)
            for status in ("new", "contacted", "qualified", "customer", "unqualified")
        },
        new_leads_30_days=sum(by_source.values()),
        leads_by_source_30_days=by_source,
        unassigned_open_leads=unassigned or 0,
        my_open_leads=mine or 0,
        new_quote_requests=new_quotes or 0,
        pipeline=pipeline,
        open_pipeline_amount=sum((s.amount for s in pipeline), Decimal(0)),
        won_90_days=won,
        lost_90_days=lost,
        win_rate_90_days=round(won.count / (won.count + lost), 3) if won.count + lost else None,
    )


async def inbox(session: AsyncSession, ctx: OrganizationContext) -> Inbox:
    ctx.require(Permission.CRM_READ)
    org = ctx.organization_id
    new_leads = await session.scalar(
        select(func.count()).where(Lead.organization_id == org, Lead.status == "new")
    )
    new_quotes = await session.scalar(
        select(func.count()).where(
            QuoteRequest.organization_id == org, QuoteRequest.status == "new"
        )
    )
    return Inbox(new_leads=new_leads or 0, new_quote_requests=new_quotes or 0)
