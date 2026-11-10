"""FastAPI application factory."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.core.observability import RequestContextMiddleware
from app.core.redis import close_redis
from app.db.session import dispose_engine
from app.modules.academy.router import admin_router as academy_admin_router
from app.modules.academy.router import learner_router as academy_learner_router
from app.modules.academy.router import org_router as academy_org_router
from app.modules.academy.router import public_router as academy_router
from app.modules.ai_experiences.router import router as ai_router
from app.modules.ai_gateway.router import router as ai_admin_router
from app.modules.billing.router import admin_router as billing_admin_router
from app.modules.billing.router import learner_router as billing_learner_router
from app.modules.billing.router import public_router as billing_router
from app.modules.billing.router import router as billing_org_router
from app.modules.cms.router import admin_router as cms_admin_router
from app.modules.cms.router import media_router
from app.modules.cms.router import public_router as content_router
from app.modules.contact.router import router as contact_router
from app.modules.crm.router import admin_router as crm_admin_router
from app.modules.crm.router import public_router as quote_router
from app.modules.diagnostic.router import admin_router as diagnostic_admin_router
from app.modules.diagnostic.router import public_router as diagnostic_router
from app.modules.health.router import router as health_router
from app.modules.identity.router import (
    accounts_admin_router,
    auth_router,
    me_router,
    org_router,
)
from app.modules.portal.router import admin_router as portal_admin_router
from app.modules.portal.router import notifications_router
from app.modules.portal.router import router as portal_router

API_V1_PREFIX = "/api/v1"


def _operation_id(route: APIRoute) -> str:
    """Stable, readable operation ids for the generated TS client (e.g. ``health-live``)."""
    prefix = f"{route.tags[0]}-" if route.tags else ""
    return f"{prefix}{route.name}"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logging.getLogger(__name__).info(
        "Starting %s (release %s)", settings.app_name, settings.release or "unknown"
    )
    yield
    await dispose_engine()
    await close_redis()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="DEV4INNOVA API",
        version=settings.app_version,
        lifespan=lifespan,
        generate_unique_id_function=_operation_id,
        # Interactive docs are disabled in production.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)

    api_v1 = APIRouter(prefix=API_V1_PREFIX)
    api_v1.include_router(health_router)
    api_v1.include_router(auth_router)
    api_v1.include_router(me_router)
    api_v1.include_router(accounts_admin_router)
    api_v1.include_router(org_router)
    api_v1.include_router(contact_router)
    api_v1.include_router(content_router)
    api_v1.include_router(media_router)
    api_v1.include_router(cms_admin_router)
    api_v1.include_router(quote_router)
    api_v1.include_router(crm_admin_router)
    api_v1.include_router(ai_admin_router)
    api_v1.include_router(ai_router)
    api_v1.include_router(diagnostic_router)
    api_v1.include_router(diagnostic_admin_router)
    api_v1.include_router(portal_router)
    api_v1.include_router(portal_admin_router)
    api_v1.include_router(notifications_router)
    api_v1.include_router(academy_router)
    api_v1.include_router(academy_learner_router)
    api_v1.include_router(academy_org_router)
    api_v1.include_router(academy_admin_router)
    api_v1.include_router(billing_router)
    api_v1.include_router(billing_learner_router)
    api_v1.include_router(billing_org_router)
    api_v1.include_router(billing_admin_router)
    app.include_router(api_v1)
    return app


app = create_app()
