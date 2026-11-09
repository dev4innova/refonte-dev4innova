# Règles database (PostgreSQL, SQLAlchemy, Alembic)

## Conventions de nommage
- Tables : `snake_case`, au pluriel (`organizations`, `crm_leads`). Préfixe de domaine
  pour les modules métier (`cms_`, `crm_`, `ai_`, `academy_`, `billing_`, `portal_`).
- Colonnes : `snake_case`. Clés étrangères : `<entité>_id`. Booléens : `is_*` / `has_*`.
- Contraintes nommées via la `naming_convention` de SQLAlchemy (`pk_`, `fk_`, `uq_`, `ix_`, `ck_`)
  pour des migrations Alembic déterministes.

## Colonnes standard
Toute table métier contient :
- `id` : UUID (générés côté application, UUIDv7 de préférence) — pas d'ID séquentiel exposé.
- `created_at`, `updated_at` : `timestamptz`, en UTC, non nulles.
- `organization_id` : UUID non nul + FK + index, pour toute donnée tenant-scoped.
- Suppression logique (`deleted_at`) uniquement quand le besoin métier est justifié
  (contenus CMS, factures : jamais de suppression physique).

## Types
- Dates : toujours `timestamptz`. Montants : `numeric(12,2)` + colonne `currency` (ISO 4217),
  jamais de `float`. Énumérations : `text` + contrainte `CHECK` ou enum Postgres, documentées.
- `jsonb` uniquement pour des données réellement semi-structurées (métadonnées, réponses IA),
  pas pour éviter de modéliser.
- Contenus traduisibles : table de traductions dédiée (`<entité>_translations` avec
  `locale`, unique sur `(entity_id, locale)`), voir ADR-0008.

## Migrations
- Toute modification de schéma = une migration Alembic (`alembic revision --autogenerate`),
  **relue manuellement** avant commit (l'autogénération rate renommages et contraintes).
- Une migration = un changement cohérent, avec `upgrade()` **et** `downgrade()` fonctionnels.
- Migrations non destructives en production : ajout de colonne nullable → backfill → contrainte.
  Pas de renommage/suppression de colonne dans le même déploiement que le code qui l'utilise.
- **Compatibles avec la version précédente** : en production, les migrations s'appliquent avant
  le déploiement et l'ancienne version de l'API tourne encore environ 30 s (ADR-0018). Une
  colonne ou une table se supprime ou se renomme donc en deux déploiements : le code cesse
  d'abord de l'utiliser, puis une migration suivante la supprime.
- Ne jamais modifier une migration déjà fusionnée sur `main` : en créer une nouvelle.
- Les données de référence (rôles, permissions) sont semées par migration ou script idempotent.

## Requêtes et performance
- Index sur toutes les FK et sur les colonnes de filtre/tri fréquentes. Index composites
  commençant par `organization_id` pour les tables tenant-scoped.
- Pas de N+1 : `selectinload`/`joinedload` explicites. Pas de `SELECT *` implicite sur de gros volumes.
- Requêtes SQL brutes uniquement via `text()` avec paramètres liés — jamais de concaténation.
- Transactions courtes ; pas d'appel réseau externe (IA, paiement) à l'intérieur d'une transaction.

## Redis
- Clés préfixées et namespacées : `d4i:<env>:<domaine>:<id>`. TTL obligatoire sur les clés de cache.
- Redis n'est jamais la source de vérité : toute donnée doit pouvoir être reconstruite depuis PostgreSQL.
