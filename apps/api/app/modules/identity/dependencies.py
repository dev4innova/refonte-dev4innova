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
from app.modules.identity.auth import TokenClaims, TokenVerifier, get_token_verifier
from app.modules.identity.models import User

_bearer = HTTPBearer(auto_error=False, description="Zitadel access token (JWT)")

Session = Annotated[AsyncSession, Depends(get_session)]


async def get_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
) -> TokenClaims:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Authentication required")
    return await verifier.verify(credentials.credentials)


async def get_current_user(
    claims: Annotated[TokenClaims, Depends(get_claims)], session: Session
) -> User:
    return await service.provision_user(session, claims)


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_org_context(
    organization_id: uuid.UUID, user: CurrentUser, session: Session
) -> service.OrganizationContext:
    return await service.resolve_context(session, user, organization_id)


OrgContext = Annotated[service.OrganizationContext, Depends(get_org_context)]
