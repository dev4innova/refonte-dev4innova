# ADR-0018 — Production sur Railway : déploiement continu, observabilité, sauvegardes

- **Statut** : Proposé — **amendé par l'ADR-0019** : Sentry retiré (journaux Railway seuls),
  stockage sur Railway Buckets au lieu d'un S3 externe, plus de fournisseur d'identité.
- **Date** : 2026-11-09
- **Tâches liées** : TASK-116, TASK-117, TASK-118, TASK-119, TASK-120, TASK-122, TASK-123

## Contexte
La plateforme (site Next.js, API FastAPI, PostgreSQL, Redis, stockage objet) doit passer en
production. `docs/architecture/overview.md` demandait un ADR sur l'hébergeur avant TASK-122.

Contraintes :
- une équipe réduite : pas de Kubernetes ni d'infrastructure à maintenir ;
- des données personnelles (CRM, portail, facturation) : hébergement dans l'Union européenne ;
- des images Docker déjà prêtes (`infra/docker`) ;
- des migrations Alembic à appliquer avant chaque nouvelle version de l'API.

Décisions du responsable du projet :
- hébergement sur **Railway** ;
- **Sentry** pour les erreurs ;
- **mise en production automatique** de chaque fusion dans `main`, une fois la CI passée ;
- tests de sécurité limités à l'**analyse du code et des secrets**.

## Décision

### Hébergement : un projet Railway, région européenne
Un projet Railway, avec l'environnement `production`, dans la région **EU West (Amsterdam),
identifiant de déploiement `europe-west4-drams3a`**.

Tout le projet est décrit dans un seul fichier versionné, **`.railway/railway.ts`**
(« Infrastructure as Code » de Railway, SDK `railway`, version figée) :
- `railway config plan` affiche le diff avec la production, à la manière de Terraform ;
- `railway config apply` l'applique après confirmation.

Le fichier possède les services, les bases, les domaines et **toutes les variables**. Les
secrets y sont déclarés `preserve()` : Railway garde leur valeur, saisie avec `make railway-secrets`.

| Ressource | Image | Rôle |
|---|---|---|
| `web` | `infra/docker/web.Dockerfile` | site public, portail, back-office (domaine public `www`) |
| `api` | `infra/docker/api.Dockerfile` | API (domaine public `api`, pour les webhooks Stripe) ; migrations en pré-déploiement |
| `jobs` | image de l'API | tâche planifiée quotidienne `python -m app.cli daily` (purges) |
| `backup` | `infra/docker/backup.Dockerfile` | tâche planifiée quotidienne `pg_dump` vers S3 |
| `postgres` | PostgreSQL 17 (Railway) | source de vérité, volume sauvegardé |
| `redis` | Redis (Railway) | cache, limites de débit |

PostgreSQL est fixé en version 17, comme la CI, Docker Compose et l'image de sauvegarde
(`pg_dump` doit être au moins de la version du serveur). Une montée de version majeure se fera
par une décision explicite, en mettant ces quatre endroits à jour ensemble.

Les anciens fichiers « Config as Code » (`railway.json`) ne sont pas utilisés : Railway cesse de
les lire le 2026-12-01 et un service ne peut pas être géré par les deux mécanismes.

Le web parle à l'API par le **réseau privé** Railway (`http://api.railway.internal:8000`).
L'API écoute en IPv6 (`--host ::`), car le réseau privé Railway est en IPv6.

Le **stockage objet** (médias publics du CMS, fichiers privés du portail, sauvegardes) reste un
service S3 externe en Europe (Scaleway Object Storage `fr-par`, ou équivalent). Railway ne
fournit pas de stockage objet avec liens signés et accès public par bucket, et les sauvegardes
doivent survivre à une perte du projet Railway.

### Déploiement continu (TASK-116, TASK-122)
- L'intégration GitHub de Railway déploie `main` à chaque fusion, en attendant la CI
  (`checkSuites`, l'option « Wait for CI ») : rien ne part en production tant que les jobs de la
  CI ne sont pas verts.
- Les changements d'infrastructure, eux, passent par une PR qui modifie `.railway/railway.ts`
  (plan joint à la PR), puis par `railway config apply` après la fusion.
- Les `watchPatterns` ne reconstruisent que les services dont le code a changé.
- `preDeployCommand: alembic upgrade head` applique les migrations avant le basculement. Si une
  migration échoue, le déploiement s'arrête et l'ancienne version continue de servir.
- La nouvelle version ne reçoit le trafic qu'une fois son health check passé : `/api/v1/health/ready`
  pour l'API (base de données et Redis), `/api/health` pour le web. Les deux versions se
  chevauchent 30 s, puis l'ancienne a 30 s pour finir ses requêtes : pas de coupure.
- Les migrations doivent donc rester **compatibles avec la version précédente** pendant ce
  chevauchement (ajouter avant de supprimer, en deux déploiements : `docs/rules/database.md`).
- **Retour arrière** : « Redeploy » d'un déploiement précédent dans Railway. Les migrations ne
  sont pas annulées automatiquement : une migration destructrice se corrige par une nouvelle
  migration.
- **Tests de fumée** : chaque déploiement de production réussi déclenche le workflow
  `.github/workflows/smoke.yml` (`infra/scripts/smoke.sh`). Il vérifie les health checks, les
  pages FR/EN, le sitemap, les en-têtes de sécurité et le refus d'accès sans authentification.

### Observabilité (TASK-117, TASK-118)
- **Erreurs : Sentry**, région UE, un projet pour l'API et un pour le web.
  - Activé seulement si un DSN est fourni (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`).
  - Pas de données personnelles : `send_default_pii=False`, aucun corps de requête, aucun
    cookie ni en-tête, aucun utilisateur. Les URL perdent leur chaîne de requête, et les jetons
    des liens de résultat sont masqués.
  - Release = commit déployé (`RAILWAY_GIT_COMMIT_SHA`), traces échantillonnées à 10 % (API et
    serveur web) et 5 % (navigateur).
- **Logs : journaux Railway.**
  - L'API écrit une ligne JSON par événement, avec un identifiant de requête (`X-Request-ID`
    accepté s'il est valide, sinon généré, et renvoyé dans la réponse) et un journal d'accès
    (`app.access` : méthode, chemin, statut, durée).
  - Les health checks ne sont journalisés qu'en cas d'erreur.
  - Les journaux de Railway sont filtrables par attribut JSON (`@level:ERROR`, `@request_id:...`).
- **Métriques et alertes : Railway** (CPU, mémoire, réseau, redémarrages) et alertes Sentry
  (nouvelle erreur, pic d'erreurs).
- **Adaptation** : Scaleway Cockpit avait été retenu avec Sentry, mais il ne collecte que les
  ressources Scaleway. Les journaux et métriques intégrés de Railway le remplacent ; on pourra
  ajouter un collecteur OpenTelemetry plus tard si la rétention de Railway ne suffit pas.

### Sauvegardes (TASK-119)
Deux niveaux de sauvegarde :
1. **Sauvegardes du volume PostgreSQL par Railway** (quotidiennes et hebdomadaires), pour une
   restauration rapide dans le projet.
2. **Sauvegarde logique quotidienne hors de Railway** (service `backup`, 01:43 UTC).
   - `pg_dump` au format custom, vérifié par `pg_restore --list`.
   - Copie dans un bucket S3 privé dédié, conservée 30 jours (`BACKUP_RETENTION_DAYS`).
   - Le bucket est versionné et ses identifiants ne servent qu'aux sauvegardes.
   - `infra/backup/restore.sh` restaure dans une **nouvelle** base, jamais par-dessus la
     production. Un test de restauration est fait avant la mise en production, puis chaque
     trimestre.

Objectifs : perte de données maximale 24 h (RPO), remise en service en moins de 4 h (RTO).

### Sécurité (TASK-120, TASK-123)
- **Analyse du code** :
  - Bandit sur `apps/api/app` ;
  - règles `eslint-plugin-security` dans le lint du web, sans aucun avertissement toléré.
- **Analyse des secrets** : gitleaks sur tout l'historique git, dans le job CI
  « Security (code and secrets) ».
  - Le binaire est épinglé et son empreinte vérifiée.
  - Les seules exceptions sont des valeurs factices précises, listées dans `.gitleaks.toml`.
- **Garde-fou de configuration** : en production, l'API refuse de démarrer si :
  - l'authentification n'est pas configurée ;
  - `SITE_URL` ou une origine CORS n'est pas en HTTPS ;
  - l'IA ou le paiement simulés sont activés.
- **En-têtes HTTP** :
  - le web envoie HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` et interdit d'être
    affiché dans un cadre (`frame-ancestors 'none'`, `X-Frame-Options`) ;
  - l'API envoie `nosniff`.
  - Une politique CSP complète, avec nonces, reste à faire.
- **Non retenus pour l'instant** : test dynamique (OWASP ZAP), scan des images (Trivy), audit des
  dépendances Python (pip-audit, en plus de Dependabot) et tests de charge (k6, TASK-121).

## Alternatives considérées
- **Scaleway (Serverless Containers, PostgreSQL managé, Cockpit)** :
  - pour : tout chez un hébergeur français, et Cockpit intégré ;
  - contre : plus d'assemblage (registre, réseau privé, secrets, déploiement à scripter).
  - Non retenu par le responsable du projet.
- **Vercel (web) + hébergeur pour l'API** :
  - pour : le meilleur support de Next.js ;
  - contre : deux plateformes, un trafic web-API sur Internet, et des données hors du périmètre
    choisi.
- **Kubernetes managé** : surdimensionné pour l'équipe et le trafic attendus.
- **Déploiement manuel (validation humaine)** :
  - pour : plus de contrôle ;
  - contre : livraisons groupées et plus risquées.
  - Le responsable du projet a choisi le déploiement automatique, avec la CI comme porte d'entrée.
- **Environnement de recette (staging)** : non créé pour l'instant. Railway permet d'ajouter un
  environnement `staging` (ou des environnements de PR) avec les mêmes fichiers.

## Conséquences
- Plus simple :
  - un `git merge` met en production ;
  - l'infrastructure se recrée en quatre commandes (`railway init`, `plan`, `apply`, secrets) et
    toute modification est relue sous forme de diff ;
  - les retours arrière se font en un clic ;
  - la configuration des services est versionnée.
- À surveiller :
  - **Migrations rétrocompatibles** : obligatoires, à cause du chevauchement de 30 s.
  - **Variables gérées par le fichier** : une variable ajoutée à la main dans Railway sans être
    déclarée dans `.railway/railway.ts` est supprimée au prochain `apply` (le plan l'annonce).
  - **Limites de la CLI** : elle ne crée pas les domaines personnalisés (ajoutés dans le
    tableau de bord, puis jamais modifiés par `apply`) ; elle ouvre un proxy TCP public à la
    création de PostgreSQL, fermé par le fichier au `apply` suivant ; elle classe « sûr » un
    changement d'image de base de données, à vérifier avec `make railway-report`.
  - **SDK en bêta** : l'API du SDK `railway` peut changer ; il est figé dans `package.json` et
    sa montée de version se vérifie par un `plan` sans changement.
  - **Coût Railway** : facturé à l'usage (CPU, mémoire, volume). À suivre chaque mois.
  - **Rétention des journaux Railway** : limitée selon l'offre. Les erreurs restent dans Sentry.
  - **Localisation des données** : Railway est une société américaine, même si l'hébergement
    est en UE. Le registre des traitements et la politique de confidentialité doivent la
    mentionner comme sous-traitant (DPA Railway, DPA Sentry).
  - **Sans environnement de recette**, la CI et les tests E2E sont la seule barrière avant la
    production.
- Procédure d'exploitation : `docs/deployment/railway.md`.
