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
| `AUTH_ISSUER` | pour l'authentification | — | URL de l'instance Zitadel (sans `/` final) |
| `AUTH_AUDIENCE` | pour l'authentification | — | ID du projet Zitadel (claim `aud` attendu) |
| `AUTH_JWKS_URL` | non | `{AUTH_ISSUER}/oauth/v2/keys` | clés publiques de signature |
| `AUTH_USERINFO_URL` | non | `{AUTH_ISSUER}/oidc/v1/userinfo` | lecture de l'e-mail s'il manque dans le jeton |
| `AUTH_LEEWAY_SECONDS` | non | `30` | tolérance d'horloge pour `exp` / `nbf` |
| `TRUST_FORWARDED_FOR` | non | `false` | utiliser `X-Forwarded-For` pour les limites de débit ; `true` seulement si l'API n'est joignable que via le web ou un proxy de confiance |

Tests : `TEST_DATABASE_URL` et `TEST_REDIS_URL` remplacent les valeurs par défaut de `tests/conftest.py`
(`.../dev4innova_test` et `redis://localhost:6379/15`).

## Web — `apps/web/.env.example`

| Variable | Côté | Description |
|---|---|---|
| `API_URL` | serveur uniquement | URL de l'API vue par le serveur Next.js (`http://localhost:8000` en local, `http://api:8000` dans Docker) |
| `SITE_URL` | serveur | origine publique du site : URL canoniques, `hreflang`, URL de retour OIDC (défaut `http://localhost:3000`) |
| `AUTH_ISSUER` | serveur | URL de l'instance Zitadel |
| `AUTH_CLIENT_ID` | serveur | Client ID de l'application Web Zitadel (PKCE) |
| `AUTH_PROJECT_ID` | serveur | ID du projet Zitadel (audience du jeton d'accès) |
| `AUTH_SESSION_SECRET` | serveur, **secret** | clé de chiffrement des cookies de session (≥ 32 caractères) |
| `ALLOW_INDEXING` | serveur | `true` uniquement en production : autorise l'indexation dans `robots.txt` (défaut `false`) |

Procédure complète : [authentication.md](authentication.md).

Seules les variables préfixées `NEXT_PUBLIC_` sont exposées au navigateur ; aucune n'existe pour l'instant.

## Docker Compose — `infra/docker/.env.example`

Valeurs par défaut **locales** de `compose.yaml` ; copier en `infra/docker/.env` pour les modifier.

| Variable | Défaut | Description |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `dev4innova` | identifiants de la base locale |
| `POSTGRES_PORT`, `REDIS_PORT`, `API_PORT`, `WEB_PORT` | `5432`, `6379`, `8000`, `3000` | ports exposés sur `127.0.0.1` |
| `APP_ENV`, `LOG_LEVEL` | `local`, `INFO` | transmis à l'API |
