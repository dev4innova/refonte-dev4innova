"""Data access for identity. Tenant-scoped queries always take an organization_id."""

import uuid
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.identity.models import AuthSession, Membership, Organization, User
from app.modules.identity.permissions import Role


async def get_active_session(session: AsyncSession, token_hash: str) -> AuthSession | None:
    return await session.scalar(
        select(AuthSession)
        .options(joinedload(AuthSession.user))
        .where(AuthSession.token_hash == token_hash, AuthSession.expires_at > func.now())
    )


async def delete_session(session: AsyncSession, token_hash: str) -> None:
    await session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))


async def delete_sessions_of(
    session: AsyncSession, user_id: uuid.UUID, *, keep_token_hash: str | None = None
) -> None:
    statement = delete(AuthSession).where(AuthSession.user_id == user_id)
    if keep_token_hash is not None:
        statement = statement.where(AuthSession.token_hash != keep_token_hash)
    await session.execute(statement)


async def delete_expired_sessions(session: AsyncSession, now: datetime) -> int:
    result = await session.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
    return int(getattr(result, "rowcount", 0) or 0)


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
