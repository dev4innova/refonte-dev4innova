"""Import every module's models here so Alembic autogenerate sees them."""

from app.db.base import Base
from app.modules.cms.models import Document, DocumentTranslation, Media
from app.modules.contact.models import ContactRequest
from app.modules.crm.models import Activity, Lead, Opportunity, QuoteRequest
from app.modules.identity.models import Membership, Organization, User

__all__ = [
    "Activity",
    "Base",
    "ContactRequest",
    "Document",
    "DocumentTranslation",
    "Lead",
    "Media",
    "Membership",
    "Opportunity",
    "Organization",
    "QuoteRequest",
    "User",
]
