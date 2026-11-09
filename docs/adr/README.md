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
| [0011](0011-crm.md) | CRM intégré : prospects, opportunités et demandes de devis | Proposé |
| [0012](0012-ai-gateway-implementation.md) | AI Gateway : budgets en euros, prompts versionnés, exposition interne | Proposé |
| [0013](0013-ai-experiences.md) | Expériences IA : sessions privées, documents non conservés, limites d'usage | Proposé |
| [0014](0014-ai-diagnostic.md) | Diagnostic IA public : rapport contre e-mail, questionnaire versionné dans le code | Proposé |
| [0015](0015-client-portal.md) | Portail client : projets pilotés par l'équipe, fichiers privés, notifications dans l'application | Proposé |
| [0016](0016-academy.md) | Academy : formations rédigées dans le back-office, quiz corrigés par le serveur, certificats vérifiables | Proposé |
| [0017](0017-billing.md) | Commerce et facturation : Stripe Checkout, factures émises par la plateforme | Proposé |
| [0018](0018-production-on-railway.md) | Production sur Railway : déploiement continu, Sentry, sauvegardes hors Railway | Proposé |
