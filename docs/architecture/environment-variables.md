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
| `SENTRY_DSN` | non | — | DSN Sentry de l'API (**secret**) ; vide = pas de suivi des erreurs (ADR-0018) |
| `SENTRY_TRACES_SAMPLE_RATE` | non | `0.1` | part des requêtes tracées dans Sentry (0 à 1) |
| `RELEASE` | non | `RAILWAY_GIT_COMMIT_SHA` | version envoyée à Sentry ; fournie automatiquement par Railway |
| `PORT` | non | `8000` | port d'écoute de l'image Docker (`infra/docker/api.Dockerfile`) |
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
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | pour l'IA | — | clés des fournisseurs (**secret**, backend uniquement) ; sans clé, le fournisseur est « non configuré » (503) |
| `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` / `GEMINI_BASE_URL` | non | — | uniquement pour viser un fournisseur simulé ou un proxy |
| `AI_REQUEST_TIMEOUT_SECONDS` | non | `120` | délai maximal d'un appel fournisseur |
| `AI_EUR_PER_USD` | non | `0.86` | taux de conversion des prix (USD) vers les budgets (EUR) ; **à tenir à jour** |
| `AI_DEFAULT_MONTHLY_BUDGET_EUR` | non | `20` | budget IA mensuel d'une organisation sans budget spécifique |
| `AI_USER_REQUESTS_PER_MINUTE` | non | `20` | appels IA par utilisateur et par minute |
| `AI_SESSION_RETENTION_DAYS` | non | `90` | purge des sessions IA inactives (`make purge-ai-sessions`, à planifier) |
| `AI_DAILY_MESSAGES_PER_USER` | non | `200` | messages et documents IA par utilisateur et par jour |
| `AI_DIAGNOSTIC_DAILY_ANALYSES` | non | `300` | analyses IA du diagnostic public par jour, toutes confondues (budget interne) |
| `AI_DOCUMENT_MAX_BYTES` | non | `10485760` | taille maximale d'un document à analyser |
| `AI_DOCUMENT_MAX_CHARS` | non | `200000` | texte extrait maximal (au-delà, refus — jamais de troncature) |
| `AI_ENABLE_SIMULATED_PROVIDER` | non | `false` | fournisseur « simulation » hors ligne (développement local, jamais en production) |
| `MEDIA_MAX_BYTES` | non | `5242880` | taille maximale d'une image envoyée |
| `PORTAL_S3_BUCKET` | non | `dev4innova-portal` | bucket **privé** des fichiers du portail client (mêmes identifiants que les médias) |
| `PORTAL_S3_PUBLIC_ENDPOINT_URL` | non | — | point d'accès S3 vu par les navigateurs, pour signer les liens de téléchargement (si différent de `MEDIA_S3_ENDPOINT_URL`) |
| `PORTAL_FILE_MAX_BYTES` | non | `26214400` | taille maximale d'un document ou livrable (25 Mo) |
| `PORTAL_DOWNLOAD_TTL_SECONDS` | non | `300` | durée de validité d'un lien de téléchargement signé |
| `SITE_URL` (API) | non | `http://localhost:3000` | adresse publique du site : certificats de l'Academy, retours de paiement Stripe |
| `STRIPE_SECRET_KEY` | pour le paiement | — | clé secrète Stripe (**secret**, API uniquement) ; sans elle et sans simulation, le paiement en ligne est indisponible (503) |
| `STRIPE_WEBHOOK_SECRET` | pour le paiement | — | secret de signature des webhooks Stripe (**secret**) |
| `STRIPE_API_BASE` | non | `https://api.stripe.com` | uniquement pour viser un faux Stripe ou un proxy |
| `BILLING_SIMULATED_PAYMENTS` | non | `false` | pages de paiement simulées servies par l'API (local, E2E ; ignoré en production) |
| `API_PUBLIC_URL` | non | `http://localhost:8000` | adresse de l'API vue par les navigateurs (pages de paiement simulées) |
| `BILLING_SELLER_NAME`, `_LEGAL_FORM`, `_ADDRESS`, `_SIREN`, `_VAT_NUMBER`, `_IBAN`, `_BIC`, `_EMAIL` | pour facturer | `DEV4INNOVA` / vides | coordonnées du vendeur copiées sur chaque facture (mentions obligatoires) |
| `BILLING_PAYMENT_TERMS_DAYS` | non | `30` | délai de paiement des factures (acomptes et paiements en ligne : à réception) |

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
| `SENTRY_DSN` | serveur, **secret** | DSN Sentry du web : erreurs du serveur Next.js ; vide = désactivé |
| `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` | serveur | environnement Sentry (défaut `NODE_ENV`) et part des requêtes tracées (défaut `0.1`) |
| `NEXT_PUBLIC_SENTRY_DSN` | navigateur, **build** | DSN Sentry des erreurs du navigateur (argument de build de l'image) ; vide = Sentry n'est pas chargé |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | navigateur, **build** | défaut `production` |
| `ALLOW_INDEXING` | serveur | `true` uniquement en production : autorise l'indexation dans `robots.txt` (défaut `false`) |

Procédure complète : [authentication.md](authentication.md).

Seules les variables préfixées `NEXT_PUBLIC_` sont exposées au navigateur : uniquement le DSN
et l'environnement Sentry, qui ne sont pas des secrets (un DSN ne permet que d'envoyer des erreurs).

## Docker Compose — `infra/docker/.env.example`

Valeurs par défaut **locales** de `compose.yaml` ; copier en `infra/docker/.env` pour les modifier.

| Variable | Défaut | Description |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `dev4innova` | identifiants de la base locale |
| `POSTGRES_PORT`, `REDIS_PORT`, `API_PORT`, `WEB_PORT` | `5432`, `6379`, `8000`, `3000` | ports exposés sur `127.0.0.1` |
| `APP_ENV`, `LOG_LEVEL` | `local`, `INFO` | transmis à l'API |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` / `MINIO_PORT` | `dev4innova` / `dev4innova-secret` / `9000` | stockage objet local des médias (MinIO), bucket `dev4innova-media` créé en lecture publique par `minio-init` |
| `SITE_URL` | `http://localhost:3000` | origine publique passée au build de l'image web |

## Sauvegardes — service `backup` (`infra/backup/backup.sh`, `restore.sh`)

| Variable | Défaut | Description |
|---|---|---|
| `DATABASE_URL` | — | base à sauvegarder (format libpq ou SQLAlchemy asyncpg) (**secret**) |
| `BACKUP_S3_BUCKET` | — | bucket privé des sauvegardes |
| `BACKUP_S3_ENDPOINT_URL` | — | point d'accès S3-compatible ; vide = AWS S3 |
| `BACKUP_S3_PREFIX` | `backups/postgres` | dossier des exports dans le bucket |
| `BACKUP_RETENTION_DAYS` | `30` | les exports plus anciens sont supprimés |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_DEFAULT_REGION` | — | clé dédiée aux sauvegardes (**secret**) |
| `TARGET_DATABASE_URL` | — | `restore.sh` uniquement : base **neuve** où restaurer |

Production : liste complète par service Railway dans [`docs/deployment/railway.md`](../deployment/railway.md).
