import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

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
