# ADR-0002 — Monorepo et monolithe modulaire

- **Statut** : Proposé
- **Date** : 2026-11-06
- **Tâches liées** : TASK-002

## Contexte
Un frontend TypeScript et un backend Python doivent évoluer ensemble (contrat d'API,
déploiements coordonnés). L'équipe est réduite.

## Décision
- Un seul dépôt : `apps/web` (Next.js), `apps/api` (FastAPI), `packages/*` (code TS partagé),
  `infra/`, `docs/`.
- Outillage JS : **pnpm workspaces** ; Turborepo pourra être ajouté si les temps de build
  le justifient. Outillage Python : **uv**, `apps/api` reste un projet Python autonome.
- Backend en **monolithe modulaire** : un service, des modules par domaine (`app/modules/<domain>`)
  qui ne communiquent que par leurs services publics.

## Alternatives considérées
- Dépôts séparés : contrat d'API et versions plus difficiles à synchroniser.
- Microservices dès le départ : complexité opérationnelle injustifiée pour la V1.

## Conséquences
Un seul endroit pour les PR transverses et la CI. Discipline requise sur les frontières
de modules (règle d'import dans `docs/rules/backend.md`).
