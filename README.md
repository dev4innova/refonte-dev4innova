# DEV4INNOVA — Plateforme

Monorepo de la refonte de la plateforme DEV4INNOVA : site corporate, CMS, CRM, AI Gateway,
expériences IA, diagnostic IA, portail client, Academy et facturation.

## Structure

```
.
├── apps/
│   ├── web/            # Frontend Next.js (TypeScript, App Router)      — EPIC 01
│   └── api/            # Backend FastAPI (Python)                       — EPIC 01
├── packages/
│   └── api-client/     # Client TypeScript généré depuis l'OpenAPI de l'API
├── infra/
│   └── docker/         # Dockerfiles, configuration Docker Compose      — EPIC 01
├── docs/
│   ├── architecture/   # Vue d'ensemble de l'architecture
│   ├── adr/            # Architecture Decision Records
│   ├── rules/          # Règles frontend, backend, database, sécurité, commits
│   └── backlog.md      # Backlog d'ingénierie priorisé
├── CLAUDE.md           # Instructions pour les agents IA travaillant dans le repo
└── CONTRIBUTING.md     # Workflow de contribution
```

## Documentation

| Sujet | Document |
|---|---|
| Architecture | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Décisions (ADR) | [docs/adr/](docs/adr/README.md) |
| Règles frontend | [docs/rules/frontend.md](docs/rules/frontend.md) |
| Règles backend | [docs/rules/backend.md](docs/rules/backend.md) |
| Règles database | [docs/rules/database.md](docs/rules/database.md) |
| Règles sécurité | [docs/rules/security.md](docs/rules/security.md) |
| Conventions de commits | [docs/rules/commits.md](docs/rules/commits.md) |
| Backlog | [docs/backlog.md](docs/backlog.md) |

## État

EPIC 00 (gouvernance) livré. Les applications `apps/web` et `apps/api` sont initialisées dans l'EPIC 01.
