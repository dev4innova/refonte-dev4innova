"""Shared helpers of the portal: access checks, people and organizations, notifications.

Client side: every query filters on the organization of the context (`OrgContext`).
Staff side: `PORTAL_MANAGE` in the internal organization; records are reached through
their own organization, which must be a client organization.
"""

import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID, Membership, Organization, User
from app.modules.identity.permissions import Permission, permissions_for
from app.modules.identity.service import OrganizationContext
from app.modules.portal.models import Notification, Project
from app.modules.portal.schemas import OrganizationRef, PortalPerson


def now() -> datetime:
    return datetime.now(UTC)


def is_staff_context(ctx: OrganizationContext) -> bool:
    return ctx.organization_id == INTERNAL_ORGANIZATION_ID


def require_manage(ctx: OrganizationContext) -> None:
    ctx.require(Permission.PORTAL_MANAGE)


async def people(
    session: AsyncSession, ids: Iterable[uuid.UUID | None]
) -> dict[uuid.UUID, PortalPerson]:
    """Users shown next to records, in two queries (no N+1); staff are flagged."""
    wanted = {i for i in ids if i is not None}
    if not wanted:
        return {}
    users = list(await session.scalars(select(User).where(User.id.in_(wanted))))
    staff = set(
        await session.scalars(
            select(Membership.user_id).where(
                Membership.organization_id == INTERNAL_ORGANIZATION_ID,
                Membership.user_id.in_(wanted),
            )
        )
    )
    return {
        u.id: PortalPerson(
            id=u.id, display_name=u.display_name, email=u.email, is_staff=u.id in staff
        )
        for u in users
    }


async def organizations(
    session: AsyncSession, ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, OrganizationRef]:
    wanted = set(ids)
    if not wanted:
        return {}
    rows = await session.scalars(select(Organization).where(Organization.id.in_(wanted)))
    return {o.id: OrganizationRef(id=o.id, name=o.name, slug=o.slug) for o in rows}


async def client_organization(session: AsyncSession, organization_id: uuid.UUID) -> Organization:
    organization = await session.get(Organization, organization_id)
    if organization is None or organization.kind != "client":
        raise NotFoundError("Client organization not found")
    return organization


async def project_for(
    session: AsyncSession, ctx: OrganizationContext, project_id: uuid.UUID
) -> Project:
    """The project, if the context may see it: its own organization's, or any for staff."""
    query = select(Project).where(Project.id == project_id)
    if is_staff_context(ctx):
        require_manage(ctx)
    else:
        ctx.require(Permission.PORTAL_USE)
        query = query.where(Project.organization_id == ctx.organization_id)
    project = await session.scalar(query)
    if project is None:
        raise NotFoundError("Project not found")
    return project


async def staff_managers(session: AsyncSession) -> list[uuid.UUID]:
    rows = await session.execute(
        select(Membership.user_id, Membership.role).where(
            Membership.organization_id == INTERNAL_ORGANIZATION_ID
        )
    )
    return [user_id for user_id, role in rows if Permission.PORTAL_MANAGE in permissions_for(role)]


async def is_staff_manager(session: AsyncSession, user_id: uuid.UUID) -> bool:
    return user_id in await staff_managers(session)


async def notify_members(
    session: AsyncSession,
    organization_id: uuid.UUID,
    type_: str,
    data: dict[str, Any],
    *,
    exclude: uuid.UUID | None = None,
) -> None:
    """Every member of the client organization who uses the portal."""
    rows = await session.execute(
        select(Membership.user_id, Membership.role).where(
            Membership.organization_id == organization_id
        )
    )
    recipients = [
        user_id
        for user_id, role in rows
        if user_id != exclude and Permission.PORTAL_USE in permissions_for(role)
    ]
    _add(session, recipients, organization_id, type_, data, for_staff=False)


async def notify_staff(
    session: AsyncSession,
    organization_id: uuid.UUID,
    type_: str,
    data: dict[str, Any],
    *,
    owner: uuid.UUID | None = None,
    exclude: uuid.UUID | None = None,
) -> None:
    """The person in charge (project manager, ticket assignee) if still staff, else all
    the staff who manage the portal."""
    managers = await staff_managers(session)
    recipients = [owner] if owner in managers else managers
    _add(
        session,
        [r for r in recipients if r is not None and r != exclude],
        organization_id,
        type_,
        data,
        for_staff=True,
    )


def _add(
    session: AsyncSession,
    recipients: Iterable[uuid.UUID],
    organization_id: uuid.UUID,
    type_: str,
    data: dict[str, Any],
    *,
    for_staff: bool,
) -> None:
    created = now()
    session.add_all(
        Notification(
            user_id=user_id,
            organization_id=organization_id,
            type=type_,
            data=data,
            for_staff=for_staff,
            created_at=created,
        )
        for user_id in recipients
    )
