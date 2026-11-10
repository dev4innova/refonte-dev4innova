# Mise en production sur Railway

Procédure d'exploitation de la production (ADR-0018). Toute l'infrastructure Railway — services,
bases de données, domaines, variables — est décrite dans **`.railway/railway.ts`** (« Infrastructure
as Code » de Railway) et appliquée avec deux commandes : `railway config plan` puis
`railway config apply`. Ce document décrit ce qui reste à faire hors de ce fichier et ce qu'il
faut vérifier avant d'ouvrir le site.

## 1. Comptes et ressources externes

| Ressource | À créer | Remarque |
|---|---|---|
| Compte Railway | un *workspace* avec l'intégration GitHub autorisée sur le dépôt | le projet lui-même est créé par la CLI (section 2) |
| Stockage objet S3 (Europe) | 3 buckets : `…-media` (lecture publique), `…-portal` (privé), `…-backups` (privé, versionné) | une clé d'accès pour l'API (media + portal), **une autre** pour les sauvegardes |
| Sentry (région UE) | 2 projets : `dev4innova-api` (Python) et `dev4innova-web` (Next.js) | récupérer les DSN ; alertes « nouvelle erreur » par e-mail |
| Zitadel | application Web de production | URL de retour `https://www.<domaine>/api/auth/callback` (`docs/architecture/authentication.md`) |
| Stripe | clés live, webhook vers `https://api.<domaine>/api/v1/billing/webhooks/stripe` | événements listés dans l'ADR-0017 |
| DNS | enregistrements demandés par Railway pour `www.<domaine>` et `api.<domaine>` | affichés après le premier `apply` (*service → Settings → Networking*) ; certificats automatiques |

## 2. Créer la production en quelques commandes

Prérequis : Node 22, `pnpm install` à la racine (installe le SDK `railway`, version figée), et la
CLI Railway **5.49 ou plus** :

```bash
npm install -g @railway/cli
```

**a. Renseigner les réglages.** Dans `.railway/railway.ts`, compléter l'objet `SETTINGS` :
domaine, identifiants Zitadel, buckets, mentions légales du vendeur. Ce sont des valeurs non
secrètes, versionnées. Tant qu'une valeur vaut `CHANGE_ME`, le plan s'arrête avec une erreur qui
la nomme. Committer la modification.

**b. Créer et lier le projet** (une seule fois) :

```bash
railway login
```

```bash
railway init --name dev4innova
```

`railway init` crée le projet (environnement `production`) et lie le dossier courant ; pour un
projet existant, utiliser `railway link` à la place.

**c. Prévisualiser puis appliquer** :

```bash
make railway-plan
```

Le plan liste, à la manière de Terraform, ce qui sera créé, modifié ou supprimé
(`Plan: N to add, 0 to change, 0 to destroy` la première fois) ; les valeurs des variables sont
masquées. Il ne modifie rien.

```bash
make railway-apply
```

`apply` recalcule le plan, l'affiche et demande confirmation. Il crée PostgreSQL 17 et Redis
(région EU West, `europe-west4`), les services `web`, `api`, `jobs` et `backup` reliés au dépôt (branche `main`,
déploiement seulement une fois la CI verte) et toutes leurs variables.

**Domaines personnalisés** : la CLI ne sait pas les créer. Un domaine déclaré dans `domains` mais
absent de Railway arrête le plan (« Custom-domain registration is not supported… »). Il s'ajoute
dans le tableau de bord (*service → Settings → Networking → Custom Domain*, port `3000` pour `www`,
`8000` pour `api`). Sur un projet neuf, où les services n'existent pas encore : premier `apply`
avec la ligne `domains` des services `web` et `api` commentée, ajout des domaines dans le tableau
de bord, puis on la rétablit. Une fois créés, les domaines ne sont jamais modifiés ni supprimés
par `apply`.

**d. Saisir les secrets** (saisie masquée, jamais écrits dans le dépôt) :

```bash
make railway-secrets
```

Le script demande chaque secret déclaré `preserve()` dans `.railway/railway.ts` (clés S3, Stripe,
fournisseurs IA, DSN Sentry, IBAN/BIC, clé de session — tapez `g` pour la générer). Une réponse
vide conserve la valeur actuelle. Les services modifiés sont ensuite reconstruits. Pour un seul
service : `make railway-secrets service=api`.

Sous Windows (sans `make`), les mêmes commandes existent en scripts pnpm : `pnpm railway:plan`,
`pnpm railway:report`, `pnpm railway:apply`, `pnpm railway:secrets` (ce dernier demande `sh`,
fourni par Git for Windows).

**e. Domaines** : créer chez le registraire les enregistrements DNS affichés par Railway pour
`www` et `api`, puis vérifier avec les tests de fumée (section 4).

## 3. Modifier l'infrastructure

Toute modification passe par `.railway/railway.ts`, dans une PR comme le reste du code :

1. modifier le fichier (nouvelle variable, réplique, domaine, horaire de tâche…) ;
2. `make railway-plan` et relire le diff (le joindre à la PR) ;
3. après la fusion, `make railway-apply` depuis `main`.

Règles :
- **Le fichier possède toutes les variables des services** : une variable ajoutée à la main dans
  le tableau de bord sans être déclarée dans le fichier sera **supprimée** au prochain `apply`
  (le plan l'annonce). Une nouvelle variable de l'application doit donc être ajoutée au fichier,
  avec sa valeur si elle n'est pas secrète, ou `preserve()` si elle l'est.
- **Aucun secret dans le fichier** : `preserve()` garde la valeur stockée par Railway, saisie avec
  `make railway-secrets`. Ne jamais utiliser `ctx.randomString()` pour un secret : c'est un hachage
  prévisible d'un texte public.
- Les changements destructeurs (suppression d'un service, d'une base, d'une variable) demandent
  une confirmation explicite ; `--confirm-destructive` n'est à utiliser qu'après relecture du plan.
- Le code de l'application, lui, est déployé automatiquement à chaque fusion dans `main` : `apply`
  ne sert qu'aux changements d'infrastructure.

### Rapport de plan (lecture seule)

```bash
make railway-report
```

(`pnpm railway:report` sous Windows.) Il lit `railway config plan --json` et affiche, sans aucune
valeur de variable : la région, l'image, les volumes et le proxy public de chaque base (actuel →
déclaré), les changements destructifs, les changements d'image des bases (que Railway ne classe
**pas** destructifs, alors qu'une baisse de version majeure de PostgreSQL rend le volume
illisible), le groupe, les domaines et les variables de chaque service, dont celles qu'un `apply`
supprimerait.

### Recréer PostgreSQL et Redis (avant l'ouverture uniquement)

À faire seulement tant que les bases ne contiennent aucune donnée utile, par exemple si elles ont
été créées hors de `europe-west4` ou dans une autre version de PostgreSQL. Déplacer une base vers
une autre région est une opération destructive pour Railway (« Move database … ») ; la recréer
est plus propre et garantit la bonne région, la bonne version et un mot de passe neuf.

1. **Constat** : `make railway-report`. Attendu : seuls changements destructifs, « Move database
   postgres to europe-west4 » et « Move database redis to europe-west4 ». **S'il y en a d'autres**
   (suppression de service, de variable), s'arrêter et les analyser.
2. **Vérifier que les bases sont vides** (tableau de bord → `postgres` → *Data* : au plus les
   tables créées par les migrations ; `redis` : cache uniquement).
3. **Supprimer** dans le tableau de bord le service `postgres`, puis `redis` (*Settings → Danger →
   Delete service*), **avec leur volume** : vérifier sur le canevas qu'aucun volume détaché ne
   reste (il serait facturé et resterait dans l'ancienne région). Ne pas renommer les autres
   services ; ne pas toucher aux domaines.
   Entre cette étape et l'étape 5, `api`, `jobs` et `backup` n'ont plus de base : un déploiement
   lancé à ce moment échouerait (sans effet, rien n'est ouvert). Enchaîner sans attendre.
4. **Nouveau constat** : `make railway-report`. Attendu : les deux bases « will be created » en
   `europe-west4` avec l'image `postgres-ssl:17` et `railwayapp/redis:8.2`, **aucun changement
   destructif**, les domaines `www` et `api` présents et déclarés.
5. **Appliquer** : `make railway-apply` (pas de `--confirm-destructive` : rien n'est destructif).
6. **Fermer le proxy public** : Railway ouvre un proxy TCP public à la création de PostgreSQL.
   `make railway-plan` affiche alors « Update postgres networking » ; `make railway-apply` le
   ferme. Un troisième `make railway-plan` doit répondre « No changes ».
7. **Vérifier** dans le tableau de bord : région *EU West* pour `postgres`, `redis` et le volume de
   `postgres` ; la variable `REDIS_URL` existe sur `redis` et `DATABASE_URL` sur `postgres` ;
   `api` redéployé et `/api/v1/health/ready` répond 200 (`make smoke web=... api=...`).
   Si une base apparaît encore hors `europe-west4`, ou si `REDIS_URL` manque, s'arrêter : ne pas
   recommencer la suppression.

### Variables gérées par le fichier

| Service | Valeurs dans le fichier | Secrets (`preserve()`) |
|---|---|---|
| `api` | `APP_ENV=production`, `PORT=8000`, `DATABASE_URL` et `REDIS_URL` (références aux bases), `SITE_URL`, `API_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, `TRUST_FORWARDED_FOR`, Zitadel, stockage S3, mentions du vendeur | clés S3, clés IA, Stripe, IBAN/BIC, `SENTRY_DSN` |
| `web` | `PORT=3000`, `API_URL` (réseau privé), `SITE_URL`, `ALLOW_INDEXING`, Zitadel, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_DSN` (copie de `SENTRY_DSN`) | `AUTH_SESSION_SECRET`, `SENTRY_DSN` |
| `jobs` | mêmes réglages de base que l'API, `SENTRY_DSN` de l'API | — |
| `backup` | `DATABASE_URL`, bucket et point d'accès S3, rétention 30 jours | clé S3 des sauvegardes |

`DATABASE_URL` est l'URL fournie par la base Railway (`postgresql://…`) : l'API y ajoute elle-même
le pilote asyncpg. `RAILWAY_GIT_COMMIT_SHA` est fourni par Railway et sert de version dans Sentry.

L'API **refuse de démarrer** en production si l'authentification manque, si `SITE_URL` ou une
origine CORS n'est pas en HTTPS, ou si l'IA ou le paiement simulés sont activés : le message
« Unsafe production settings » dans les journaux du déploiement dit quoi corriger.

### Dépôt GitHub (*Settings → Secrets and variables → Actions → Variables*)

| Variable | Valeur |
|---|---|
| `SMOKE_WEB_URL` | `https://www.<domaine>` |
| `SMOKE_API_URL` | `https://api.<domaine>` |

## 4. Déployer

Une fusion dans `main` suffit :
1. la CI passe (lint, types, tests, E2E, client d'API, sécurité, images Docker) ; Railway attend
   qu'elle soit verte (`checkSuites` dans `.railway/railway.ts`) ;
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

- Railway sauvegarde le volume PostgreSQL (*Postgres → Backups*, non géré par le fichier : activer les sauvegardes
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
- [ ] `make railway-plan` n'annonce aucun changement (la production correspond au fichier).
- [ ] `make railway-report` : bases et volumes en `europe-west4`, PostgreSQL 17, aucun proxy TCP
      public, chaque service dans son groupe, domaines `www` et `api` présents.
- [ ] Domaines : port cible `3000` pour `www` et `8000` pour `api` (*service → Settings →
      Networking*) ; la configuration ne gère pas le port d'un domaine déjà créé.
- [ ] Secrets saisis (`make railway-secrets`) ; aucun mode simulé.
- [ ] Workflow **Smoke tests** vert sur la production.
- [ ] Connexion Zitadel testée ; premier compte équipe promu (`python -m app.cli grant-staff` dans
      le shell du service `api`).
- [ ] Paiement Stripe réel de faible montant, webhook reçu, facture émise, puis remboursement.
- [ ] Erreur de test visible dans Sentry (API et web), sans donnée personnelle.
- [ ] Exécution de `backup` réussie, **restauration testée** dans une base neuve.
- [ ] Exécution de `jobs` réussie.
- [ ] Contenus FR/EN publiés, sitemap soumis à la Search Console.
- [ ] Plafond de dépenses Railway et budgets IA mensuels configurés.
