"""Data access for identity. Tenant-scoped queries always take an organization_id."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.identity.models import Membership, Organization, User
from app.modules.identity.permissions import Role


async def get_user_by_subject(session: AsyncSession, subject: str) -> User | None:
    return await session.scalar(select(User).where(User.external_subject == subject))


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    return await session.scalar(select(User).where(User.email == email.lower()))


async def list_user_memberships(session: AsyncSession, user_id: uuid.UUID) -> list[Membership]:
    result = await session.scalars(
        select(Membership)
        .options(joinedload(Membership.organization))
        .where(Membership.user_id == user_id)
        .order_by(Membership.created_at)
    )
    return list(result)


async def get_membership(
    session: AsyncSession, *, organization_id: uuid.UUID, user_id: uuid.UUID
) -> Membership | None:
    return await session.scalar(
        select(Membership)
        .options(joinedload(Membership.organization), joinedload(Membership.user))
        .where(Membership.organization_id == organization_id, Membership.user_id == user_id)
    )


async def list_members(session: AsyncSession, organization_id: uuid.UUID) -> list[Membership]:
    result = await session.scalars(
        select(Membership)
        .options(joinedload(Membership.user))
        .where(Membership.organization_id == organization_id)
        .order_by(Membership.created_at)
    )
    return list(result)


async def count_owners(session: AsyncSession, organization_id: uuid.UUID) -> int:
    return (
        await session.scalar(
            select(func.count())
            .select_from(Membership)
            .where(Membership.organization_id == organization_id, Membership.role == Role.OWNER)
        )
        or 0
    )


async def slug_exists(session: AsyncSession, slug: str) -> bool:
    return (
        await session.scalar(select(Organization.id).where(Organization.slug == slug))
    ) is not None
