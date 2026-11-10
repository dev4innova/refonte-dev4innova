"""Online payment with Stripe Checkout (TASK-113), subscriptions (TASK-114), paid courses.

We never handle card data: the browser goes to a Checkout page hosted by Stripe. What was
paid is only trusted when Stripe tells us through a signed webhook; each event is handled
once (billing_stripe_events), and every write is idempotent.
"""

import secrets
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError
from app.modules.academy.models import Course, Enrollment
from app.modules.billing import catalog, common, invoices
from app.modules.billing.common import now, require_client
from app.modules.billing.invoices import Line
from app.modules.billing.models import (
    BillingProfile,
    Checkout,
    Invoice,
    Product,
    StripeEvent,
    Subscription,
)
from app.modules.billing.schemas import (
    BillingOrganization,
    CheckoutOut,
    CourseCheckoutIn,
    CourseOffer,
    SubscriptionOut,
)
from app.modules.billing.stripe import CheckoutItem, CheckoutRequest, StripeGateway
from app.modules.identity.models import Membership, Organization, User
from app.modules.identity.permissions import Permission, Role, permissions_for
from app.modules.identity.service import OrganizationContext


def _site(locale: str, path: str) -> str:
    return f"{get_settings().site_url.rstrip('/')}/{locale}{path}"


def _portal(locale: str, organization_id: uuid.UUID, extra: str = "") -> str:
    base = "/espace-client/portail" if locale == "fr" else "/account/portal"
    section = "facturation" if locale == "fr" else "billing"
    return _site(locale, f"{base}/{organization_id}/{section}{extra}")


async def _customer_id(
    session: AsyncSession, stripe: StripeGateway, organization: Organization
) -> tuple[str | None, str]:
    """Stripe customer of the organization (created from its billing profile), and its email."""
    found = await common.profile(session, organization.id)
    if found is None:
        return None, ""
    if not found.stripe_customer_id:
        found.stripe_customer_id = await stripe.create_customer(
            name=found.legal_name,
            email=found.email,
            metadata={"organization_id": str(organization.id)},
        )
        await session.flush()
    return found.stripe_customer_id, found.email


async def _open(
    session: AsyncSession,
    stripe: StripeGateway,
    *,
    organization: Organization,
    user: User,
    purpose: str,
    mode: str,
    item: CheckoutItem,
    success_url: str,
    cancel_url: str,
    invoice_id: uuid.UUID | None = None,
    product_id: uuid.UUID | None = None,
) -> CheckoutOut:
    customer_id, email = await _customer_id(session, stripe, organization)
    session_ = await stripe.create_checkout(
        CheckoutRequest(
            mode=mode,
            item=item,
            customer_id=customer_id,
            customer_email=email or user.email or "",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"organization_id": str(organization.id), "purpose": purpose},
        )
    )
    session.add(
        Checkout(
            organization_id=organization.id,
            purpose=purpose,
            stripe_session_id=session_.id,
            invoice_id=invoice_id,
            product_id=product_id,
            user_id=user.id,
            amount_cents=item.amount_cents,
            created_at=now(),
        )
    )
    await session.commit()
    return CheckoutOut(url=session_.url)


# --- Paying an invoice -------------------------------------------------------------------


async def pay_invoice(
    session: AsyncSession,
    ctx: OrganizationContext,
    stripe: StripeGateway,
    invoice_id: uuid.UUID,
    locale: str,
) -> CheckoutOut:
    require_client(ctx)
    invoice = await invoices.get_invoice(session, ctx, invoice_id)
    due = invoice.gross_cents - invoice.paid_cents
    if invoice.kind != "invoice" or invoice.status != "issued" or due <= 0:
        raise ConflictError("Nothing is due on this invoice")
    return await _open(
        session,
        stripe,
        organization=ctx.organization,
        user=ctx.user,
        purpose="invoice",
        mode="payment",
        item=CheckoutItem(name=f"Facture {invoice.number}", amount_cents=due),
        success_url=_portal(
            locale,
            ctx.organization_id,
            f"/factures/{invoice.id}?paid=1"
            if locale == "fr"
            else f"/invoices/{invoice.id}?paid=1",
        ),
        cancel_url=_portal(
            locale,
            ctx.organization_id,
            f"/factures/{invoice.id}" if locale == "fr" else f"/invoices/{invoice.id}",
        ),
        invoice_id=invoice.id,
    )


# --- Subscriptions (TASK-114) ------------------------------------------------------------


async def subscribe(
    session: AsyncSession,
    ctx: OrganizationContext,
    stripe: StripeGateway,
    product_id: uuid.UUID,
    locale: str,
) -> CheckoutOut:
    require_client(ctx)
    product = await session.get(Product, product_id)
    if product is None or product.kind != "subscription" or not product.active:
        raise NotFoundError("Offer not found")
    await common.customer(session, ctx.organization_id)  # billing details required
    already = await session.scalar(
        select(Subscription.id).where(
            Subscription.organization_id == ctx.organization_id,
            Subscription.product_id == product.id,
            Subscription.status.in_(("active", "past_due")),
        )
    )
    if already:
        raise ConflictError("The organization already has this subscription")
    return await _open(
        session,
        stripe,
        organization=ctx.organization,
        user=ctx.user,
        purpose="subscription",
        mode="subscription",
        item=CheckoutItem(
            name=common.text(product.name, locale),
            amount_cents=common.gross(product),
            interval=product.interval,
        ),
        success_url=_portal(locale, ctx.organization_id, "?subscribed=1"),
        cancel_url=_portal(locale, ctx.organization_id),
        product_id=product.id,
    )


async def subscriptions_out(
    session: AsyncSession, rows: list[Subscription], locale: str
) -> list[SubscriptionOut]:
    products = (
        {
            p.id: p
            for p in await session.scalars(
                select(Product).where(Product.id.in_({s.product_id for s in rows}))
            )
        }
        if rows
        else {}
    )
    orgs = await common.organizations(session, [s.organization_id for s in rows])
    return [
        SubscriptionOut(
            id=s.id,
            organization=orgs[s.organization_id],
            offer=common.offer(products[s.product_id], locale),
            status=s.status,
            current_period_end=s.current_period_end,
            cancel_at_period_end=s.cancel_at_period_end,
            created_at=s.created_at,
        )
        for s in rows
    ]


async def list_subscriptions(
    session: AsyncSession, ctx: OrganizationContext, locale: str
) -> list[SubscriptionOut]:
    limited = common.scope(ctx)
    query = select(Subscription).where(Subscription.status != "incomplete")
    if limited:
        query = query.where(Subscription.organization_id == limited)
    rows = list(await session.scalars(query.order_by(Subscription.created_at.desc())))
    return await subscriptions_out(session, rows, locale)


async def set_cancellation(
    session: AsyncSession,
    ctx: OrganizationContext,
    stripe: StripeGateway,
    subscription_id: uuid.UUID,
    cancel: bool,
) -> None:
    """Cancels at the end of the paid period (or resumes); Stripe confirms through a webhook."""
    limited = common.scope(ctx)
    query = select(Subscription).where(Subscription.id == subscription_id)
    if limited:
        query = query.where(Subscription.organization_id == limited)
    subscription = await session.scalar(query)
    if subscription is None:
        raise NotFoundError("Subscription not found")
    if subscription.status not in ("active", "past_due") or not subscription.stripe_subscription_id:
        raise ConflictError("This subscription is not running")
    await stripe.cancel_at_period_end(subscription.stripe_subscription_id, cancel)
    subscription.cancel_at_period_end = cancel
    await session.commit()


# --- Paid courses ------------------------------------------------------------------------


def _can_buy(role: str) -> bool:
    return Permission.BILLING_MANAGE in permissions_for(role)


async def _buying_organizations(session: AsyncSession, user: User) -> list[Organization]:
    rows = await session.execute(
        select(Organization, Membership.role)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id, Organization.kind == "client")
        .order_by(Organization.name)
    )
    return [o for o, role in rows if _can_buy(role)]


async def course_offer(
    session: AsyncSession, slug: str, locale: str, user: User | None
) -> CourseOffer:
    course = await session.scalar(
        select(Course).where(Course.slug == slug, Course.status == "published")
    )
    product = await catalog.course_product(session, course.id) if course else None
    if course is None or product is None:
        raise NotFoundError("This course is free")
    orgs = await _buying_organizations(session, user) if user else []
    return CourseOffer(
        **common.offer(product, locale).model_dump(),
        course_slug=course.slug,
        online_payment=get_settings().online_payments,
        billing_organizations=[
            BillingOrganization(id=o.id, name=o.name, slug=o.slug) for o in orgs
        ],
    )


async def _personal_organization(session: AsyncSession, user: User) -> Organization:
    """A personal billing space for someone who buys as an individual (created once)."""
    slug = f"perso-{user.id.hex[:12]}"
    organization = await session.scalar(select(Organization).where(Organization.slug == slug))
    if organization is None:
        organization = Organization(
            name=user.display_name or user.email or "Compte personnel", slug=slug, kind="client"
        )
        session.add(organization)
        await session.flush()
        session.add(
            Membership(organization_id=organization.id, user_id=user.id, role=Role.OWNER.value)
        )
        await session.flush()
    return organization


async def buy_course(
    session: AsyncSession, user: User, stripe: StripeGateway, slug: str, data: CourseCheckoutIn
) -> CheckoutOut:
    course = await session.scalar(
        select(Course).where(Course.slug == slug, Course.status == "published")
    )
    product = await catalog.course_product(session, course.id) if course else None
    if course is None or product is None:
        raise NotFoundError("This course is not for sale")
    if await session.scalar(
        select(Enrollment.id).where(
            Enrollment.course_id == course.id, Enrollment.user_id == user.id
        )
    ):
        raise ConflictError("You already follow this course", {"reason": "enrolled"})
    if data.organization_id:
        organization = next(
            (o for o in await _buying_organizations(session, user) if o.id == data.organization_id),
            None,
        )
        if organization is None:
            raise NotFoundError("Organization not found")
    else:
        organization = await _personal_organization(session, user)
    academy = "/espace-client/formations" if data.locale == "fr" else "/account/academy"
    return await _open(
        session,
        stripe,
        organization=organization,
        user=user,
        purpose="course",
        mode="payment",
        item=CheckoutItem(
            name=common.text(product.name, data.locale), amount_cents=common.gross(product)
        ),
        success_url=_site(data.locale, f"{academy}/{course.slug}?paid=1"),
        cancel_url=_site(data.locale, f"/academy/{course.slug}"),
        product_id=product.id,
    )


# --- Webhooks ------------------------------------------------------------------------------


def _timestamp(value: Any) -> datetime | None:
    return datetime.fromtimestamp(int(value), tz=UTC) if value else None


async def _ensure_profile(
    session: AsyncSession, organization_id: uuid.UUID, obj: dict[str, Any]
) -> None:
    """Billing details collected by Checkout, when the organization had none."""
    if await common.profile(session, organization_id):
        return
    details = obj.get("customer_details") or {}
    address = details.get("address") or {}
    if not details.get("email"):
        return
    session.add(
        BillingProfile(
            organization_id=organization_id,
            legal_name=details.get("name") or details["email"],
            address=", ".join(p for p in (address.get("line1"), address.get("line2")) if p) or "-",
            postal_code=address.get("postal_code") or "-",
            city=address.get("city") or "-",
            country=(address.get("country") or "FR")[:2],
            email=details["email"],
            stripe_customer_id=obj.get("customer"),
        )
    )
    await session.flush()


async def _session_completed(session: AsyncSession, obj: dict[str, Any]) -> None:
    checkout = await session.scalar(
        select(Checkout).where(Checkout.stripe_session_id == obj.get("id"))
    )
    if checkout is None or checkout.completed_at is not None:
        return
    if (
        obj.get("payment_status") not in ("paid", "no_payment_required")
        and checkout.purpose != "subscription"
    ):
        return  # e.g. a SEPA debit still pending: async_payment_succeeded will follow
    checkout.completed_at = now()
    await _ensure_profile(session, checkout.organization_id, obj)
    amount = int(obj.get("amount_total") or checkout.amount_cents)
    reference = obj.get("payment_intent") or obj.get("id")
    if checkout.purpose == "invoice" and checkout.invoice_id:
        invoice = await session.get(Invoice, checkout.invoice_id)
        if invoice:
            await invoices.record_payment(
                session,
                invoice,
                provider="stripe",
                amount_cents=amount,
                provider_ref=reference,
                received_at=now(),
            )
    elif checkout.purpose == "course" and checkout.product_id:
        product = await session.get(Product, checkout.product_id)
        if product is None or product.course_id is None:
            return
        invoice = await invoices.issue(
            session,
            organization_id=checkout.organization_id,
            purpose="course",
            title=common.text(product.name, "fr"),
            lines=[
                Line(
                    common.text(product.name, "fr"),
                    Decimal(1),
                    product.unit_price_cents,
                    product.vat_rate_bp,
                )
            ],
            due_now=True,
        )
        await invoices.record_payment(
            session,
            invoice,
            provider="stripe",
            amount_cents=amount,
            provider_ref=reference,
            received_at=now(),
        )
        if checkout.user_id and not await session.scalar(
            select(Enrollment.id).where(
                Enrollment.course_id == product.course_id, Enrollment.user_id == checkout.user_id
            )
        ):
            session.add(
                Enrollment(
                    course_id=product.course_id,
                    user_id=checkout.user_id,
                    sponsor_organization_id=checkout.organization_id,
                    created_at=now(),
                    last_activity_at=now(),
                )
            )
    elif checkout.purpose == "subscription" and checkout.product_id and obj.get("subscription"):
        exists = await session.scalar(
            select(Subscription).where(Subscription.stripe_subscription_id == obj["subscription"])
        )
        if exists is None:
            session.add(
                Subscription(
                    organization_id=checkout.organization_id,
                    product_id=checkout.product_id,
                    status="active",
                    stripe_subscription_id=obj["subscription"],
                    created_by_id=checkout.user_id,
                )
            )
    await session.flush()


def _subscription_of(obj: dict[str, Any]) -> str | None:
    """The subscription of a Stripe invoice (older and newer API shapes)."""
    if isinstance(obj.get("subscription"), str):
        return str(obj["subscription"])
    details = (obj.get("parent") or {}).get("subscription_details") or {}
    return details.get("subscription")


async def _subscription_invoice_paid(session: AsyncSession, obj: dict[str, Any]) -> None:
    """Each paid period of a subscription: our own invoice (legal numbering), already paid."""
    stripe_subscription = _subscription_of(obj)
    if not stripe_subscription:
        return
    subscription = await session.scalar(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription)
    )
    if subscription is None or await session.scalar(
        select(Invoice.id).where(Invoice.external_ref == obj.get("id"))
    ):
        return
    product = await session.get(Product, subscription.product_id)
    if product is None:
        return
    lines = ((obj.get("lines") or {}).get("data")) or []
    period_end = _timestamp(((lines[0] if lines else {}).get("period") or {}).get("end"))
    label = common.text(product.name, "fr")
    invoice = await invoices.issue(
        session,
        organization_id=subscription.organization_id,
        purpose="subscription",
        title=f"{label} – abonnement",
        lines=[Line(label, Decimal(1), product.unit_price_cents, product.vat_rate_bp)],
        subscription_id=subscription.id,
        external_ref=obj.get("id"),
        due_now=True,
    )
    await invoices.record_payment(
        session,
        invoice,
        provider="stripe",
        amount_cents=int(obj.get("amount_paid") or invoice.gross_cents),
        provider_ref=obj.get("id"),
        received_at=now(),
        notify=False,
    )
    subscription.status = "active"
    if period_end:
        subscription.current_period_end = period_end


STATUSES = {
    "active": "active",
    "trialing": "active",
    "past_due": "past_due",
    "unpaid": "past_due",
    "canceled": "cancelled",
    "incomplete_expired": "cancelled",
}


async def _subscription_changed(session: AsyncSession, obj: dict[str, Any], deleted: bool) -> None:
    subscription = await session.scalar(
        select(Subscription).where(Subscription.stripe_subscription_id == obj.get("id"))
    )
    if subscription is None:
        return
    status = "cancelled" if deleted else STATUSES.get(str(obj.get("status")), subscription.status)
    subscription.status = status
    subscription.cancel_at_period_end = bool(obj.get("cancel_at_period_end"))
    items = ((obj.get("items") or {}).get("data")) or []
    period_end = _timestamp(
        obj.get("current_period_end") or (items[0] if items else {}).get("current_period_end")
    )
    if period_end:
        subscription.current_period_end = period_end
    if status == "cancelled" and subscription.cancelled_at is None:
        subscription.cancelled_at = now()


async def handle_event(session: AsyncSession, event: dict[str, Any]) -> bool:
    """Processes a verified Stripe event once. Returns False for a duplicate."""
    event_id, kind = str(event.get("id")), str(event.get("type"))
    session.add(StripeEvent(id=event_id, type=kind, received_at=now()))
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return False
    obj = (event.get("data") or {}).get("object") or {}
    if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        await _session_completed(session, obj)
    elif kind in ("invoice.paid", "invoice.payment_succeeded"):
        await _subscription_invoice_paid(session, obj)
    elif kind in ("customer.subscription.updated", "customer.subscription.deleted"):
        await _subscription_changed(session, obj, deleted=kind.endswith("deleted"))
    await session.commit()
    return True


async def simulate_payment(session: AsyncSession, stripe: Any, session_id: str) -> str:
    """Simulated gateway only: what Stripe would send once the customer has paid."""
    request: CheckoutRequest | None = stripe.sessions.get(session_id)
    if request is None:
        raise NotFoundError("Checkout session not found")
    checkout = await session.scalar(
        select(Checkout).where(Checkout.stripe_session_id == session_id)
    )
    if checkout is None:
        raise NotFoundError("Checkout session not found")
    subscription_id = f"sub_sim_{secrets.token_hex(8)}" if request.mode == "subscription" else None
    completed = {
        "id": session_id,
        "payment_status": "paid",
        "amount_total": request.item.amount_cents,
        "payment_intent": None if subscription_id else f"pi_sim_{secrets.token_hex(8)}",
        "subscription": subscription_id,
        "customer": request.customer_id,
        "customer_details": {
            "email": request.customer_email,
            "name": request.customer_email,
            "address": {"country": "FR"},
        },
    }
    await handle_event(
        session,
        {
            "id": f"evt_sim_{secrets.token_hex(8)}",
            "type": "checkout.session.completed",
            "data": {"object": completed},
        },
    )
    if subscription_id:
        period_end = (
            int(datetime.now(UTC).timestamp())
            + (31 if request.item.interval == "month" else 366) * 86400
        )
        paid = {
            "id": f"in_sim_{secrets.token_hex(8)}",
            "subscription": subscription_id,
            "amount_paid": request.item.amount_cents,
            "lines": {"data": [{"period": {"end": period_end}}]},
        }
        await handle_event(
            session,
            {
                "id": f"evt_sim_{secrets.token_hex(8)}",
                "type": "invoice.paid",
                "data": {"object": paid},
            },
        )
    return request.success_url
