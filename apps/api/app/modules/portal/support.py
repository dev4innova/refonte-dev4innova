"""Support tickets with a message thread (TASK-101)."""

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext
from app.modules.portal import access
from app.modules.portal.access import is_staff_context, now, require_manage
from app.modules.portal.models import OPEN_TICKET_STATUSES, Project, Ticket, TicketMessage
from app.modules.portal.schemas import (
    ProjectRef,
    TicketCreate,
    TicketDetail,
    TicketFilter,
    TicketMessageOut,
    TicketPage,
    TicketReply,
    TicketSummary,
    TicketUpdate,
)

PRIORITY_ORDER = {"urgent": 0, "high": 1, "normal": 2, "low": 3}


async def summaries(session: AsyncSession, tickets: Sequence[Ticket]) -> list[TicketSummary]:
    ids = [t.id for t in tickets]
    counts: dict[uuid.UUID, int] = {}
    last_staff: dict[uuid.UUID, bool] = {}
    if ids:
        rows = await session.execute(
            select(TicketMessage.ticket_id, func.count())
            .where(TicketMessage.ticket_id.in_(ids))
            .group_by(TicketMessage.ticket_id)
        )
        counts = {ticket_id: count for ticket_id, count in rows}
        latest = (
            select(TicketMessage.ticket_id, TicketMessage.from_staff)
            .where(TicketMessage.ticket_id.in_(ids))
            .ext(distinct_on(TicketMessage.ticket_id))
            .order_by(TicketMessage.ticket_id, TicketMessage.created_at.desc())
        )
        last_staff = {
            ticket_id: from_staff for ticket_id, from_staff in await session.execute(latest)
        }
    project_ids = {t.project_id for t in tickets if t.project_id}
    projects = {
        p.id: ProjectRef(id=p.id, name=p.name)
        for p in (
            await session.scalars(select(Project).where(Project.id.in_(project_ids)))
            if project_ids
            else []
        )
    }
    people = await access.people(
        session, [t.created_by_id for t in tickets] + [t.assignee_id for t in tickets]
    )
    orgs = await access.organizations(session, [t.organization_id for t in tickets])
    return [
        TicketSummary(
            id=t.id,
            number=t.number,
            organization=orgs[t.organization_id],
            subject=t.subject,
            category=t.category,
            priority=t.priority,
            status=t.status,
            project=projects.get(t.project_id) if t.project_id else None,
            created_by=people.get(t.created_by_id) if t.created_by_id else None,
            assignee=people.get(t.assignee_id) if t.assignee_id else None,
            messages=counts.get(t.id, 0),
            last_message_at=t.last_message_at,
            last_from_staff=last_staff.get(t.id, False),
            created_at=t.created_at,
        )
        for t in tickets
    ]


def _payload(ticket: Ticket, **extra: Any) -> dict[str, Any]:
    return {"ticket_id": str(ticket.id), "number": ticket.number, "subject": ticket.subject} | extra


async def list_tickets(
    session: AsyncSession,
    ctx: OrganizationContext,
    *,
    state: TicketFilter = "open",
    organization_id: uuid.UUID | None = None,
    mine: bool = False,
    page: int = 1,
    page_size: int = 25,
) -> TicketPage:
    query = select(Ticket)
    if is_staff_context(ctx):
        require_manage(ctx)
        if organization_id:
            query = query.where(Ticket.organization_id == organization_id)
        if mine:
            query = query.where(Ticket.assignee_id == ctx.user.id)
    else:
        ctx.require(Permission.PORTAL_USE)
        query = query.where(Ticket.organization_id == ctx.organization_id)
    if state == "open":
        query = query.where(Ticket.status.in_(OPEN_TICKET_STATUSES))
    elif state == "closed":
        query = query.where(Ticket.status.not_in(OPEN_TICKET_STATUSES))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.scalars(
        query.order_by(Ticket.last_message_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return TicketPage(
        items=await summaries(session, list(rows)), total=total, page=page, page_size=page_size
    )


async def _ticket(session: AsyncSession, ctx: OrganizationContext, ticket_id: uuid.UUID) -> Ticket:
    query = select(Ticket).where(Ticket.id == ticket_id)
    if is_staff_context(ctx):
        require_manage(ctx)
    else:
        ctx.require(Permission.PORTAL_USE)
        query = query.where(Ticket.organization_id == ctx.organization_id)
    ticket = await session.scalar(query)
    if ticket is None:
        raise NotFoundError("Ticket not found")
    return ticket


async def ticket_detail(
    session: AsyncSession, ctx: OrganizationContext, ticket_id: uuid.UUID
) -> TicketDetail:
    ticket = await _ticket(session, ctx, ticket_id)
    messages = list(
        await session.scalars(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == ticket.id)
            .order_by(TicketMessage.created_at)
        )
    )
    people = await access.people(session, [m.author_id for m in messages])
    (summary,) = await summaries(session, [ticket])
    return TicketDetail(
        **summary.model_dump(),
        closed_at=ticket.closed_at,
        thread=[
            TicketMessageOut(
                id=m.id,
                author=people.get(m.author_id) if m.author_id else None,
                from_staff=m.from_staff,
                body=m.body,
                created_at=m.created_at,
            )
            for m in messages
        ],
    )


def _message(ticket: Ticket, ctx: OrganizationContext, body: str) -> TicketMessage:
    created = now()
    ticket.last_message_at = created
    return TicketMessage(
        organization_id=ticket.organization_id,
        ticket_id=ticket.id,
        author_id=ctx.user.id,
        from_staff=is_staff_context(ctx),
        body=body,
        created_at=created,
    )


async def create_ticket(
    session: AsyncSession, ctx: OrganizationContext, data: TicketCreate
) -> Ticket:
    if is_staff_context(ctx):
        raise ConflictError("Tickets are opened by clients, from their portal")
    ctx.require(Permission.PORTAL_USE)
    if data.project_id:
        await access.project_for(session, ctx, data.project_id)
    ticket = Ticket(
        organization_id=ctx.organization_id,
        subject=data.subject,
        category=data.category,
        priority=data.priority,
        project_id=data.project_id,
        created_by_id=ctx.user.id,
        last_message_at=now(),
    )
    session.add(ticket)
    await session.flush()
    session.add(_message(ticket, ctx, data.message))
    await access.notify_staff(
        session,
        ticket.organization_id,
        "ticket_opened",
        _payload(ticket, priority=ticket.priority, organization=ctx.organization.name),
    )
    await session.commit()
    return ticket


async def reply(
    session: AsyncSession, ctx: OrganizationContext, ticket_id: uuid.UUID, data: TicketReply
) -> Ticket:
    ticket = await _ticket(session, ctx, ticket_id)
    session.add(_message(ticket, ctx, data.body))
    if is_staff_context(ctx):
        status = data.status or "waiting_customer"
        _set_status(ticket, status)
        if ticket.assignee_id is None:
            ticket.assignee_id = ctx.user.id
        await access.notify_members(
            session, ticket.organization_id, "ticket_replied", _payload(ticket, status=status)
        )
    else:
        # A client message (re)opens the ticket for the team.
        if ticket.status != "in_progress":
            _set_status(ticket, "open")
        await access.notify_staff(
            session,
            ticket.organization_id,
            "ticket_message",
            _payload(ticket, organization=ctx.organization.name),
            owner=ticket.assignee_id,
        )
    await session.commit()
    return ticket


def _set_status(ticket: Ticket, status: str) -> None:
    ticket.status = status
    ticket.closed_at = now() if status == "closed" else None


async def close(session: AsyncSession, ctx: OrganizationContext, ticket_id: uuid.UUID) -> Ticket:
    """The client closes its ticket (solved, or no longer needed)."""
    ticket = await _ticket(session, ctx, ticket_id)
    if ticket.status != "closed":
        _set_status(ticket, "closed")
        await access.notify_staff(
            session,
            ticket.organization_id,
            "ticket_message",
            _payload(ticket, status="closed", organization=ctx.organization.name),
            owner=ticket.assignee_id,
            exclude=ctx.user.id,
        )
        await session.commit()
    return ticket


async def update(
    session: AsyncSession, ctx: OrganizationContext, ticket_id: uuid.UUID, data: TicketUpdate
) -> Ticket:
    require_manage(ctx)
    ticket = await _ticket(session, ctx, ticket_id)
    if data.assignee_id:
        if not await access.is_staff_manager(session, data.assignee_id):
            raise ConflictError("The assignee must be a member of the team")
        ticket.assignee_id = data.assignee_id
    elif data.unassign:
        ticket.assignee_id = None
    if data.priority:
        ticket.priority = data.priority
    if data.status and data.status != ticket.status:
        _set_status(ticket, data.status)
        await access.notify_members(
            session, ticket.organization_id, "ticket_status", _payload(ticket, status=data.status)
        )
    await session.commit()
    return ticket
