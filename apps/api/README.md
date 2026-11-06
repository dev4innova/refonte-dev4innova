# apps/api — Backend FastAPI

Règles : [backend](../../docs/rules/backend.md) · [database](../../docs/rules/database.md) · [sécurité](../../docs/rules/security.md).

```
app/
├── main.py              # create_app(), middlewares, routers sous /api/v1
├── core/                # config (env), logs JSON, erreurs, client Redis
├── db/                  # Base + mixins, engine/session async, models.py (registre Alembic)
└── modules/health/      # /api/v1/health/live et /api/v1/health/ready
alembic/                 # migrations (async), une révision baseline 0001
tests/                   # pytest sur vrai PostgreSQL + Redis
```

```bash
uv sync                                   # dépendances
cp .env.example .env                      # configuration locale
uv run alembic upgrade head               # migrations
uv run uvicorn app.main:app --reload      # http://localhost:8000/docs
uv run pytest                             # tests (PostgreSQL + Redis requis : make services)
uv run ruff check . && uv run mypy        # lint + types
```

Nouveau modèle : le déclarer dans `app/modules/<domaine>/models.py`, l'importer dans
`app/db/models.py`, puis `make migration name="..."` et relire la migration générée.
