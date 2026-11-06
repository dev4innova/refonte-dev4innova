# ADR-0006 — Multi-tenancy par organisation

- **Statut** : Proposé
- **Date** : 2026-11-06
- **Tâches liées** : TASK-041, TASK-042, TASK-043, TASK-045

## Contexte
Les clients (portail, diagnostic, IA, academy, facturation) sont des organisations dont
les données doivent être strictement isolées. DEV4INNOVA elle-même est une organisation
(administration, CRM interne).

## Décision
- **Base partagée, schéma partagé**, colonne `organization_id` sur toute table tenant-scoped.
- `users` ↔ `organizations` via `memberships` (un utilisateur peut appartenir à plusieurs
  organisations) portant le **rôle** dans cette organisation.
- Rôles initiaux : `owner`, `admin`, `member` (côté client) ; rôles internes DEV4INNOVA
  `staff_admin`, `staff_editor`, `staff_sales`. Permissions fines dérivées des rôles (TASK-043).
- Le contexte d'organisation est résolu par requête (en-tête ou segment de route + vérification
  du membership) et **obligatoire** dans les repositories tenant-scoped.
- Défense en profondeur envisagée : **Row-Level Security PostgreSQL** à évaluer en TASK-045.

## Alternatives considérées
- Une base ou un schéma par client : isolation forte mais migrations et opérations coûteuses.

## Conséquences
Chaque fonctionnalité doit inclure des tests d'isolation inter-organisations.
