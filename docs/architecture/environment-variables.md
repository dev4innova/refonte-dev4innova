# Variables d'environnement

Règle : chaque variable est documentée ici **et** dans le `.env.example` correspondant.
Les fichiers `.env` réels ne sont jamais versionnés. En production, les valeurs viennent du
gestionnaire de secrets de l'hébergeur (`docs/rules/security.md`).

## API — `apps/api/.env.example`

Lues par `app/core/config.py` (pydantic-settings). Une variable obligatoire absente empêche le démarrage.

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `DATABASE_URL` | oui | — | DSN PostgreSQL, driver asyncpg : `postgresql+asyncpg://user:pass@host:5432/db` |
| `REDIS_URL` | oui | — | `redis://host:6379/0` |
| `APP_ENV` | non | `local` | `local`, `test`, `staging`, `production` (désactive `/docs` en production) |
| `LOG_LEVEL` | non | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `CORS_ALLOWED_ORIGINS` | non | `["http://localhost:3000"]` | origines autorisées (liste JSON) |
| `DATABASE_POOL_SIZE` | non | `5` | taille du pool SQLAlchemy |
| `DATABASE_MAX_OVERFLOW` | non | `10` | connexions supplémentaires au-delà du pool |
| `HEALTH_CHECK_TIMEOUT_SECONDS` | non | `2.0` | délai max par dépendance dans `/health/ready` |

Tests : `TEST_DATABASE_URL` et `TEST_REDIS_URL` remplacent les valeurs par défaut de `tests/conftest.py`
(`.../dev4innova_test` et `redis://localhost:6379/15`).

## Web — `apps/web/.env.example`

| Variable | Côté | Description |
|---|---|---|
| `API_URL` | serveur uniquement | URL de l'API vue par le serveur Next.js (`http://localhost:8000` en local, `http://api:8000` dans Docker) |
| `SITE_URL` | serveur, lu au build | origine publique du site pour les URL canoniques et `hreflang` (défaut `http://localhost:3000`) |

Seules les variables préfixées `NEXT_PUBLIC_` sont exposées au navigateur ; aucune n'existe pour l'instant.

## Docker Compose — `infra/docker/.env.example`

Valeurs par défaut **locales** de `compose.yaml` ; copier en `infra/docker/.env` pour les modifier.

| Variable | Défaut | Description |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `dev4innova` | identifiants de la base locale |
| `POSTGRES_PORT`, `REDIS_PORT`, `API_PORT`, `WEB_PORT` | `5432`, `6379`, `8000`, `3000` | ports exposés sur `127.0.0.1` |
| `APP_ENV`, `LOG_LEVEL` | `local`, `INFO` | transmis à l'API |
