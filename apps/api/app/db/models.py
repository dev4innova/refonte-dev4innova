"""Import every module's models here so Alembic autogenerate sees them."""

from app.db.base import Base
from app.modules.ai_experiences.models import AIMessage, AISession
from app.modules.ai_gateway.models import AIModel, AIQuota, AIUsage, Prompt, PromptVersion
from app.modules.cms.models import Document, DocumentTranslation, Media
from app.modules.contact.models import ContactRequest
from app.modules.crm.models import Activity, Lead, Opportunity, QuoteRequest
from app.modules.diagnostic.models import Diagnostic
from app.modules.identity.models import Membership, Organization, User
from app.modules.portal.models import (
    Comment,
    Deliverable,
    Notification,
    Project,
    StoredFile,
    Task,
    Ticket,
    TicketMessage,
)

__all__ = [
    "AIMessage",
    "AIModel",
    "AIQuota",
    "AISession",
    "AIUsage",
    "Activity",
    "Base",
    "Comment",
    "ContactRequest",
    "Deliverable",
    "Diagnostic",
    "Document",
    "DocumentTranslation",
    "Lead",
    "Media",
    "Membership",
    "Notification",
    "Opportunity",
    "Organization",
    "Project",
    "Prompt",
    "PromptVersion",
    "QuoteRequest",
    "StoredFile",
    "Task",
    "Ticket",
    "TicketMessage",
    "User",
]
