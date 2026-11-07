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
| `MEDIA_S3_ENDPOINT_URL` | non | — | point d'accès S3-compatible (`http://localhost:9000` pour MinIO) ; vide = AWS S3 |
| `MEDIA_S3_BUCKET` | non | `dev4innova-media` | bucket des médias du CMS |
| `MEDIA_S3_REGION` | non | `fr-par` | région du stockage objet |
| `MEDIA_S3_ACCESS_KEY_ID` / `MEDIA_S3_SECRET_ACCESS_KEY` | pour les médias | — | identifiants du stockage objet (**secret**) |
| `MEDIA_PUBLIC_BASE_URL` | non | `http://localhost:9000/dev4innova-media` | URL publique des fichiers (bucket public en lecture ou CDN) ; seules ces images sont acceptées dans le Markdown |
| `MEDIA_MAX_BYTES` | non | `5242880` | taille maximale d'une image envoyée |

Tests : `TEST_DATABASE_URL` et `TEST_REDIS_URL` remplacent les valeurs par défaut de `tests/conftest.py`
(`.../dev4innova_test` et `redis://localhost:6379/15`).

## Web — `apps/web/.env.example`

| Variable | Côté | Description |
|---|---|---|
| `API_URL` | serveur uniquement | URL de l'API vue par le serveur Next.js (`http://localhost:8000` en local, `http://api:8000` dans Docker) |
| `SITE_URL` | serveur **et build** | origine publique du site : URL canoniques, `hreflang`, URL de retour OIDC (défaut `http://localhost:3000`). Lue aussi au build pour les métadonnées des pages statiques : argument de build `SITE_URL` de l'image Docker |
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
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` / `MINIO_PORT` | `dev4innova` / `dev4innova-secret` / `9000` | stockage objet local des médias (MinIO), bucket `dev4innova-media` créé en lecture publique par `minio-init` |
| `SITE_URL` | `http://localhost:3000` | origine publique passée au build de l'image web |
