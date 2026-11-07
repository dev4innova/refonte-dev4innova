"""Import every module's models here so Alembic autogenerate sees them."""

from app.db.base import Base
from app.modules.contact.models import ContactRequest
from app.modules.identity.models import Membership, Organization, User

__all__ = ["Base", "ContactRequest", "Membership", "Organization", "User"]
