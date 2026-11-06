# DEV4INNOVA — Engineering Backlog V1

> Priorités et dépendances **proposées** — à valider par le responsable du projet.

## Règle de priorisation
- **P0** : fondations indispensables.
- **P1** : fonctionnalités nécessaires à la première version commerciale.
- **P2** : fonctionnalités d'expansion.
- **P3** : optimisations et fonctionnalités avancées.

Une fonctionnalité ne peut pas être développée avant les fondations dont elle dépend.

## Vue d'ensemble

| Epic | Titre | Priorité | Dépend de | État |
|---|---|---|---|---|
| 00 | Project Governance | P0 | — | ✅ livré (validation de l'architecture en attente) |
| 01 | Infrastructure Foundation | P0 | 00 | ✅ livré |
| 02 | Design System | P0 | 01 | à faire |
| 03 | Internationalization | P0 | 01 (02 pour le sélecteur) | à faire |
| 04 | Identity & Access | P0 | 01, décision ADR-0009 | à faire |
| 05 | Corporate Website | P1 | 02, 03 (06 pour le contenu dynamique) | à faire |
| 06 | CMS & Administration | P1 | 04 | à faire |
| 07 | CRM & Leads | P1 | 04 | à faire |
| 14a | CI/CD minimal (TASK-116) | **P0** — avancé | 01 | à faire |
| 08 | AI Gateway | P1 | 04 | à faire |
| 10 | AI Business Diagnostic | P1 | 08, 07 | à faire |
| 09 | AI Experiences | P2 | 08 | à faire |
| 11 | Client Portal | P2 | 04 (07, 13 pour les liens) | à faire |
| 12 | Academy | P2 | 04, 06 | à faire |
| 13 | Commerce & Billing | P2 | 04, 07 | à faire |
| 14 | Production & Scale (reste) | P1 avant mise en ligne, P3 pour la charge | tout ce qui est déployé | à faire |

### Ajustements recommandés
1. **TASK-116 (CI/CD) avancée juste après l'EPIC 01** : lint, typecheck, tests et commitlint
   dès le premier code applicatif, plutôt qu'en fin de projet.
2. **TASK-038 (choix de l'IdP) à trancher pendant l'EPIC 01**, pour ne pas bloquer l'EPIC 04 (voir ADR-0009).
3. **TASK-057 (formulaires du site) dépend de TASK-067/TASK-072** (CRM) pour stocker les
   leads : prévoir un stockage minimal ou séquencer 07 avant la fin de 05.
4. **TASK-056 (SEO)** : socle (metadata, sitemap, hreflang) dès les premières pages de 05.
5. **Sauvegardes (TASK-119) et monitoring/logs (TASK-117/118)** obligatoires avant toute
   donnée client réelle en production.

## Détail des epics

### EPIC 00 — Project Governance (P0)
| Tâche | Livrable | État |
|---|---|---|
| TASK-001 | Dépôt git créé (par le responsable) | ✅ |
| TASK-002 | Structure monorepo (`apps/`, `packages/`, `infra/`, `docs/`) | ✅ |
| TASK-003 | `CLAUDE.md` | ✅ |
| TASK-004 | `docs/rules/frontend.md` | ✅ |
| TASK-005 | `docs/rules/backend.md` | ✅ |
| TASK-006 | `docs/rules/database.md` | ✅ |
| TASK-007 | `docs/rules/security.md` | ✅ |
| TASK-008 | `docs/rules/commits.md`, `commitlint.config.mjs` | ✅ |
| TASK-009 | `docs/adr/` (ADR-0001 à 0009), `docs/architecture/overview.md` | ✅ |

**DoD** : documentation accessible ✅ · architecture validée ⏳ (revue des ADR « Proposé ») ·
règles de développement configurées ✅ · git initialisé ✅.

### EPIC 01 — Infrastructure Foundation (P0)
TASK-010 Next.js + TS · TASK-011 FastAPI · TASK-012 PostgreSQL · TASK-013 Redis ·
TASK-014 Docker Compose · TASK-015 variables d'environnement · TASK-016 FastAPI ↔ PostgreSQL ·
TASK-017 SQLAlchemy · TASK-018 Alembic · TASK-019 health checks.
Ordre : 010, 011 → 012, 013 → 015 → 017 → 016 → 018 → 014 → 019.

| Tâche | Livrable | État |
|---|---|---|
| TASK-010 | `apps/web` : Next.js 16, TypeScript strict, ESLint, Vitest, sortie `standalone` | ✅ |
| TASK-011 | `apps/api` : FastAPI, config, erreurs au format unique, logs JSON, Ruff, mypy strict, pytest | ✅ |
| TASK-012 | PostgreSQL 17 (Compose) + base de test `dev4innova_test` | ✅ |
| TASK-013 | Redis 7 (Compose, AOF) + client async `app/core/redis.py` | ✅ |
| TASK-014 | `infra/docker/compose.yaml`, `api.Dockerfile`, `web.Dockerfile`, `Makefile` | ✅ |
| TASK-015 | `.env.example` par application, `docs/architecture/environment-variables.md` | ✅ |
| TASK-016 | moteur async SQLAlchemy/asyncpg, dépendance `get_session` | ✅ |
| TASK-017 | `Base` déclarative, convention de nommage, mixins UUID / timestamps | ✅ |
| TASK-018 | Alembic async, migration `0001` baseline, service `migrate` en Compose, test upgrade/downgrade/drift | ✅ |
| TASK-019 | `/api/v1/health/live`, `/api/v1/health/ready` (PostgreSQL + Redis, 503 si KO), `/api/health` (web → API), healthchecks Docker | ✅ |

En plus : `packages/api-client` généré depuis l'OpenAPI (`make client`), utilisé par le web pour appeler l'API.

**DoD** : tous les services démarrent ✅ · frontend ↔ backend ✅ · backend ↔ PostgreSQL ✅ ·
migrations fonctionnelles ✅ · health checks OK ✅.

### EPIC 02 — Design System (P0)
TASK-020 Tailwind · TASK-021 shadcn/ui · TASK-022 couleurs · TASK-023 typographies ·
TASK-024 espacements · TASK-025 boutons · TASK-026 cartes · TASK-027 formulaires ·
TASK-028 navigation · TASK-029 footer · TASK-030 animations · TASK-031 responsive.
Ordre : 020 → 021 → 022-024 (tokens) → 025-029 → 030 → 031.

**DoD** : tokens centralisés · composants réutilisables · responsive vérifié · accessibilité.

### EPIC 03 — Internationalization (P0)
TASK-032 next-intl · TASK-033 dictionnaires FR · TASK-034 dictionnaires EN ·
TASK-035 routes localisées · TASK-036 sélecteur de langue (après TASK-028) ·
TASK-037 tests de navigation multilingue.

### EPIC 04 — Identity & Access (P0)
TASK-038 choix de l'IdP (ADR-0009) → TASK-039 authentification → TASK-040 profils →
TASK-041 organisations → TASK-042 memberships → TASK-043 rôles et permissions →
TASK-044 routes privées → TASK-045 tests d'isolation.

### EPIC 05 — Corporate Website (P1)
TASK-046 navbar (après TASK-028) · TASK-047 homepage · TASK-048 About · TASK-049 Solutions ·
TASK-050 Services · TASK-051 Portfolio · TASK-052 Innovation Lab · TASK-053 Academy ·
TASK-054 Insights · TASK-055 Contact · TASK-056 SEO · TASK-057 formulaires (après TASK-067).

### EPIC 06 — CMS & Administration (P1)
TASK-058 modèles CMS → TASK-059 traductions → TASK-060 interface admin → TASK-061 pages ·
TASK-062 articles · TASK-063 services · TASK-064 projets · TASK-065 médias · TASK-066 SEO.

### EPIC 07 — CRM & Leads (P1)
TASK-067 prospects → TASK-068 activités · TASK-069 pipeline · TASK-070 attribution ·
TASK-071 tableau de bord · TASK-072 demandes de devis.

### EPIC 08 — AI Gateway (P1)
TASK-073 contrat fournisseur → TASK-074 Anthropic · TASK-075 OpenAI · TASK-076 Gemini ·
TASK-077 registre des modèles · TASK-078 prompts · TASK-079 streaming · TASK-080 tokens et coûts ·
TASK-081 quotas · TASK-082 tests des fournisseurs.

### EPIC 09 — AI Experiences (P2)
TASK-083 AI Assistant · TASK-084 Document Analyzer · TASK-085 Content Generator ·
TASK-086 sessions · TASK-087 historiques · TASK-088 limitation des abus.
Note : 086-088 sont des prérequis de 083-085 et doivent être faites en premier.

### EPIC 10 — AI Business Diagnostic (P1)
TASK-089 questionnaire → TASK-090 scoring → TASK-091 recommandations → TASK-092 analyse IA
(après EPIC 08) → TASK-093 rapports → TASK-094 export PDF · TASK-095 connexion CRM (après EPIC 07).

### EPIC 11 — Client Portal (P2)
TASK-096 dashboard · TASK-097 projets · TASK-098 tâches · TASK-099 livrables ·
TASK-100 documents · TASK-101 support · TASK-102 notifications.

### EPIC 12 — Academy (P2)
TASK-103 catalogue · TASK-104 modules · TASK-105 leçons · TASK-106 inscriptions ·
TASK-107 progression · TASK-108 quiz · TASK-109 certificats.

### EPIC 13 — Commerce & Billing (P2)
TASK-110 catalogue · TASK-111 devis · TASK-112 factures · TASK-113 paiements ·
TASK-114 abonnements · TASK-115 transactions. Le choix du prestataire de paiement
(et de la facturation conforme à la réglementation française, facture électronique) fera l'objet d'un ADR.

### EPIC 14 — Production & Scale
TASK-116 CI/CD (**avancée en P0**) · TASK-117 monitoring · TASK-118 logs · TASK-119 sauvegardes ·
TASK-120 tests de sécurité · TASK-121 tests de charge (P3) · TASK-122 déploiement production ·
TASK-123 validation de mise en production.
