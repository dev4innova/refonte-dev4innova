"""Authentication and organization context dependencies (TASK-044).

Every protected endpoint depends on `CurrentUser`; every tenant-scoped endpoint on
`OrgContext`, which only resolves for members of the organization in the URL.
"""

import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnauthorizedError
from app.db.session import get_session
from app.modules.identity import service
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID, User

_bearer = HTTPBearer(auto_error=False, description="Session token returned by POST /auth/sign-in")

Session = Annotated[AsyncSession, Depends(get_session)]


async def get_access_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Authentication required")
    return credentials.credentials


AccessToken = Annotated[str, Depends(get_access_token)]


async def get_current_user(token: AccessToken, session: Session) -> User:
    return await service.authenticate(session, token)


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_org_context(
    organization_id: uuid.UUID, user: CurrentUser, session: Session
) -> service.OrganizationContext:
    return await service.resolve_context(session, user, organization_id)


OrgContext = Annotated[service.OrganizationContext, Depends(get_org_context)]


async def get_staff_context(user: CurrentUser, session: Session) -> service.OrganizationContext:
    """The current user acting as DEV4INNOVA staff (member of the internal organization).
    Anyone else gets 404, like for any organization they do not belong to."""
    return await service.resolve_context(session, user, INTERNAL_ORGANIZATION_ID)


StaffContext = Annotated[service.OrganizationContext, Depends(get_staff_context)]
