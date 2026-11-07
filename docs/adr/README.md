# Architecture Decision Records

Chaque décision d'architecture significative est consignée dans un ADR numéroté
(format [MADR](https://adr.github.io/madr/) simplifié, modèle : `template.md`).

Statuts : **Proposé** → **Accepté** (validé par le responsable du projet) → éventuellement
**Remplacé par ADR-XXXX** / **Déprécié**. Un ADR accepté n'est jamais réécrit : on en crée un nouveau.

| N° | Titre | Statut |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Consigner les décisions d'architecture | Accepté |
| [0002](0002-monorepo-and-modular-monolith.md) | Monorepo et monolithe modulaire | Proposé |
| [0003](0003-frontend-stack.md) | Stack frontend : Next.js, Tailwind, shadcn/ui | Proposé |
| [0004](0004-backend-stack-and-api-contract.md) | Stack backend FastAPI et contrat OpenAPI | Proposé |
| [0005](0005-postgresql-and-redis.md) | PostgreSQL et Redis | Proposé |
| [0006](0006-multi-tenancy.md) | Multi-tenancy par organisation | Proposé |
| [0007](0007-ai-gateway.md) | AI Gateway multi-fournisseurs | Proposé |
| [0008](0008-internationalization.md) | Internationalisation FR/EN | Proposé |
| [0009](0009-identity-provider.md) | Fournisseur d'identité : Zitadel Cloud | Accepté |
| [0010](0010-cms-and-media-storage.md) | CMS intégré, Markdown et stockage objet des médias | Proposé |
