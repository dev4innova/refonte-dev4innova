"""Staff administration of the AI Gateway: registry, prompts, usage and quotas.

Reserved to `ai:manage` (staff admins). The usage report spans every organization: it is
the platform operator's view, aggregated, without any content.
"""

import uuid
from decimal import Decimal

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError
from app.modules.ai_gateway.gateway import month_start, template_variables
from app.modules.ai_gateway.models import AIModel, AIQuota, AIUsage, Prompt, PromptVersion
from app.modules.ai_gateway.providers import configured_providers
from app.modules.ai_gateway.schemas import (
    ModelIn,
    ModelOut,
    ModelUpdate,
    ModelUsage,
    OrganizationUsage,
    PromptCreate,
    PromptOut,
    PromptSummary,
    PromptVersionIn,
    PromptVersionOut,
    UsageRecord,
    UsageReport,
)
from app.modules.identity.models import Organization
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext

# --- Registry ------------------------------------------------------------------------


def model_out(model: AIModel) -> ModelOut:
    out = ModelOut.model_validate(model)
    out.provider_configured = model.provider in configured_providers()
    return out


async def list_models(session: AsyncSession, ctx: OrganizationContext) -> list[ModelOut]:
    ctx.require(Permission.AI_MANAGE)
    models = await session.scalars(select(AIModel).order_by(AIModel.provider, AIModel.display_name))
    return [model_out(m) for m in models]


async def _clear_default(session: AsyncSession) -> None:
    await session.execute(
        update(AIModel).where(AIModel.is_default.is_(True)).values(is_default=False)
    )


async def create_model(session: AsyncSession, ctx: OrganizationContext, data: ModelIn) -> AIModel:
    ctx.require(Permission.AI_MANAGE)
    if data.is_default:
        await _clear_default(session)
    model = AIModel(**data.model_dump())
    model.is_enabled = data.is_enabled or data.is_default  # the default model is usable
    session.add(model)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ConflictError(
            "This model is already in the registry", {"field": "model_id"}
        ) from error
    return model


async def update_model(
    session: AsyncSession, ctx: OrganizationContext, model_id: uuid.UUID, data: ModelUpdate
) -> AIModel:
    ctx.require(Permission.AI_MANAGE)
    model = await session.get(AIModel, model_id)
    if model is None:
        raise NotFoundError("Model not found")
    values = data.model_dump(exclude_unset=True, exclude_none=True)
    if values.get("is_default"):
        await _clear_default(session)
        values["is_enabled"] = True
    if values.get("is_enabled") is False and (
        model.is_default and values.get("is_default") is not False
    ):
        raise ConflictError("Choose another default model before disabling this one")
    for field, value in values.items():
        setattr(model, field, value)
    await session.commit()
    await session.refresh(model)
    return model


# --- Prompts -------------------------------------------------------------------------


def _version_out(version: PromptVersion) -> PromptVersionOut:
    return PromptVersionOut(
        id=version.id,
        version=version.version,
        system=version.system,
        template=version.template,
        variables=template_variables(version.template),
        model_id=version.model_id,
        max_tokens=version.max_tokens,
        notes=version.notes,
        created_at=version.created_at,
    )


def prompt_out(prompt: Prompt) -> PromptOut:
    active = next((v.version for v in prompt.versions if v.id == prompt.active_version_id), None)
    return PromptOut(
        id=prompt.id,
        key=prompt.key,
        description=prompt.description,
        active_version=active,
        versions=[_version_out(v) for v in prompt.versions],
    )


async def list_prompts(session: AsyncSession, ctx: OrganizationContext) -> list[PromptSummary]:
    ctx.require(Permission.AI_MANAGE)
    prompts = await session.scalars(
        select(Prompt).options(selectinload(Prompt.versions)).order_by(Prompt.key)
    )
    return [
        PromptSummary(
            id=p.id,
            key=p.key,
            description=p.description,
            active_version=next(
                (v.version for v in p.versions if v.id == p.active_version_id), None
            ),
            versions=len(p.versions),
            updated_at=max([p.updated_at, *(v.created_at for v in p.versions)]),
        )
        for p in prompts
    ]


async def get_prompt(session: AsyncSession, ctx: OrganizationContext, key: str) -> Prompt:
    ctx.require(Permission.AI_MANAGE)
    prompt = await session.scalar(
        select(Prompt)
        .where(Prompt.key == key)
        .options(selectinload(Prompt.versions))
        .execution_options(populate_existing=True)
    )
    if prompt is None:
        raise NotFoundError("Prompt not found")
    return prompt


async def _check_model(session: AsyncSession, model_id: uuid.UUID | None) -> None:
    if model_id is not None and await session.get(AIModel, model_id) is None:
        raise NotFoundError("Model not found", {"field": "model_id"})


def _new_version(
    prompt: Prompt, number: int, data: PromptVersionIn, user_id: uuid.UUID
) -> PromptVersion:
    return PromptVersion(
        prompt=prompt,
        version=number,
        system=data.system,
        template=data.template,
        model_id=data.model_id,
        max_tokens=data.max_tokens,
        notes=data.notes,
        created_by_id=user_id,
    )


async def create_prompt(
    session: AsyncSession, ctx: OrganizationContext, data: PromptCreate
) -> Prompt:
    ctx.require(Permission.AI_MANAGE)
    await _check_model(session, data.model_id)
    if await session.scalar(select(Prompt.id).where(Prompt.key == data.key)):
        raise ConflictError("This prompt key is already used", {"field": "key"})
    prompt = Prompt(key=data.key, description=data.description)
    version = _new_version(prompt, 1, data, ctx.user.id)
    session.add_all([prompt, version])
    await session.flush()
    prompt.active_version_id = version.id
    await session.commit()
    return await get_prompt(session, ctx, data.key)


async def add_version(
    session: AsyncSession, ctx: OrganizationContext, key: str, data: PromptVersionIn
) -> Prompt:
    prompt = await get_prompt(session, ctx, key)
    await _check_model(session, data.model_id)
    number = max((v.version for v in prompt.versions), default=0) + 1
    version = _new_version(prompt, number, data, ctx.user.id)
    session.add(version)
    await session.flush()
    if data.activate:
        prompt.active_version_id = version.id
    try:
        await session.commit()
    except IntegrityError as error:  # two editors saving at the same time
        await session.rollback()
        raise ConflictError("Another version was saved meanwhile; reload the prompt") from error
    return await get_prompt(session, ctx, key)


async def activate_version(
    session: AsyncSession, ctx: OrganizationContext, key: str, number: int
) -> Prompt:
    prompt = await get_prompt(session, ctx, key)
    version = next((v for v in prompt.versions if v.version == number), None)
    if version is None:
        raise NotFoundError("Prompt version not found")
    prompt.active_version_id = version.id
    await session.commit()
    return await get_prompt(session, ctx, key)


# --- Usage and quotas ---------------------------------------------------------------


async def usage_report(session: AsyncSession, ctx: OrganizationContext) -> UsageReport:
    ctx.require(Permission.AI_MANAGE)
    settings = get_settings()
    since = month_start()
    spend = {
        org_id: (Decimal(total), calls)
        for org_id, total, calls in await session.execute(
            select(
                AIUsage.organization_id, func.coalesce(func.sum(AIUsage.cost_eur), 0), func.count()
            )
            .where(AIUsage.created_at >= since)
            .group_by(AIUsage.organization_id)
        )
    }
    quotas = {
        q.organization_id: q.monthly_budget_eur for q in await session.scalars(select(AIQuota))
    }
    organizations = [
        OrganizationUsage(
            organization_id=org.id,
            organization_name=org.name,
            monthly_budget_eur=quotas.get(org.id, settings.ai_default_monthly_budget_eur),
            has_specific_budget=org.id in quotas,
            spent_eur=spend.get(org.id, (Decimal(0), 0))[0].quantize(Decimal("0.01")),
            calls=spend.get(org.id, (Decimal(0), 0))[1],
        )
        for org in await session.scalars(select(Organization).order_by(Organization.name))
    ]
    models = [
        ModelUsage(
            provider=provider,
            model=model,
            calls=calls,
            input_tokens=int(tokens_in),
            output_tokens=int(tokens_out),
            cost_eur=Decimal(total).quantize(Decimal("0.01")),
        )
        for provider, model, calls, tokens_in, tokens_out, total in await session.execute(
            select(
                AIUsage.provider,
                AIUsage.model,
                func.count(),
                func.coalesce(func.sum(AIUsage.input_tokens), 0),
                func.coalesce(func.sum(AIUsage.output_tokens), 0),
                func.coalesce(func.sum(AIUsage.cost_eur), 0),
            )
            .where(AIUsage.created_at >= since)
            .group_by(AIUsage.provider, AIUsage.model)
            .order_by(func.sum(AIUsage.cost_eur).desc())
        )
    ]
    recent = await session.scalars(select(AIUsage).order_by(AIUsage.created_at.desc()).limit(50))
    return UsageReport(
        month=since.strftime("%Y-%m"),
        eur_per_usd=settings.ai_eur_per_usd,
        default_budget_eur=settings.ai_default_monthly_budget_eur,
        total_cost_eur=sum((o.spent_eur for o in organizations), Decimal(0)),
        organizations=organizations,
        models=models,
        recent=[UsageRecord.model_validate(r) for r in recent],
    )


async def set_quota(
    session: AsyncSession,
    ctx: OrganizationContext,
    organization_id: uuid.UUID,
    budget: Decimal | None,
) -> None:
    ctx.require(Permission.AI_MANAGE)
    if await session.get(Organization, organization_id) is None:
        raise NotFoundError("Organization not found")
    quota = await session.get(AIQuota, organization_id)
    if budget is None:
        if quota is not None:
            await session.delete(quota)
    elif quota is None:
        session.add(
            AIQuota(
                organization_id=organization_id,
                monthly_budget_eur=budget,
                updated_by_id=ctx.user.id,
            )
        )
    else:
        quota.monthly_budget_eur = budget
        quota.updated_by_id = ctx.user.id
    await session.commit()
