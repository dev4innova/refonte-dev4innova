"""In-app notifications (TASK-102): each user only ever sees their own, and only while
they still belong to the organization concerned (or to the staff, for staff ones)."""

import uuid

from sqlalchemy import ColumnElement, and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID, Membership, User
from app.modules.portal import access
from app.modules.portal.models import Notification
from app.modules.portal.schemas import NotificationOut, NotificationPage


def _visible(user: User) -> ColumnElement[bool]:
    member_of = select(Membership.organization_id).where(Membership.user_id == user.id)
    staff = (
        select(Membership.id)
        .where(
            Membership.user_id == user.id,
            Membership.organization_id == INTERNAL_ORGANIZATION_ID,
        )
        .exists()
    )
    return and_(
        Notification.user_id == user.id,
        or_(
            and_(Notification.for_staff.is_(True), staff),
            and_(Notification.for_staff.is_(False), Notification.organization_id.in_(member_of)),
        ),
    )


async def unread_count(session: AsyncSession, user: User) -> int:
    return (
        await session.scalar(
            select(func.count())
            .select_from(Notification)
            .where(_visible(user), Notification.read_at.is_(None))
        )
        or 0
    )


async def list_notifications(
    session: AsyncSession, user: User, *, unread_only: bool, page: int, page_size: int
) -> NotificationPage:
    query = select(Notification).where(_visible(user))
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(
        await session.scalars(
            query.order_by(Notification.created_at.desc(), Notification.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    orgs = await access.organizations(session, [n.organization_id for n in rows])
    return NotificationPage(
        items=[
            NotificationOut(
                id=n.id,
                type=n.type,
                organization=orgs[n.organization_id],
                data=n.data,
                for_staff=n.for_staff,
                read=n.read_at is not None,
                created_at=n.created_at,
            )
            for n in rows
        ],
        unread=await unread_count(session, user),
        total=total,
        page=page,
        page_size=page_size,
    )


async def mark_read(session: AsyncSession, user: User, notification_id: uuid.UUID) -> None:
    result = await session.execute(
        update(Notification)
        .where(_visible(user), Notification.id == notification_id)
        .values(read_at=func.coalesce(Notification.read_at, access.now()))
        .returning(Notification.id)
    )
    if result.first() is None:
        raise NotFoundError("Notification not found")
    await session.commit()


async def mark_all_read(session: AsyncSession, user: User) -> None:
    await session.execute(
        update(Notification)
        .where(_visible(user), Notification.read_at.is_(None))
        .values(read_at=access.now())
    )
    await session.commit()
