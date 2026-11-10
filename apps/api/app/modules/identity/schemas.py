import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.identity.auth import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH
from app.modules.identity.permissions import Permission, Role

Locale = Literal["fr", "en"]
AssignableRole = Literal["owner", "admin", "member"]


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(_Out):
    id: uuid.UUID
    email: str | None
    display_name: str | None
    locale: Locale


class MembershipSummary(_Out):
    organization_id: uuid.UUID
    organization_name: str
    organization_slug: str
    role: Role


class MeOut(UserOut):
    memberships: list[MembershipSummary]


class MeUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    locale: Locale | None = None


# --- Accounts (ADR-0019) ------------------------------------------------------------

Password = Annotated[str, Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)]


class SignUp(BaseModel):
    email: EmailStr
    password: Password
    display_name: str = Field(min_length=1, max_length=200)
    locale: Locale = "fr"


class SignIn(BaseModel):
    email: EmailStr
    # No length rule here: a wrong password is answered like any other.
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)


class AuthSessionOut(BaseModel):
    token: str
    """Send it as `Authorization: Bearer <token>`. Shown once, never stored in clear."""
    expires_at: datetime
    user: MeOut


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
    new_password: Password


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetOut(BaseModel):
    temporary_password: str
    """Give it to the person through a channel you trust; they change it once signed in."""


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class OrganizationUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class OrganizationOut(_Out):
    id: uuid.UUID
    name: str
    slug: str
    kind: Literal["client", "internal"]
    created_at: datetime


class OrganizationWithRole(OrganizationOut):
    role: Role
    permissions: list[Permission]


class MemberOut(_Out):
    user_id: uuid.UUID
    email: str | None
    display_name: str | None
    role: Role


class MemberAdd(BaseModel):
    email: EmailStr
    role: AssignableRole = "member"


class MemberRoleUpdate(BaseModel):
    role: AssignableRole
