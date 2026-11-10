import hashlib
import uuid
from typing import Annotated, cast

from fastapi import APIRouter, Depends, Request, Response, status
from redis.asyncio import Redis

from app.core import rate_limit
from app.core.config import get_settings
from app.core.redis import get_redis
from app.modules.contact.router import client_key
from app.modules.identity import repository, service
from app.modules.identity.dependencies import (
    AccessToken,
    CurrentUser,
    OrgContext,
    Session,
    StaffContext,
)
from app.modules.identity.models import Membership, User
from app.modules.identity.permissions import Permission, Role
from app.modules.identity.schemas import (
    AuthSessionOut,
    Locale,
    MemberAdd,
    MemberOut,
    MemberRoleUpdate,
    MembershipSummary,
    MeOut,
    MeUpdate,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
    OrganizationWithRole,
    PasswordChange,
    PasswordReset,
    PasswordResetOut,
    SignIn,
    SignUp,
)

AUTH_ERRORS: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing, invalid or expired session token"},
}
ORG_ERRORS: dict[int | str, dict[str, str]] = {
    **AUTH_ERRORS,
    403: {"description": "The member's role does not allow this action"},
    404: {"description": "Organization not found, or the user is not a member"},
}

me_router = APIRouter(prefix="/me", tags=["me"], responses=AUTH_ERRORS)
auth_router = APIRouter(prefix="/auth", tags=["auth"])
accounts_admin_router = APIRouter(
    prefix="/admin/accounts", tags=["accounts-admin"], responses=ORG_ERRORS
)

SIGN_UPS_PER_CLIENT = 10
"""Account creations per client address and hour."""
Redis_ = Annotated[Redis, Depends(get_redis)]
org_router = APIRouter(prefix="/organizations", tags=["organizations"], responses=ORG_ERRORS)


async def _me(session: Session, user: User) -> MeOut:
    memberships = await repository.list_user_memberships(session, user.id)
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        locale=cast(Locale, user.locale),
        memberships=[
            MembershipSummary(
                organization_id=m.organization_id,
                organization_name=m.organization.name,
                organization_slug=m.organization.slug,
                role=Role(m.role),
            )
            for m in memberships
        ],
    )


# --- Accounts and sessions (ADR-0019) ---------------------------------------------


def _email_key(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:32]


@auth_router.post(
    "/sign-up",
    response_model=AuthSessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account and sign in",
    responses={
        409: {"description": "An account already uses this email"},
        429: {"description": "Too many accounts created from this client"},
    },
)
async def sign_up(
    data: SignUp, request: Request, session: Session, redis: Redis_
) -> AuthSessionOut:
    await rate_limit.hit(
        redis,
        scope="auth:sign-up",
        key=client_key(request),
        limit=SIGN_UPS_PER_CLIENT,
        window_seconds=3600,
    )
    await service.register(
        session,
        email=data.email,
        password=data.password,
        display_name=data.display_name,
        locale=data.locale,
    )
    signed_in = await service.sign_in(session, email=data.email, password=data.password)
    return await _session_out(session, signed_in)


@auth_router.post(
    "/sign-in",
    response_model=AuthSessionOut,
    summary="Sign in with email and password",
    responses={
        401: {"description": "Invalid email or password (never says which)"},
        429: {"description": "Too many attempts for this client or this email"},
    },
)
async def sign_in(
    data: SignIn, request: Request, session: Session, redis: Redis_
) -> AuthSessionOut:
    settings = get_settings()
    window = settings.auth_attempts_window_seconds
    await rate_limit.hit(
        redis,
        scope="auth:sign-in:client",
        key=client_key(request),
        limit=settings.auth_attempts_per_client,
        window_seconds=window,
    )
    await rate_limit.hit(
        redis,
        scope="auth:sign-in:email",
        key=_email_key(data.email),
        limit=settings.auth_attempts_per_email,
        window_seconds=window,
    )
    signed_in = await service.sign_in(session, email=data.email, password=data.password)
    return await _session_out(session, signed_in)


async def _session_out(session: Session, signed_in: service.SignedIn) -> AuthSessionOut:
    return AuthSessionOut(
        token=signed_in.token,
        expires_at=signed_in.expires_at,
        user=await _me(session, signed_in.user),
    )


@auth_router.post(
    "/sign-out",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out (revokes the session token)",
    responses=AUTH_ERRORS,
)
async def sign_out(token: AccessToken, session: Session) -> Response:
    await service.sign_out(session, token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@me_router.get("", response_model=MeOut, summary="Current user and memberships")
async def get_me(session: Session, user: CurrentUser) -> MeOut:
    return await _me(session, user)


@me_router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change my password (signs out my other sessions)",
    responses={422: {"description": "The new password is not allowed"}},
)
async def change_password(
    data: PasswordChange, user: CurrentUser, token: AccessToken, session: Session
) -> Response:
    await service.change_password(
        session,
        user,
        current_password=data.current_password,
        new_password=data.new_password,
        token=token,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@accounts_admin_router.post(
    "/password-reset",
    response_model=PasswordResetOut,
    summary="Give a temporary password to someone who forgot theirs (staff)",
)
async def reset_password(
    data: PasswordReset, ctx: StaffContext, session: Session
) -> PasswordResetOut:
    ctx.require(Permission.ACCOUNTS_MANAGE)
    password = await service.reset_password(session, email=data.email)
    return PasswordResetOut(temporary_password=password)


@me_router.patch("", response_model=MeOut, summary="Update the current user's profile")
async def update_me(data: MeUpdate, session: Session, user: CurrentUser) -> MeOut:
    await service.update_profile(session, user, data)
    return await _me(session, user)


def _with_role(ctx: service.OrganizationContext) -> OrganizationWithRole:
    return OrganizationWithRole(
        **OrganizationOut.model_validate(ctx.organization).model_dump(),
        role=Role(ctx.membership.role),
        permissions=sorted(ctx.permissions),
    )


@org_router.get("", response_model=list[OrganizationWithRole], summary="My organizations")
async def list_organizations(session: Session, user: CurrentUser) -> list[OrganizationWithRole]:
    memberships = await repository.list_user_memberships(session, user.id)
    return [_with_role(service.OrganizationContext(user=user, membership=m)) for m in memberships]


@org_router.post(
    "",
    response_model=OrganizationWithRole,
    status_code=status.HTTP_201_CREATED,
    summary="Create an organization (the caller becomes its owner)",
    responses={409: {"description": "Slug already used"}},
)
async def create_organization(
    data: OrganizationCreate, session: Session, user: CurrentUser
) -> OrganizationWithRole:
    ctx = await service.create_organization(session, user, name=data.name, slug=data.slug)
    return _with_role(ctx)


@org_router.get("/{organization_id}", response_model=OrganizationWithRole, summary="Organization")
async def get_organization(ctx: OrgContext) -> OrganizationWithRole:
    ctx.require(Permission.ORGANIZATION_READ)
    return _with_role(ctx)


@org_router.patch(
    "/{organization_id}", response_model=OrganizationWithRole, summary="Rename an organization"
)
async def update_organization(
    data: OrganizationUpdate, ctx: OrgContext, session: Session
) -> OrganizationWithRole:
    await service.rename_organization(session, ctx, name=data.name)
    return _with_role(ctx)


def _member(membership: Membership) -> MemberOut:
    return MemberOut(
        user_id=membership.user_id,
        email=membership.user.email,
        display_name=membership.user.display_name,
        role=Role(membership.role),
    )


@org_router.get(
    "/{organization_id}/members", response_model=list[MemberOut], summary="Organization members"
)
async def list_members(ctx: OrgContext, session: Session) -> list[MemberOut]:
    ctx.require(Permission.MEMBERS_READ)
    return [_member(m) for m in await repository.list_members(session, ctx.organization_id)]


@org_router.post(
    "/{organization_id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a user (who already has an account) to the organization",
    responses={409: {"description": "Already a member"}},
)
async def add_member(data: MemberAdd, ctx: OrgContext, session: Session) -> MemberOut:
    return _member(await service.add_member(session, ctx, email=data.email, role=data.role))


@org_router.patch(
    "/{organization_id}/members/{user_id}",
    response_model=MemberOut,
    summary="Change a member's role",
    responses={409: {"description": "Would leave the organization without an owner"}},
)
async def change_member_role(
    user_id: uuid.UUID, data: MemberRoleUpdate, ctx: OrgContext, session: Session
) -> MemberOut:
    return _member(await service.change_member_role(session, ctx, user_id=user_id, role=data.role))


@org_router.delete(
    "/{organization_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member (or leave the organization)",
    responses={409: {"description": "Would leave the organization without an owner"}},
)
async def remove_member(user_id: uuid.UUID, ctx: OrgContext, session: Session) -> Response:
    await service.remove_member(session, ctx, user_id=user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
