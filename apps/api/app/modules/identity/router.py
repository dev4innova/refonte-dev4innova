import uuid
from typing import cast

from fastapi import APIRouter, Response, status

from app.modules.identity import repository, service
from app.modules.identity.dependencies import CurrentUser, OrgContext, Session
from app.modules.identity.models import Membership
from app.modules.identity.permissions import Permission, Role
from app.modules.identity.schemas import (
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
)

AUTH_ERRORS: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing or invalid access token"},
}
ORG_ERRORS: dict[int | str, dict[str, str]] = {
    **AUTH_ERRORS,
    403: {"description": "The member's role does not allow this action"},
    404: {"description": "Organization not found, or the user is not a member"},
}

me_router = APIRouter(prefix="/me", tags=["me"], responses=AUTH_ERRORS)
org_router = APIRouter(prefix="/organizations", tags=["organizations"], responses=ORG_ERRORS)


async def _me(session: Session, user: CurrentUser) -> MeOut:
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


@me_router.get("", response_model=MeOut, summary="Current user and memberships")
async def get_me(session: Session, user: CurrentUser) -> MeOut:
    """Signs the user up on first call (just-in-time provisioning from the token claims)."""
    return await _me(session, user)


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
    summary="Add a user (who has already signed in) to the organization",
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
