import hashlib
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import rate_limit
from app.core.config import get_settings
from app.core.redis import get_redis
from app.db.session import get_session
from app.modules.contact.models import ContactRequest
from app.modules.contact.schemas import ContactRequestAccepted, ContactRequestCreate

router = APIRouter(prefix="/contact-requests", tags=["contact"])

PER_CLIENT_LIMIT = 5
PER_EMAIL_LIMIT = 3
WINDOW_SECONDS = 3600


def client_key(request: Request) -> str:
    """Hashed client address (never stored). Behind the web app or a reverse proxy, set
    TRUST_FORWARDED_FOR so the visitor's address is used rather than the proxy's."""
    address = request.client.host if request.client else "unknown"
    if get_settings().trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        address = forwarded.split(",")[0].strip() or address
    return hashlib.sha256(address.encode()).hexdigest()[:32]


@router.post(
    "",
    response_model=ContactRequestAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Send a message from the website contact form (public)",
    responses={429: {"description": "Too many requests from this client or email"}},
)
async def create_contact_request(
    data: ContactRequestCreate,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ContactRequestAccepted:
    await rate_limit.hit(
        redis,
        scope="contact:client",
        key=client_key(request),
        limit=PER_CLIENT_LIMIT,
        window_seconds=WINDOW_SECONDS,
    )
    if data.website:
        # Honeypot filled in: answer like a success so bots learn nothing.
        return ContactRequestAccepted(id=None)

    email = data.email.lower()
    await rate_limit.hit(
        redis,
        scope="contact:email",
        key=hashlib.sha256(email.encode()).hexdigest()[:32],
        limit=PER_EMAIL_LIMIT,
        window_seconds=WINDOW_SECONDS,
    )

    contact = ContactRequest(
        name=data.name,
        email=email,
        company=data.company or None,
        topic=data.topic,
        message=data.message,
        locale=data.locale,
        consent_at=datetime.now(UTC),
    )
    session.add(contact)
    await session.commit()
    return ContactRequestAccepted(id=contact.id)
