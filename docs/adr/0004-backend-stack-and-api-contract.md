# ADR-0004 — Stack backend FastAPI et contrat OpenAPI

- **Statut** : Proposé
- **Date** : 2026-11-06
- **Tâches liées** : TASK-011, TASK-016, TASK-017, TASK-018

## Contexte
Le backend porte la logique métier et l'intégration IA, écosystème où Python est le plus riche.

## Décision
- **FastAPI**, **Pydantic v2**, **SQLAlchemy 2 async** (driver `asyncpg`), **Alembic**.
- Gestion des dépendances avec **uv** ; Ruff (lint/format), mypy strict, pytest.
- API versionnée sous `/api/v1`. L'OpenAPI générée par FastAPI est **le contrat** :
  un client TypeScript typé est généré dans `packages/api-client` (outil : `openapi-typescript`
  + `openapi-fetch`), régénéré à chaque changement d'API et vérifié en CI.
- Tâches asynchrones (IA longue, PDF, emails) via une file adossée à Redis
  (choix précis de la bibliothèque à acter lors du premier besoin, EPIC 08/10).

## Alternatives considérées
- Django + DRF : plus de conventions intégrées mais async et typage moins naturels.
- Backend Node (Route Handlers Next.js) : écosystème IA/data Python moins accessible.

## Conséquences
Deux langages à maintenir ; le contrat généré évite la dérive entre frontend et backend.
