"""Roles and permissions (TASK-043).

Roles are stored on memberships, so a user can be `owner` of one organization and
`member` of another. Permissions are derived from roles in code: adding a permission
never needs a migration. Domain permissions (CMS, CRM, ...) join this map in their epics.
"""

from enum import StrEnum
from typing import Final


class Role(StrEnum):
    # Client organizations
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    # DEV4INNOVA staff, members of the internal organization
    STAFF_ADMIN = "staff_admin"
    STAFF_EDITOR = "staff_editor"
    STAFF_SALES = "staff_sales"


ROLES: Final = tuple(role.value for role in Role)


class Permission(StrEnum):
    ORGANIZATION_READ = "organization:read"
    ORGANIZATION_UPDATE = "organization:update"
    MEMBERS_READ = "members:read"
    MEMBERS_MANAGE = "members:manage"
    # CMS (EPIC 06), only meaningful in the internal DEV4INNOVA organization
    CONTENT_READ = "content:read"
    CONTENT_WRITE = "content:write"
    CONTENT_PUBLISH = "content:publish"
    MEDIA_MANAGE = "media:manage"
    # CRM (EPIC 07), only meaningful in the internal DEV4INNOVA organization
    CRM_READ = "crm:read"
    CRM_WRITE = "crm:write"
    CRM_ASSIGN = "crm:assign"
    CRM_DELETE = "crm:delete"
    """Erase a prospect and its history (GDPR right to erasure)."""


_READ: Final = frozenset({Permission.ORGANIZATION_READ, Permission.MEMBERS_READ})
_ORG_ALL: Final = _READ | {Permission.ORGANIZATION_UPDATE, Permission.MEMBERS_MANAGE}
_CONTENT_ALL: Final = frozenset(
    {
        Permission.CONTENT_READ,
        Permission.CONTENT_WRITE,
        Permission.CONTENT_PUBLISH,
        Permission.MEDIA_MANAGE,
    }
)
_CRM_SALES: Final = frozenset({Permission.CRM_READ, Permission.CRM_WRITE, Permission.CRM_ASSIGN})
_ALL: Final = frozenset(Permission)

ROLE_PERMISSIONS: Final[dict[Role, frozenset[Permission]]] = {
    Role.OWNER: _ORG_ALL,
    Role.ADMIN: _ORG_ALL,
    Role.MEMBER: _READ,
    Role.STAFF_ADMIN: _ALL,
    Role.STAFF_EDITOR: _READ | _CONTENT_ALL,
    Role.STAFF_SALES: _READ | _CRM_SALES | {Permission.CONTENT_READ},
}

STAFF_ROLES: Final = frozenset({Role.STAFF_ADMIN, Role.STAFF_EDITOR, Role.STAFF_SALES})


def permissions_for(role: str) -> frozenset[Permission]:
    return ROLE_PERMISSIONS.get(Role(role), frozenset())


def can_assign(actor_role: str, target_role: str) -> bool:
    """Only owners grant or revoke the owner role; nobody assigns staff roles through the API."""
    if Role(target_role) in STAFF_ROLES:
        return False
    if Role(target_role) is Role.OWNER:
        return Role(actor_role) is Role.OWNER
    return Permission.MEMBERS_MANAGE in permissions_for(actor_role)
