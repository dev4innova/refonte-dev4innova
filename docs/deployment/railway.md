# Mise en production sur Railway

Procédure d'exploitation de la production (ADR-0018, ADR-0019). La plateforme ne dépend que de
Railway :
- les comptes sont intégrés à l'API ;
- les fichiers sont dans des Railway Buckets ;
- il n'y a ni Zitadel, ni Scaleway, ni Sentry, ni Stripe ;
- seules les clés des fournisseurs d'IA sont externes, et elles sont optionnelles.

Le déploiement se fait **à la main dans le tableau de bord Railway** (section 2). Le fichier
`.railway/railway.ts` décrit la même infrastructure pour qui préfère `railway config plan` /
`apply` (section 3). Ne pas mélanger les deux sur un même projet : `apply` supprime les
variables ajoutées à la main.

## 1. Avant de commencer

- Un compte Railway, avec l'accès GitHub au dépôt `dev4innova/refonte-dev4innova`
  (*Account Settings → GitHub*).
- Le domaine `dev4innova.com`, et l'accès à sa zone DNS.
- Optionnel : les clés des fournisseurs d'IA utilisés (Anthropic, OpenAI, Gemini).
- Pour copier les variables : sur chaque service, *Variables → Raw Editor*. Remplacer les `<…>`.

## 2. Déployer à la main (tableau de bord)

Ordre : bases et buckets, puis `api` (ses migrations ont besoin de la base), puis `web` et les
tâches planifiées. Pour chaque service, choisir la région **EU West (Amsterdam)** dans
*Settings → Deploy → Regions*.

### 2.1 PostgreSQL et Redis
1. *+ New → Database → PostgreSQL*, puis *+ New → Database → Redis*. Garder les noms
   proposés (`Postgres`, `Redis`) : ils servent dans les références `${{Postgres.…}}`.
2. Région EU West pour les deux.
3. *Settings → Networking* : supprimer le **TCP Proxy** public de chaque base (accès par le
   réseau privé uniquement).
4. `Postgres` → *Backups* : activer les sauvegardes quotidiennes et hebdomadaires.

Le tableau de bord installe PostgreSQL 18 ; l'image de sauvegarde (`pg_dump` 18) le prend
en charge.

### 2.2 Buckets
*+ New → Bucket*, trois fois, région Amsterdam : `media`, `portal`, `backups`. Ils sont
privés. Leurs identifiants (nom réel, endpoint, région, clés) sont dans l'onglet
*Credentials* de chaque bucket : on les référence ci-dessous avec `${{media.…}}` (adapter si
Railway nomme les variables autrement dans cet onglet).

### 2.3 Service `api`
*+ New → GitHub Repo* `dev4innova/refonte-dev4innova`, renommer en `api`.

- *Source* : branche `main`, activer **Wait for CI**, *Root Directory* vide.
- *Build* :
  - builder **Dockerfile**, chemin `infra/docker/api.Dockerfile` ;
  - *Watch Paths* : `apps/api/**`, `infra/docker/api.Dockerfile`.
- *Deploy* :
  - *Pre-deploy Command* `alembic upgrade head` ;
  - *Healthcheck Path* `/api/v1/health/ready`, timeout 120 ;
  - *Restart* On Failure (5) ;
  - EU West, 1 réplique.
- *Networking* : domaine `api.dev4innova.com`, port **8000**.

```
APP_ENV=production
LOG_LEVEL=INFO
PORT=8000
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
SITE_URL=https://www.dev4innova.com
API_PUBLIC_URL=https://api.dev4innova.com
CORS_ALLOWED_ORIGINS=["https://www.dev4innova.com"]
TRUST_FORWARDED_FOR=true
MEDIA_PUBLIC_BASE_URL=https://api.dev4innova.com/api/v1/media
MEDIA_S3_BUCKET=${{media.BUCKET}}
MEDIA_S3_ENDPOINT_URL=${{media.ENDPOINT}}
MEDIA_S3_REGION=${{media.REGION}}
MEDIA_S3_ACCESS_KEY_ID=${{media.ACCESS_KEY_ID}}
MEDIA_S3_SECRET_ACCESS_KEY=${{media.SECRET_ACCESS_KEY}}
PORTAL_S3_BUCKET=${{portal.BUCKET}}
PORTAL_S3_ENDPOINT_URL=${{portal.ENDPOINT}}
PORTAL_S3_REGION=${{portal.REGION}}
PORTAL_S3_ACCESS_KEY_ID=${{portal.ACCESS_KEY_ID}}
PORTAL_S3_SECRET_ACCESS_KEY=${{portal.SECRET_ACCESS_KEY}}
BILLING_SELLER_NAME=DEV4INNOVA
BILLING_SELLER_LEGAL_FORM=<ex. SAS au capital de …>
BILLING_SELLER_ADDRESS=<adresse>
BILLING_SELLER_SIREN=<SIREN>
BILLING_SELLER_VAT_NUMBER=<TVA intracommunautaire>
BILLING_SELLER_IBAN=<IBAN>
BILLING_SELLER_BIC=<BIC>
BILLING_SELLER_EMAIL=<e-mail de facturation>
RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=30
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30
```

Ajouter seulement les clés d'IA utilisées : `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`GEMINI_API_KEY`.

**Astuce** : dans l'éditeur de variables, taper `${{` propose les services et leurs
variables. C'est le moyen le plus sûr d'écrire une référence exacte : une référence à un nom
inexistant devient une chaîne vide, et l'API refuse alors de démarrer (`redis_url … input is
empty`).

### 2.4 Service `web`
Même dépôt, renommer en `web`.

- *Source* : `main`, **Wait for CI**.
- *Build* :
  - Dockerfile `infra/docker/web.Dockerfile` ;
  - *Watch Paths* : `apps/web/**`, `packages/**`, `pnpm-lock.yaml`,
    `infra/docker/web.Dockerfile`.
- *Deploy* :
  - *Healthcheck* `/api/health`, timeout 120 ;
  - *Restart* On Failure (5) ;
  - EU West.
- *Networking* : domaine `www.dev4innova.com`, port **3000**.

```
PORT=3000
API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000
SITE_URL=https://www.dev4innova.com
ALLOW_INDEXING=true
RAILWAY_DEPLOYMENT_OVERLAP_SECONDS=30
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30
```

### 2.5 Service `jobs` (purges quotidiennes)
Même dépôt, renommer en `jobs`.

- Dockerfile `infra/docker/api.Dockerfile`.
- *Custom Start Command* `python -m app.cli daily`.
- *Cron Schedule* `17 2 * * *`.
- *Restart* Never.
- EU West, pas de domaine.

```
APP_ENV=production
LOG_LEVEL=INFO
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
SITE_URL=https://www.dev4innova.com
API_PUBLIC_URL=https://api.dev4innova.com
CORS_ALLOWED_ORIGINS=["https://www.dev4innova.com"]
```

### 2.6 Service `backup` (export quotidien de la base)
Même dépôt, renommer en `backup`.

- Dockerfile `infra/docker/backup.Dockerfile`.
- *Cron* `43 1 * * *`.
- *Restart* Never.
- EU West.

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=${{backups.BUCKET}}
BACKUP_S3_ENDPOINT_URL=${{backups.ENDPOINT}}
AWS_DEFAULT_REGION=${{backups.REGION}}
AWS_ACCESS_KEY_ID=${{backups.ACCESS_KEY_ID}}
AWS_SECRET_ACCESS_KEY=${{backups.SECRET_ACCESS_KEY}}
```

### 2.7 Domaines et premier administrateur
1. Créer chez le registraire les enregistrements DNS affichés par Railway pour
   `www.dev4innova.com` et `api.dev4innova.com`. Les certificats sont automatiques.
2. Sur le site, *Créer un compte* avec l'adresse de l'administrateur.
3. Lui donner le rôle depuis le shell du service `api` :

```bash
railway ssh --service api
```

```bash
python -m app.cli grant-staff <e-mail> staff_admin
```

4. **Mot de passe oublié** :
   - pour un utilisateur : *Admin → Comptes*, ce qui génère un mot de passe temporaire ;
   - pour le seul administrateur : `python -m app.cli reset-password <e-mail>` dans le même
     shell.

### 2.8 Dépôt GitHub
Dans *Settings → Secrets and variables → Actions → Variables*, ajouter
`SMOKE_WEB_URL=https://www.dev4innova.com` et `SMOKE_API_URL=https://api.dev4innova.com` : les
tests de fumée tourneront après chaque déploiement de production.

## 3. Option : infrastructure as code (`railway config`)

`.railway/railway.ts` décrit les mêmes services, bases, buckets et variables :
- `make railway-plan` (ou `pnpm railway:plan` sous Windows) prévisualise les changements ;
- `make railway-apply` les applique ;
- `make railway-secrets` saisit les secrets et les identifiants des buckets.

Le fichier possède **toutes** les variables : une variable ajoutée à la main serait supprimée
au prochain `apply`, et le plan l'annonce avant. Points connus de la CLI Railway :

- **Identifiant de région** : le placement attend l'identifiant de déploiement,
  `europe-west4-drams3a` pour EU West, et non `europe-west4`.
- **Région des services masquée** : le plan ne montre pas la région d'un service. `make
  railway-report` la lit, ainsi que les images, les volumes et les changements destructifs
  des bases, sans afficher aucune valeur.
- **Domaines** : la CLI ne crée pas les domaines personnalisés ; ils s'ajoutent dans le
  tableau de bord.
- **Proxy public** : à la création de PostgreSQL, la CLI ouvre un proxy TCP public ; le
  fichier le ferme au `apply` suivant.
- **« Apply finished with status failed »** sans détail : relancer avec
  `railway config apply --json | node --experimental-strip-types --no-warnings infra/railway/plan-report.mts`
  pour lire le message du serveur. Attention, `--json` applique sans confirmation : à
  utiliser seulement juste après avoir relu le plan.

## 4. Déployer

Une fusion dans `main` suffit :
1. la CI passe (lint, types, tests, E2E, client d'API, sécurité, images Docker) ; Railway attend
   qu'elle soit verte (« Wait for CI ») ;
2. Railway construit les services modifiés (`watchPatterns`) ;
3. `api` : `alembic upgrade head` en pré-déploiement ; s'il échoue, rien n'est basculé ;
4. la nouvelle version reçoit le trafic une fois son health check vert ;
5. le workflow **Smoke tests** vérifie le site et l'API en production.

Les migrations doivent rester compatibles avec la version précédente
(`docs/rules/database.md`).

Tests de fumée à la main, depuis un poste ou l'onglet *Actions* (*Smoke tests → Run workflow*) :

```bash
make smoke web=https://www.dev4innova.com api=https://api.dev4innova.com
```

## 5. Retour arrière

- **Code** : dans Railway, service concerné → *Deployments* → déploiement précédent → *Redeploy*.
  Puis corriger dans `main` (le prochain merge redéploie).
- **Migration** : pas d'annulation automatique. Écrire une migration corrective ; en dernier
  recours, `alembic downgrade -1` depuis le shell du service `api` (*Railway → api → Shell*),
  après une sauvegarde.
- **Données** : voir la restauration ci-dessous.

## 6. Sauvegardes et restauration

- Railway sauvegarde le volume PostgreSQL (*Postgres → Backups* : sauvegardes quotidiennes et
  hebdomadaires).
- Le service `backup` exporte la base chaque nuit (01:43 UTC) dans le bucket `backups`, en vérifiant
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

- **Erreurs et journaux** : Railway → service → *Logs* (pas d'outil externe, ADR-0019). Les
  lignes de l'API sont en JSON : filtrer avec `@level:ERROR`, `@logger:app.access`, ou
  `@request_id:<id>`. L'identifiant est renvoyé dans l'en-tête `X-Request-ID` de chaque
  réponse : un utilisateur peut le transmettre pour retrouver sa requête.
- **Métriques** : Railway → service → *Metrics* (CPU, mémoire, réseau). Configurer les alertes
  d'usage et le plafond de dépenses du projet (*Usage*).
- **Tâches planifiées** : `jobs` (02:17 UTC, purges des sessions IA, des diagnostics et des
  sessions de connexion expirées) et
  `backup` (01:43 UTC) : vérifier leur dernière exécution chaque semaine.

## 8. Liste de contrôle avant ouverture (TASK-123)

- [ ] ADR-0018 et ADR-0019 acceptés ; DPA Railway signé ; politique de confidentialité à jour
      (hébergeur, comptes, durées de conservation).
- [ ] Tous les services déployés en EU West, health checks verts, domaines et certificats actifs.
- [ ] Domaines : port cible `3000` pour `www`, `8000` pour `api`.
- [ ] Aucun proxy TCP public sur `Postgres` et `Redis`.
- [ ] Aucun mode simulé (`BILLING_SIMULATED_PAYMENTS`, `AI_ENABLE_SIMULATED_PROVIDER`).
- [ ] Workflow **Smoke tests** vert sur la production.
- [ ] Compte créé, connexion, déconnexion, changement de mot de passe testés ; premier
      administrateur promu (`grant-staff`) ; mot de passe temporaire testé (*Admin → Comptes*).
- [ ] Image envoyée dans la médiathèque et visible sur le site (servie par l'API).
- [ ] Document déposé et téléchargé dans le portail client (lien signé).
- [ ] Facture émise et réglée par virement (enregistrement du paiement).
- [ ] Exécution de `backup` réussie (fichier dans le bucket `backups`), **restauration testée**
      dans une base neuve.
- [ ] Exécution de `jobs` réussie.
- [ ] Contenus FR/EN publiés, sitemap soumis à la Search Console.
- [ ] Plafond de dépenses Railway et budgets IA mensuels configurés.
