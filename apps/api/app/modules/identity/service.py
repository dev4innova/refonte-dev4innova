"""Identity business rules: accounts and sessions, profiles, organizations, memberships."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    UnauthorizedError,
    ValidationError,
)
from app.modules.identity import auth, repository
from app.modules.identity.models import AuthSession, Membership, Organization, User
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


# --- Accounts and sessions (ADR-0019) ---------------------------------------------


SESSION_LIFETIME = timedelta(days=30)
LAST_SEEN_RESOLUTION = timedelta(minutes=15)


def _locale(value: str | None) -> str:
    return value[:2] if value and value[:2] in ("fr", "en") else "fr"


def _check_password(password: str, email: str) -> None:
    if len(password) < auth.PASSWORD_MIN_LENGTH or len(password) > auth.PASSWORD_MAX_LENGTH:
        raise ValidationError("Password length is not allowed", {"field": "password"})
    if password.strip().lower() == email.lower():
        raise ValidationError("The password must differ from the email", {"field": "password"})


async def register(
    session: AsyncSession, *, email: str, password: str, display_name: str, locale: str
) -> User:
    email = email.strip().lower()
    _check_password(password, email)
    if await repository.get_user_by_email(session, email) is not None:
        raise ConflictError("An account already uses this email", {"field": "email"})
    user = User(
        email=email,
        password_hash=auth.hash_password(password),
        password_changed_at=datetime.now(UTC),
        display_name=display_name.strip(),
        locale=_locale(locale),
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:  # two sign-ups with the same email at once
        await session.rollback()
        raise ConflictError("An account already uses this email", {"field": "email"}) from exc
    return user


@dataclass(frozen=True)
class SignedIn:
    user: User
    token: str
    """Returned once; only its hash is stored."""
    expires_at: datetime


async def _open_session(session: AsyncSession, user: User) -> SignedIn:
    now = datetime.now(UTC)
    token = auth.new_session_token()
    expires_at = now + SESSION_LIFETIME
    session.add(
        AuthSession(
            user_id=user.id,
            token_hash=auth.token_hash(token),
            expires_at=expires_at,
            last_used_at=now,
        )
    )
    user.last_login_at = now
    await session.commit()
    return SignedIn(user=user, token=token, expires_at=expires_at)


async def sign_in(session: AsyncSession, *, email: str, password: str) -> SignedIn:
    """The same error, after the same work, for an unknown email or a wrong password."""
    user = await repository.get_user_by_email(session, email.strip().lower())
    if not auth.verify_password(user.password_hash if user else None, password) or user is None:
        raise UnauthorizedError("Invalid email or password")
    assert user.password_hash is not None
    if auth.needs_rehash(user.password_hash):
        user.password_hash = auth.hash_password(password)
    return await _open_session(session, user)


async def authenticate(session: AsyncSession, token: str) -> User:
    """The user behind a session token; refreshes `last_used_at` at most every 15 min."""
    found = await repository.get_active_session(session, auth.token_hash(token))
    if found is None:
        raise UnauthorizedError("Invalid or expired session")
    now = datetime.now(UTC)
    if now - found.last_used_at > LAST_SEEN_RESOLUTION:
        found.last_used_at = now
        await session.commit()
    return found.user


async def sign_out(session: AsyncSession, token: str) -> None:
    await repository.delete_session(session, auth.token_hash(token))
    await session.commit()


async def change_password(
    session: AsyncSession, user: User, *, current_password: str, new_password: str, token: str
) -> None:
    """Every other session is signed out; the current one stays."""
    if not auth.verify_password(user.password_hash, current_password):
        # 422, not 401: the session is valid, only this field is wrong.
        raise ValidationError("The current password is wrong", {"field": "current_password"})
    _check_password(new_password, user.email)
    user.password_hash = auth.hash_password(new_password)
    user.password_changed_at = datetime.now(UTC)
    await repository.delete_sessions_of(session, user.id, keep_token_hash=auth.token_hash(token))
    await session.commit()


async def reset_password(session: AsyncSession, *, email: str) -> str:
    """Staff action for a forgotten password: a temporary password, shown once, and every
    session of the account is signed out."""
    user = await repository.get_user_by_email(session, email.strip().lower())
    if user is None:
        raise NotFoundError("No account with this email", {"field": "email"})
    password = auth.temporary_password()
    user.password_hash = auth.hash_password(password)
    user.password_changed_at = datetime.now(UTC)
    await repository.delete_sessions_of(session, user.id)
    await session.commit()
    return password


async def purge_expired_sessions(session: AsyncSession) -> int:
    deleted = await repository.delete_expired_sessions(session, datetime.now(UTC))
    await session.commit()
    return deleted


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
        raise NotFoundError("No account with this email yet", {"field": "email"})
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
