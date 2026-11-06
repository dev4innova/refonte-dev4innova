"""Identity business rules: provisioning, profiles, organizations, memberships."""

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from app.modules.identity import repository
from app.modules.identity.auth import TokenClaims
from app.modules.identity.models import Membership, Organization, User
from app.modules.identity.permissions import Permission, Role, can_assign, permissions_for
from app.modules.identity.schemas import MeUpdate


@dataclass(frozen=True)
class OrganizationContext:
    """The current user acting inside one organization (resolved per request)."""

    user: User
    membership: Membership

    @property
    def organization(self) -> Organization:
        return self.membership.organization

    @property
    def organization_id(self) -> uuid.UUID:
        return self.membership.organization_id

    @property
    def permissions(self) -> frozenset[Permission]:
        return permissions_for(self.membership.role)

    def require(self, permission: Permission) -> None:
        if permission not in self.permissions:
            raise PermissionDeniedError("You do not have permission to perform this action")


# --- Users (TASK-040) -------------------------------------------------------------


LAST_SEEN_RESOLUTION = timedelta(minutes=15)

UserInfoFetcher = Callable[[str], Awaitable[dict[str, object]]]
"""Calls the identity provider's userinfo endpoint with an access token."""


def _locale(value: str | None) -> str:
    return value[:2] if value and value[:2] in ("fr", "en") else "fr"


async def provision_user(
    session: AsyncSession,
    claims: TokenClaims,
    *,
    access_token: str = "",
    fetch_userinfo: UserInfoFetcher | None = None,
) -> User:
    """Creates the user on first login (just-in-time) and keeps identity claims fresh.

    Zitadel access tokens do not carry the email by default: it is read once from the
    userinfo endpoint. Writes happen only when something changed, or every 15 minutes
    for `last_login_at`, so authenticated requests do not all write to the database.
    """
    user = await repository.get_user_by_subject(session, claims.subject)

    if fetch_userinfo and not claims.email and (user is None or user.email is None):
        info = await fetch_userinfo(access_token)
        claims = replace(
            claims,
            email=claims.email or _str(info.get("email")),
            name=claims.name or _str(info.get("name")),
            locale=claims.locale or _str(info.get("locale")),
        )

    now = datetime.now(UTC)
    changed = user is None
    if user is None:
        user = User(external_subject=claims.subject, locale=_locale(claims.locale))
        session.add(user)
    if claims.email and user.email != claims.email.lower():
        user.email = claims.email.lower()
        changed = True
    if claims.name and not user.display_name:
        user.display_name = claims.name
        changed = True
    if user.last_login_at is None or now - user.last_login_at > LAST_SEEN_RESOLUTION:
        user.last_login_at = now
        changed = True

    if changed:
        await session.commit()
    return user


def _str(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


async def update_profile(session: AsyncSession, user: User, data: MeUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value)
    await session.commit()
    return user


# --- Organizations (TASK-041) -----------------------------------------------------


async def resolve_context(
    session: AsyncSession, user: User, organization_id: uuid.UUID
) -> OrganizationContext:
    """Isolation boundary: a non-member gets 404, never a hint that the organization exists."""
    membership = await repository.get_membership(
        session, organization_id=organization_id, user_id=user.id
    )
    if membership is None:
        raise NotFoundError("Organization not found")
    return OrganizationContext(user=user, membership=membership)


async def create_organization(
    session: AsyncSession, user: User, *, name: str, slug: str
) -> OrganizationContext:
    if await repository.slug_exists(session, slug):
        raise ConflictError("This slug is already used", {"field": "slug"})
    organization = Organization(name=name, slug=slug, kind="client")
    membership = Membership(organization=organization, user=user, role=Role.OWNER)
    session.add_all([organization, membership])
    await session.commit()
    return OrganizationContext(user=user, membership=membership)


async def rename_organization(
    session: AsyncSession, ctx: OrganizationContext, *, name: str
) -> Organization:
    ctx.require(Permission.ORGANIZATION_UPDATE)
    ctx.organization.name = name
    await session.commit()
    return ctx.organization


# --- Memberships (TASK-042) -------------------------------------------------------


async def add_member(
    session: AsyncSession, ctx: OrganizationContext, *, email: str, role: str
) -> Membership:
    ctx.require(Permission.MEMBERS_MANAGE)
    if not can_assign(ctx.membership.role, role):
        raise PermissionDeniedError("You cannot grant this role")

    user = await repository.get_user_by_email(session, email)
    if user is None:
        # Invitations of people who never signed in arrive with transactional emails.
        raise NotFoundError("No user with this email has signed in yet", {"field": "email"})
    existing = await repository.get_membership(
        session, organization_id=ctx.organization_id, user_id=user.id
    )
    if existing is not None:
        raise ConflictError("This user is already a member", {"field": "email"})

    membership = Membership(organization_id=ctx.organization_id, user=user, role=role)
    session.add(membership)
    await session.commit()
    return membership


async def _get_target(
    session: AsyncSession, ctx: OrganizationContext, user_id: uuid.UUID
) -> Membership:
    target = await repository.get_membership(
        session, organization_id=ctx.organization_id, user_id=user_id
    )
    if target is None:
        raise NotFoundError("Member not found")
    return target


async def _ensure_not_last_owner(
    session: AsyncSession, ctx: OrganizationContext, target: Membership
) -> None:
    if (
        target.role == Role.OWNER
        and await repository.count_owners(session, ctx.organization_id) <= 1
    ):
        raise ConflictError("An organization must keep at least one owner")


async def change_member_role(
    session: AsyncSession, ctx: OrganizationContext, *, user_id: uuid.UUID, role: str
) -> Membership:
    ctx.require(Permission.MEMBERS_MANAGE)
    target = await _get_target(session, ctx, user_id)
    if not (can_assign(ctx.membership.role, target.role) and can_assign(ctx.membership.role, role)):
        raise PermissionDeniedError("You cannot change this member's role")
    if role != Role.OWNER:
        await _ensure_not_last_owner(session, ctx, target)
    target.role = role
    await session.commit()
    return target


async def remove_member(
    session: AsyncSession, ctx: OrganizationContext, *, user_id: uuid.UUID
) -> None:
    is_self = user_id == ctx.user.id
    if not is_self:
        ctx.require(Permission.MEMBERS_MANAGE)
    target = await _get_target(session, ctx, user_id)
    if not is_self and not can_assign(ctx.membership.role, target.role):
        raise PermissionDeniedError("You cannot remove this member")
    await _ensure_not_last_owner(session, ctx, target)
    await session.delete(target)
    await session.commit()
