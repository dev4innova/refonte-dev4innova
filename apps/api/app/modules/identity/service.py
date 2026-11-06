"""Identity business rules: provisioning, profiles, organizations, memberships."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

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


async def provision_user(session: AsyncSession, claims: TokenClaims) -> User:
    """Creates the user on first login (just-in-time) and refreshes identity claims."""
    user = await repository.get_user_by_subject(session, claims.subject)
    if user is None:
        user = User(
            external_subject=claims.subject,
            locale=claims.locale[:2]
            if claims.locale and claims.locale[:2] in ("fr", "en")
            else "fr",
        )
        session.add(user)
    if claims.email:
        user.email = claims.email.lower()
    if claims.name and not user.display_name:
        user.display_name = claims.name
    user.last_login_at = datetime.now(UTC)
    await session.commit()
    return user


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
