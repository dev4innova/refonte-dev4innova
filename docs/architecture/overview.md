# Architecture — vue d'ensemble

> Statut : **proposée, à valider** par le responsable du projet (Definition of Done EPIC 00).

## Contexte

```
                ┌──────────────────────────────────────────────┐
 Visiteurs ───▶ │  apps/web — Next.js (SSR/RSC, next-intl FR/EN)│
 Clients   ───▶ │  site corporate · portail · admin · academy   │
 Équipe    ───▶ └──────────────┬───────────────────────────────┘
                               │ HTTPS / JSON (client TS généré depuis OpenAPI)
                ┌──────────────▼───────────────────────────────┐
                │  apps/api — FastAPI  /api/v1                  │
                │  identity · cms · crm · ai_gateway · ai_xp    │
                │  diagnostic · portal · academy · billing      │
                └───┬──────────────┬──────────────┬────────────┘
                    │              │              │
             ┌──────▼─────┐  ┌─────▼────┐  ┌──────▼──────────────────────┐
             │ PostgreSQL │  │  Redis   │  │ Services externes            │
             │ (vérité)   │  │ cache,   │  │ IdP · Anthropic · OpenAI ·   │
             │            │  │ quotas,  │  │ Gemini · paiement · email ·  │
             │            │  │ files    │  │ stockage objet               │
             └────────────┘  └──────────┘  └─────────────────────────────┘
```

## Principes

1. **Monolithe modulaire** côté backend : un seul service FastAPI découpé en modules par
   domaine, aux frontières strictes. Extraction en services séparés seulement si un besoin
   mesuré l'exige (ADR-0002).
2. **Contrat d'API explicite** : l'OpenAPI de FastAPI génère le client TypeScript (ADR-0004).
3. **Multi-tenant par organisation** dès la fondation (ADR-0006).
4. **IA derrière une passerelle** : le métier ne connaît qu'une interface fournisseur
   unique ; fournisseurs, modèles, prompts, coûts et quotas sont gérés par l'AI Gateway (ADR-0007).
5. **Bilingue natif** : routes `/fr/...` et `/en/...`, contenus CMS traduits (ADR-0008).
6. **Sécurité par défaut** : voir `docs/rules/security.md`.

## Modules backend et epics

| Module | Epic | Dépend de |
|---|---|---|
| `core`, `db`, `health` | 01 | — |
| `identity` (users, organizations, memberships, rôles) | 04 | 01 |
| `cms` (documents traduits, médias S3, rendu Markdown ; ADR-0010) | 06 | 04 |
| `crm` (prospects, opportunités, activités, demandes de devis ; ADR-0011) | 07 | 04 |
| `ai_gateway` (contrat fournisseur, adaptateurs Anthropic / OpenAI / Gemini, registre, prompts versionnés, usage, budgets ; ADR-0007, ADR-0012) | 08 | 04 (quotas par organisation) |
| `ai_experiences` (assistant, analyse de documents, générateur de contenus, sessions privées ; ADR-0013) | 09 | 08 |
| `diagnostic` (questionnaire versionné, scoring, recommandations, analyse IA, PDF, lien CRM ; ADR-0014) | 10 | 07, 08 |
| `diagnostic` | 10 | 08, 07 |
| `portal` (projets, tâches, livrables, documents privés, support, notifications ; ADR-0015) | 11 | 04 |
| `academy` (formations, modules, leçons, quiz, inscriptions, progression, certificats ; ADR-0016) | 12 | 04, 06 |
| `billing` (catalogue, devis, factures et avoirs, paiements Stripe, abonnements, transactions ; ADR-0017) | 13 | 04, 07, 12 |

## Environnements

| Environnement | Usage | Données |
|---|---|---|
| `local` | Docker Compose | jeux de données factices |
| `staging` | recette, déployé depuis `main` | anonymisées |
| `production` | public | réelles |

Le choix de l'hébergeur (frontend, API, PostgreSQL managé) est à acter par ADR avant TASK-122.
