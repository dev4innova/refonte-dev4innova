# DEV4INNOVA — common commands. Run `make help`.
COMPOSE := docker compose -f infra/docker/compose.yaml
API := cd apps/api &&

.DEFAULT_GOAL := help
.PHONY: help setup up down logs ps services api-dev web-dev migrate migration client grant-staff purge-ai-sessions purge-diagnostics daily lint typecheck test security e2e smoke check

help: ## List commands
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

setup: ## Install JS and Python dependencies, create local env files
	pnpm install
	$(API) uv sync
	@test -f apps/api/.env || cp apps/api/.env.example apps/api/.env
	@test -f apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local

up: ## Build and start the full stack in Docker (web :3000, api :8000)
	$(COMPOSE) up -d --build --wait

down: ## Stop the Docker stack (keeps data volumes)
	$(COMPOSE) down

logs: ## Follow Docker logs
	$(COMPOSE) logs -f

ps: ## Show Docker services and health
	$(COMPOSE) ps

services: ## Start PostgreSQL, Redis and MinIO (for api-dev / web-dev)
	$(COMPOSE) up -d --wait postgres redis minio
	$(COMPOSE) run --rm minio-init

api-dev: ## Run the API with hot reload on :8000
	$(API) uv run alembic upgrade head && uv run uvicorn app.main:app --reload --port 8000

web-dev: ## Run the web app with hot reload on :3000
	pnpm --filter @dev4innova/web dev

migrate: ## Apply database migrations
	$(API) uv run alembic upgrade head

migration: ## Create a migration: make migration name="add users table"
	$(API) uv run alembic revision --autogenerate -m "$(name)"

grant-staff: ## Make a signed-in user staff: make grant-staff email=a@b.c role=staff_admin
	$(API) uv run python -m app.cli grant-staff "$(email)" "$(or $(role),staff_editor)"

purge-ai-sessions: ## Delete AI sessions inactive for longer than AI_SESSION_RETENTION_DAYS
	$(API) uv run python -m app.cli purge-ai-sessions

purge-diagnostics: ## Delete anonymous AI diagnostics (never unlocked) older than 30 days
	$(API) uv run python -m app.cli purge-diagnostics

daily: ## Daily maintenance (both purges above), run by the Railway "jobs" cron in production
	$(API) uv run python -m app.cli daily

client: ## Regenerate packages/api-client from the API OpenAPI schema
	pnpm --filter @dev4innova/api-client generate

lint: ## Lint everything
	pnpm --filter @dev4innova/web lint --max-warnings=0
	$(API) uv run ruff check . && uv run ruff format --check .

typecheck: ## Typecheck everything
	pnpm -r typecheck
	$(API) uv run mypy

test: ## Run all tests (API tests need `make services`)
	pnpm --filter @dev4innova/web test
	$(API) uv run pytest

security: ## Bandit on the API code, gitleaks on the git history (gitleaks must be installed)
	$(API) uv run bandit -q -c pyproject.toml -r app
	gitleaks git . --redact --no-banner

e2e: ## Build the web app and run Playwright (responsive + accessibility)
	pnpm --filter @dev4innova/web build
	pnpm --filter @dev4innova/web e2e

smoke: ## Smoke-test a deployment: make smoke web=https://www.example.com api=https://api.example.com
	sh infra/scripts/smoke.sh "$(web)" "$(api)"

check: lint typecheck test ## Lint + typecheck + test
