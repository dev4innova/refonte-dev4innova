# Mise en production sur Railway

Procédure d'exploitation de la production (ADR-0018). Les fichiers de configuration des services
sont versionnés dans `infra/railway/` ; ce document décrit ce qui se règle dans l'interface de
Railway, de Sentry et du stockage objet, et ce qu'il faut vérifier avant d'ouvrir le site.

## 1. Comptes et ressources externes

| Ressource | À créer | Remarque |
|---|---|---|
| Projet Railway | environnement `production`, région **EU West** | intégration GitHub sur le dépôt |
| Stockage objet S3 (Europe) | 3 buckets : `…-media` (lecture publique), `…-portal` (privé), `…-backups` (privé, versionné) | une clé d'accès pour l'API (media + portal), **une autre** pour les sauvegardes |
| Sentry (région UE) | 2 projets : `dev4innova-api` (Python) et `dev4innova-web` (Next.js) | récupérer les DSN ; alertes « nouvelle erreur » par e-mail |
| Zitadel | application Web de production | URL de retour `https://<domaine>/api/auth/callback` (`docs/architecture/authentication.md`) |
| Stripe | clés live, webhook vers `https://<api>/api/v1/billing/webhooks/stripe` | événements listés dans l'ADR-0017 |
| DNS | `www.<domaine>` → service `web`, `api.<domaine>` → service `api` | domaines personnalisés Railway (certificats automatiques) |

## 2. Services Railway

Créer, dans le projet, deux bases depuis le catalogue (**PostgreSQL** et **Redis**), puis quatre
services depuis le dépôt GitHub. Pour chacun : *Settings → Config-as-code → Railway config file*.

| Service | Fichier de config | Domaine | Branche |
|---|---|---|---|
| `web` | `/infra/railway/web.json` | public (`www.…`) | `main` |
| `api` | `/infra/railway/api.json` | public (`api.…`), port **8000** | `main` |
| `jobs` | `/infra/railway/jobs.json` | aucun | `main` |
| `backup` | `/infra/railway/backup.json` | aucun | `main` |

Dans chaque service : *Settings → Source → **Wait for CI*** activé. Railway attend alors que tous
les jobs du workflow `CI` soient verts sur le commit avant de déployer (TASK-116).

Les noms `web` et `api` comptent : le web joint l'API par `http://api.railway.internal:8000`.

## 3. Variables

Utiliser les références Railway (`${{Postgres.PGHOST}}`, `${{Redis.REDIS_URL}}`…) plutôt que de
recopier des valeurs, et des **variables partagées** pour ce qui sert à plusieurs services. Les
secrets (marqués 🔒) ne sont saisis que dans Railway, jamais dans le dépôt.

### `api` et `jobs` (mêmes variables ; `jobs` peut se limiter aux deux premières lignes)

| Variable | Valeur |
|---|---|
| `DATABASE_URL` 🔒 | `postgresql+asyncpg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `REDIS_URL` 🔒 | `${{Redis.REDIS_URL}}` |
| `APP_ENV` | `production` |
| `PORT` | `8000` |
| `CORS_ALLOWED_ORIGINS` | `["https://www.<domaine>"]` |
| `SITE_URL` | `https://www.<domaine>` |
| `API_PUBLIC_URL` | `https://api.<domaine>` |
| `TRUST_FORWARDED_FOR` | `true` (l'API n'est jointe que par le web et le proxy de Railway) |
| `AUTH_ISSUER`, `AUTH_AUDIENCE` | instance et projet Zitadel de production |
| `MEDIA_S3_ENDPOINT_URL`, `MEDIA_S3_REGION`, `MEDIA_S3_BUCKET`, `MEDIA_PUBLIC_BASE_URL`, `PORTAL_S3_BUCKET` | stockage objet |
| `MEDIA_S3_ACCESS_KEY_ID` 🔒, `MEDIA_S3_SECRET_ACCESS_KEY` 🔒 | clé de l'API |
| `ANTHROPIC_API_KEY` 🔒, `OPENAI_API_KEY` 🔒, `GEMINI_API_KEY` 🔒 | fournisseurs IA utilisés |
| `STRIPE_SECRET_KEY` 🔒, `STRIPE_WEBHOOK_SECRET` 🔒 | Stripe live |
| `BILLING_SELLER_*` | coordonnées légales du vendeur |
| `SENTRY_DSN` 🔒 | DSN du projet Sentry `dev4innova-api` |

`RAILWAY_GIT_COMMIT_SHA` est fourni par Railway : il sert de version (`release`) dans Sentry.

L'API **refuse de démarrer** en production si l'authentification manque, si `SITE_URL` ou une
origine CORS n'est pas en HTTPS, ou si l'IA ou le paiement simulés sont activés : le message
« Unsafe production settings » dans les journaux du déploiement dit quoi corriger.

### `web`

| Variable | Valeur |
|---|---|
| `API_URL` | `http://api.railway.internal:8000` |
| `SITE_URL` | `https://www.<domaine>` (aussi lue au **build**) |
| `ALLOW_INDEXING` | `true` |
| `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_PROJECT_ID` | Zitadel |
| `AUTH_SESSION_SECRET` 🔒 | 32 caractères aléatoires au moins (`openssl rand -base64 48`) |
| `SENTRY_DSN` 🔒 | DSN du projet Sentry `dev4innova-web` (erreurs du serveur) |
| `SENTRY_ENVIRONMENT` | `production` |
| `NEXT_PUBLIC_SENTRY_DSN` | même DSN, pour le navigateur (**lu au build**) |

Railway transmet les variables du service comme arguments de build Docker : `SITE_URL` et
`NEXT_PUBLIC_SENTRY_DSN` sont donc pris en compte au build de l'image web. Après les avoir
changées, redéployer le service.

### `backup`

| Variable | Valeur |
|---|---|
| `DATABASE_URL` 🔒 | `postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `BACKUP_S3_BUCKET` | bucket des sauvegardes |
| `BACKUP_S3_ENDPOINT_URL` | point d'accès S3 (vide pour AWS) |
| `BACKUP_S3_PREFIX` | défaut `backups/postgres` |
| `BACKUP_RETENTION_DAYS` | défaut `30` |
| `AWS_ACCESS_KEY_ID` 🔒, `AWS_SECRET_ACCESS_KEY` 🔒, `AWS_DEFAULT_REGION` | clé dédiée aux sauvegardes |

### Dépôt GitHub (*Settings → Secrets and variables → Actions → Variables*)

| Variable | Valeur |
|---|---|
| `SMOKE_WEB_URL` | `https://www.<domaine>` |
| `SMOKE_API_URL` | `https://api.<domaine>` |

## 4. Déployer

Une fusion dans `main` suffit :
1. la CI passe (lint, types, tests, E2E, client d'API, sécurité, images Docker) ;
2. Railway construit les services modifiés (`watchPatterns`) ;
3. `api` : `alembic upgrade head` en pré-déploiement ; s'il échoue, rien n'est basculé ;
4. la nouvelle version reçoit le trafic une fois son health check vert ;
5. le workflow **Smoke tests** vérifie le site et l'API en production.

Les migrations doivent rester compatibles avec la version précédente
(`docs/rules/database.md`).

Tests de fumée à la main, depuis un poste ou l'onglet *Actions* (*Smoke tests → Run workflow*) :

```bash
make smoke web=https://www.<domaine> api=https://api.<domaine>
```

## 5. Retour arrière

- **Code** : dans Railway, service concerné → *Deployments* → déploiement précédent → *Redeploy*.
  Puis corriger dans `main` (le prochain merge redéploie).
- **Migration** : pas d'annulation automatique. Écrire une migration corrective ; en dernier
  recours, `alembic downgrade -1` depuis le shell du service `api` (*Railway → api → Shell*),
  après une sauvegarde.
- **Données** : voir la restauration ci-dessous.

## 6. Sauvegardes et restauration

- Railway sauvegarde le volume PostgreSQL (*Postgres → Backups* : activer les sauvegardes
  quotidiennes et hebdomadaires).
- Le service `backup` exporte la base chaque nuit (01:43 UTC) dans le bucket S3, en vérifiant
  l'archive, et supprime les exports de plus de `BACKUP_RETENTION_DAYS` jours. Son journal
  indique le fichier et la taille ; un échec apparaît comme une exécution en erreur du cron.

Restauration, **toujours dans une nouvelle base** :
1. créer une base vide (nouveau service PostgreSQL Railway, ou base locale) ;
2. construire l'image de sauvegarde, puis lancer le script de restauration (mêmes variables S3) :

```bash
docker build -f infra/docker/backup.Dockerfile -t dev4innova-backup .
```

```bash
docker run --rm -e TARGET_DATABASE_URL -e BACKUP_S3_BUCKET -e BACKUP_S3_ENDPOINT_URL -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION dev4innova-backup restore.sh backups/postgres/dev4innova-<date>.dump
```

3. vérifier le nombre de lignes des tables principales et la version Alembic affichée ;
4. si c'est une reprise après incident, faire pointer `DATABASE_URL` de `api`, `jobs` et
   `backup` vers la base restaurée, puis redéployer.

**Test de restauration** : avant l'ouverture, puis chaque trimestre. Noter la date, la durée et
le résultat dans le registre d'exploitation.

## 7. Surveillance

- **Erreurs** : Sentry (API et web), alertes e-mail sur les nouvelles erreurs.
- **Journaux** : Railway → service → *Logs*. Les lignes de l'API sont en JSON : filtrer avec
  `@level:ERROR`, `@logger:app.access`, ou `@request_id:<id>`. L'identifiant est renvoyé dans
  l'en-tête `X-Request-ID` de chaque réponse et apparaît comme tag dans Sentry.
- **Métriques** : Railway → service → *Metrics* (CPU, mémoire, réseau). Configurer les alertes
  d'usage et le plafond de dépenses du projet (*Usage*).
- **Tâches planifiées** : `jobs` (02:17 UTC, purges des sessions IA et des diagnostics) et
  `backup` (01:43 UTC) : vérifier leur dernière exécution chaque semaine.

## 8. Liste de contrôle avant ouverture (TASK-123)

- [ ] ADR-0018 accepté ; DPA Railway et Sentry signés ; politique de confidentialité à jour
      (hébergeur, sous-traitants, durées de conservation).
- [ ] Tous les services déployés, health checks verts, domaines et certificats actifs.
- [ ] Variables vérifiées : aucun mode simulé, `APP_ENV=production`, `ALLOW_INDEXING=true`.
- [ ] Workflow **Smoke tests** vert sur la production.
- [ ] Connexion Zitadel testée ; premier compte équipe promu (`python -m app.cli grant-staff` dans
      le shell du service `api`).
- [ ] Paiement Stripe réel de faible montant, webhook reçu, facture émise, puis remboursement.
- [ ] Erreur de test visible dans Sentry (API et web), sans donnée personnelle.
- [ ] Exécution de `backup` réussie, **restauration testée** dans une base neuve.
- [ ] Exécution de `jobs` réussie.
- [ ] Contenus FR/EN publiés, sitemap soumis à la Search Console.
- [ ] Plafond de dépenses Railway et budgets IA mensuels configurés.
