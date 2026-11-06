# CLAUDE.md — Instructions pour les agents IA

Ce fichier s'applique à tout agent (Claude Code ou autre) travaillant dans ce dépôt.
Il est court par design : les détails sont dans `docs/`. **Lisez la règle correspondant
à la zone que vous modifiez avant d'écrire du code.**

## Projet

DEV4INNOVA — plateforme multi-tenant : site corporate bilingue (FR/EN), CMS, CRM, AI Gateway
multi-fournisseurs, expériences IA, diagnostic IA, portail client, Academy, facturation.
Backlog et priorités : `docs/backlog.md`. Architecture : `docs/architecture/overview.md`.

## Stack (voir `docs/adr/`)

- **Frontend** `apps/web` : Next.js (App Router) + TypeScript strict, Tailwind CSS, shadcn/ui, next-intl.
- **Backend** `apps/api` : FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic. Python géré avec `uv`.
- **Données** : PostgreSQL (source de vérité), Redis (cache, rate limiting, files).
- **Monorepo** : pnpm workspaces pour le JS ; `apps/api` est un projet Python autonome.
- **Local** : Docker Compose (`infra/docker`).

## Règles à lire selon la zone modifiée

| Vous touchez… | Lisez |
|---|---|
| `apps/web/**`, `packages/**` | `docs/rules/frontend.md` |
| `apps/api/**` | `docs/rules/backend.md` |
| modèles, migrations, requêtes SQL | `docs/rules/database.md` |
| auth, données personnelles, secrets, IA, paiements, uploads | `docs/rules/security.md` |
| tout commit / PR | `docs/rules/commits.md` |

## Règles non négociables

1. **Isolation des organisations** : toute donnée métier appartient à une `organization_id`
   et toute requête est filtrée par l'organisation du contexte courant. Jamais de requête
   tenant-scoped sans ce filtre (ADR-0006).
2. **Aucun secret dans le code, les logs ou le frontend.** Les clés fournisseurs IA et de
   paiement n'existent que côté backend (ADR-0007).
3. **Toute modification de schéma passe par une migration Alembic** relue. Jamais de
   `create_all()` hors tests.
4. **Tous les textes visibles passent par next-intl** (FR et EN), jamais en dur dans les composants.
5. **Respecter les dépendances du backlog** : ne pas implémenter une fonctionnalité dont la
   fondation n'existe pas encore. Si c'est nécessaire, le signaler plutôt que de bricoler.
6. **Une décision d'architecture nouvelle = un ADR** dans `docs/adr/` (statut « Proposé »
   tant qu'elle n'est pas validée par le responsable du projet).
7. **Les tests accompagnent le code** : pas de fonctionnalité backend sans tests pytest,
   pas de logique frontend non triviale sans test.

## Workflow

- Branches : `feat/TASK-XXX-description`, `fix/...`, `docs/...` (voir `CONTRIBUTING.md`).
- Commits : Conventional Commits avec référence de tâche (`docs/rules/commits.md`).
- Avant de pousser : lint + typecheck + tests de la zone modifiée doivent passer.
- Ne pas modifier le code généré (`packages/api-client/src/generated`) à la main.

## Commandes

Tout passe par le `Makefile` racine (`make help`) :

| Commande | Effet |
|---|---|
| `make setup` | installe les dépendances JS (pnpm) et Python (uv), crée les `.env` locaux |
| `make up` / `make down` | stack Docker complète (web :3000, api :8000, PostgreSQL, Redis) |
| `make services` | PostgreSQL + Redis seuls, pour développer en local avec rechargement |
| `make api-dev` / `make web-dev` | API (uvicorn --reload) / web (next dev) |
| `make migration name="..."` / `make migrate` | créer / appliquer une migration Alembic |
| `make client` | régénérer `packages/api-client` après un changement d'API |
| `make check` | lint + typecheck + tests (à lancer avant de pousser ; nécessite `make services`) |

Health checks : `GET /api/v1/health/live`, `GET /api/v1/health/ready` (API) et `GET /api/health` (web).

## Next.js 16

`apps/web` utilise Next.js 16 (Cache Components activé), dont les API diffèrent des versions
précédentes : lire `apps/web/AGENTS.md` et la doc embarquée `node_modules/next/dist/docs/`
avant d'écrire du code frontend.

## Langue

Documentation et messages aux utilisateurs : français. Code, identifiants, noms de tables,
messages de commit : anglais.
