"""Dashboards (TASK-096): the client's portal home and the staff overview."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models import Organization
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext
from app.modules.portal import access, notifications, projects, support
from app.modules.portal.access import require_manage
from app.modules.portal.models import (
    ACTIVE_PROJECT_STATUSES,
    OPEN_TASK_STATUSES,
    OPEN_TICKET_STATUSES,
    Deliverable,
    Project,
    Task,
    Ticket,
)
from app.modules.portal.schemas import (
    DashboardCounts,
    DashboardDeliverable,
    DashboardTask,
    OrganizationRef,
    PortalAdminDashboard,
    PortalDashboard,
    PortalPerson,
)


async def _count(session: AsyncSession, model: type, *conditions: object) -> int:
    return await session.scalar(select(func.count()).select_from(model).where(*conditions)) or 0  # type: ignore[arg-type]


async def client_dashboard(session: AsyncSession, ctx: OrganizationContext) -> PortalDashboard:
    ctx.require(Permission.PORTAL_USE)
    org_id = ctx.organization_id
    active = list(
        await session.scalars(
            select(Project)
            .where(Project.organization_id == org_id, Project.status.in_(ACTIVE_PROJECT_STATUSES))
            .order_by(Project.updated_at.desc())
            .limit(6)
        )
    )
    pending = list(
        await session.execute(
            select(Deliverable, Project.name)
            .join(Project, Project.id == Deliverable.project_id)
            .where(Deliverable.organization_id == org_id, Deliverable.status == "pending_review")
            .order_by(Deliverable.updated_at.desc())
            .limit(6)
        )
    )
    tickets = list(
        await session.scalars(
            select(Ticket)
            .where(Ticket.organization_id == org_id, Ticket.status.in_(OPEN_TICKET_STATUSES))
            .order_by(Ticket.last_message_at.desc())
            .limit(5)
        )
    )
    open_tasks = Task.organization_id == org_id, Task.status.in_(OPEN_TASK_STATUSES)
    return PortalDashboard(
        organization=OrganizationRef(
            id=ctx.organization.id, name=ctx.organization.name, slug=ctx.organization.slug
        ),
        counts=DashboardCounts(
            active_projects=await _count(
                session,
                Project,
                Project.organization_id == org_id,
                Project.status.in_(ACTIVE_PROJECT_STATUSES),
            ),
            open_tasks=await _count(session, Task, *open_tasks),
            tasks_in_review=await _count(
                session, Task, Task.organization_id == org_id, Task.status == "client_review"
            ),
            pending_deliverables=await _count(
                session,
                Deliverable,
                Deliverable.organization_id == org_id,
                Deliverable.status == "pending_review",
            ),
            open_tickets=await _count(
                session,
                Ticket,
                Ticket.organization_id == org_id,
                Ticket.status.in_(OPEN_TICKET_STATUSES),
            ),
            unread_notifications=await notifications.unread_count(session, ctx.user),
        ),
        projects=await projects.summaries(session, active),
        upcoming_tasks=[
            DashboardTask(**projects.task_out(task).model_dump(), project_name=name)
            for task, name in await projects.upcoming_tasks(session, org_id)
        ],
        pending_deliverables=[
            DashboardDeliverable(
                id=d.id,
                project_id=d.project_id,
                project_name=name,
                title=d.title,
                version=d.version,
                updated_at=d.updated_at,
            )
            for d, name in pending
        ],
        recent_tickets=await support.summaries(session, tickets),
    )


async def admin_dashboard(session: AsyncSession, ctx: OrganizationContext) -> PortalAdminDashboard:
    require_manage(ctx)
    active = list(
        await session.scalars(
            select(Project)
            .where(Project.status.in_(ACTIVE_PROJECT_STATUSES))
            .order_by(Project.updated_at.desc())
            .limit(8)
        )
    )
    open_tickets = Ticket.status.in_(OPEN_TICKET_STATUSES)
    tickets = list(
        await session.scalars(
            select(Ticket)
            .where(open_tickets, Ticket.status != "waiting_customer")
            .order_by(Ticket.last_message_at.desc())
            .limit(8)
        )
    )
    return PortalAdminDashboard(
        active_projects=await _count(session, Project, Project.status.in_(ACTIVE_PROJECT_STATUSES)),
        pending_deliverables=await _count(
            session, Deliverable, Deliverable.status == "pending_review"
        ),
        changes_requested=await _count(
            session, Deliverable, Deliverable.status == "changes_requested"
        ),
        open_tickets=await _count(session, Ticket, open_tickets),
        unassigned_tickets=await _count(
            session, Ticket, open_tickets, Ticket.assignee_id.is_(None)
        ),
        urgent_tickets=await _count(session, Ticket, open_tickets, Ticket.priority == "urgent"),
        projects=await projects.summaries(session, active),
        tickets=await support.summaries(session, tickets),
    )


async def client_organizations(
    session: AsyncSession, ctx: OrganizationContext
) -> list[OrganizationRef]:
    """Organizations a project can be created for."""
    require_manage(ctx)
    rows = await session.scalars(
        select(Organization).where(Organization.kind == "client").order_by(Organization.name)
    )
    return [OrganizationRef(id=o.id, name=o.name, slug=o.slug) for o in rows]


async def team(session: AsyncSession, ctx: OrganizationContext) -> list[PortalPerson]:
    """Staff who can manage projects and answer tickets."""
    require_manage(ctx)
    ids = await access.staff_managers(session)
    people = await access.people(session, ids)
    return sorted(people.values(), key=lambda p: (p.display_name or p.email or "").lower())
