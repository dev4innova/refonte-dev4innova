# Contribuer

1. Partir de `main` à jour : `git switch -c feat/TASK-XXX-description`.
2. Lire `CLAUDE.md` et la règle de `docs/rules/` correspondant à la zone modifiée.
3. Développer avec les tests ; lint, typecheck et tests doivent passer localement.
4. Commits au format Conventional Commits (`docs/rules/commits.md`), avec `Refs: TASK-XXX`.
5. Ouvrir une Pull Request vers `main` en remplissant le modèle ; au moins une relecture.
6. Squash merge une fois la CI verte.

## Intégration continue

`.github/workflows/ci.yml` s'exécute sur chaque Pull Request et sur `main` :

| Job | Vérifie |
|---|---|
| Commit conventions | titre de la PR et commits conformes à `docs/rules/commits.md` |
| Web | ESLint, typecheck (tous les paquets), Vitest, `next build` |
| Web E2E | Playwright à 375, 768 et 1280 px : responsive, accessibilité (axe), navigation FR/EN ; captures en artefact |
| API | Ruff (lint + format), mypy strict, pytest sur PostgreSQL 17 et Redis 7 |
| API client up to date | `packages/api-client` correspond à l'OpenAPI actuelle (sinon : `make client`) |
| Docker images build | les images `api` et `web` se construisent |

Dependabot (`.github/dependabot.yml`) propose chaque semaine les mises à jour npm, Python,
GitHub Actions et Docker.

**À configurer par le responsable du dépôt** (Settings → Branches → règle sur `main`) :
exiger une PR, exiger les 6 jobs ci-dessus comme *status checks*, interdire le push direct.

Toute décision d'architecture nouvelle s'accompagne d'un ADR (`docs/adr/template.md`).
