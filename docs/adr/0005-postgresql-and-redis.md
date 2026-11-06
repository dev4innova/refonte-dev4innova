# ADR-0005 — PostgreSQL et Redis

- **Statut** : Proposé
- **Date** : 2026-11-06
- **Tâches liées** : TASK-012, TASK-013

## Décision
- **PostgreSQL 17** : source de vérité unique (relationnel, `jsonb`, recherche plein texte,
  extension `pgvector` disponible si un besoin de recherche sémantique apparaît en EPIC 09).
- **Redis 7** : cache, rate limiting, quotas IA, sessions de streaming, file de tâches.
  Jamais source de vérité.
- En local : conteneurs Docker Compose. En production : services managés (choix de
  l'hébergeur par un ADR ultérieur).

## Conséquences
Sauvegardes et PITR à prévoir sur PostgreSQL uniquement (TASK-119).
