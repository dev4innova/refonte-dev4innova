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


_READ: Final = frozenset({Permission.ORGANIZATION_READ, Permission.MEMBERS_READ})
_ALL: Final = frozenset(Permission)

ROLE_PERMISSIONS: Final[dict[Role, frozenset[Permission]]] = {
    Role.OWNER: _ALL,
    Role.ADMIN: _ALL,
    Role.MEMBER: _READ,
    Role.STAFF_ADMIN: _ALL,
    Role.STAFF_EDITOR: _READ,
    Role.STAFF_SALES: _READ,
}


def permissions_for(role: str) -> frozenset[Permission]:
    return ROLE_PERMISSIONS.get(Role(role), frozenset())


def can_assign(actor_role: str, target_role: str) -> bool:
    """Only owners grant or revoke the owner role; nobody assigns staff roles through the API."""
    if Role(target_role) in {Role.STAFF_ADMIN, Role.STAFF_EDITOR, Role.STAFF_SALES}:
        return False
    if Role(target_role) is Role.OWNER:
        return Role(actor_role) is Role.OWNER
    return Permission.MEMBERS_MANAGE in permissions_for(actor_role)
