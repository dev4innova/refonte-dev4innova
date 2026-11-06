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
| Design system | [docs/design-system.md](docs/design-system.md) |
| Règles backend | [docs/rules/backend.md](docs/rules/backend.md) |
| Règles database | [docs/rules/database.md](docs/rules/database.md) |
| Règles sécurité | [docs/rules/security.md](docs/rules/security.md) |
| Conventions de commits | [docs/rules/commits.md](docs/rules/commits.md) |
| Variables d'environnement | [docs/architecture/environment-variables.md](docs/architecture/environment-variables.md) |
| Backlog | [docs/backlog.md](docs/backlog.md) |

## Démarrage rapide

Prérequis : Node.js 22+, pnpm 10, Python 3.12+, [uv](https://docs.astral.sh/uv/), Docker.

```bash
make setup      # dépendances + fichiers .env locaux
make up         # stack complète dans Docker
```

- Site : http://localhost:3000 — santé : http://localhost:3000/api/health
- API : http://localhost:8000/docs — santé : http://localhost:8000/api/v1/health/ready

Développement avec rechargement à chaud :

```bash
make services   # PostgreSQL + Redis dans Docker
make api-dev    # terminal 1
make web-dev    # terminal 2
```

`make help` liste toutes les commandes. Variables d'environnement :
[docs/architecture/environment-variables.md](docs/architecture/environment-variables.md).

## État

- EPIC 00 (gouvernance) : livré.
- EPIC 01 (infrastructure) : livré.
- EPIC 02 (design system) : livré — voir [docs/design-system.md](docs/design-system.md) et la page `/design-system`.
- TASK-116 (intégration continue) : livrée — voir [CONTRIBUTING.md](CONTRIBUTING.md#intégration-continue).
