# DEV4INNOVA — Engineering Backlog V1

> Priorités et dépendances **proposées** — à valider par le responsable du projet.

## Règle de priorisation
- **P0** : fondations indispensables.
- **P1** : fonctionnalités nécessaires à la première version commerciale.
- **P2** : fonctionnalités d'expansion.
- **P3** : optimisations et fonctionnalités avancées.

Une fonctionnalité ne peut pas être développée avant les fondations dont elle dépend.

## Vue d'ensemble

| Epic | Titre | Priorité | Dépend de | État |
|---|---|---|---|---|
| 00 | Project Governance | P0 | — | ✅ livré (validation de l'architecture en attente) |
| 01 | Infrastructure Foundation | P0 | 00 | ✅ livré |
| 02 | Design System | P0 | 01 | ✅ livré |
| 03 | Internationalization | P0 | 01 (02 pour le sélecteur) | ✅ livré |
| 04 | Identity & Access | P0 | 01, décision ADR-0009 | ✅ livré |
| 05 | Corporate Website | P1 | 02, 03 (06 pour le contenu dynamique) | ✅ livré (contenus à valider) |
| 06 | CMS & Administration | P1 | 04 | à faire |
| 07 | CRM & Leads | P1 | 04 | à faire |
| 14a | CI/CD minimal (TASK-116) | **P0** — avancé | 01 | ✅ CI livrée (CD avec TASK-122) |
| 08 | AI Gateway | P1 | 04 | à faire |
| 10 | AI Business Diagnostic | P1 | 08, 07 | à faire |
| 09 | AI Experiences | P2 | 08 | à faire |
| 11 | Client Portal | P2 | 04 (07, 13 pour les liens) | à faire |
| 12 | Academy | P2 | 04, 06 | à faire |
| 13 | Commerce & Billing | P2 | 04, 07 | à faire |
| 14 | Production & Scale (reste) | P1 avant mise en ligne, P3 pour la charge | tout ce qui est déployé | à faire |

### Ajustements recommandés
1. **TASK-116 (CI/CD) avancée juste après l'EPIC 01** : lint, typecheck, tests et commitlint
   dès le premier code applicatif, plutôt qu'en fin de projet.
2. **TASK-038 (choix de l'IdP) à trancher pendant l'EPIC 01**, pour ne pas bloquer l'EPIC 04 (voir ADR-0009).
3. **TASK-057 (formulaires du site) dépend de TASK-067/TASK-072** (CRM) pour stocker les
   leads : prévoir un stockage minimal ou séquencer 07 avant la fin de 05.
4. **TASK-056 (SEO)** : socle (metadata, sitemap, hreflang) dès les premières pages de 05.
5. **Sauvegardes (TASK-119) et monitoring/logs (TASK-117/118)** obligatoires avant toute
   donnée client réelle en production.

## Détail des epics

### EPIC 00 — Project Governance (P0)
| Tâche | Livrable | État |
|---|---|---|
| TASK-001 | Dépôt git créé (par le responsable) | ✅ |
| TASK-002 | Structure monorepo (`apps/`, `packages/`, `infra/`, `docs/`) | ✅ |
| TASK-003 | `CLAUDE.md` | ✅ |
| TASK-004 | `docs/rules/frontend.md` | ✅ |
| TASK-005 | `docs/rules/backend.md` | ✅ |
| TASK-006 | `docs/rules/database.md` | ✅ |
| TASK-007 | `docs/rules/security.md` | ✅ |
| TASK-008 | `docs/rules/commits.md`, `commitlint.config.mjs` | ✅ |
| TASK-009 | `docs/adr/` (ADR-0001 à 0009), `docs/architecture/overview.md` | ✅ |

**DoD** : documentation accessible ✅ · architecture validée ⏳ (revue des ADR « Proposé ») ·
règles de développement configurées ✅ · git initialisé ✅.

### EPIC 01 — Infrastructure Foundation (P0)
TASK-010 Next.js + TS · TASK-011 FastAPI · TASK-012 PostgreSQL · TASK-013 Redis ·
TASK-014 Docker Compose · TASK-015 variables d'environnement · TASK-016 FastAPI ↔ PostgreSQL ·
TASK-017 SQLAlchemy · TASK-018 Alembic · TASK-019 health checks.
Ordre : 010, 011 → 012, 013 → 015 → 017 → 016 → 018 → 014 → 019.

| Tâche | Livrable | État |
|---|---|---|
| TASK-010 | `apps/web` : Next.js 16, TypeScript strict, ESLint, Vitest, sortie `standalone` | ✅ |
| TASK-011 | `apps/api` : FastAPI, config, erreurs au format unique, logs JSON, Ruff, mypy strict, pytest | ✅ |
| TASK-012 | PostgreSQL 17 (Compose) + base de test `dev4innova_test` | ✅ |
| TASK-013 | Redis 7 (Compose, AOF) + client async `app/core/redis.py` | ✅ |
| TASK-014 | `infra/docker/compose.yaml`, `api.Dockerfile`, `web.Dockerfile`, `Makefile` | ✅ |
| TASK-015 | `.env.example` par application, `docs/architecture/environment-variables.md` | ✅ |
| TASK-016 | moteur async SQLAlchemy/asyncpg, dépendance `get_session` | ✅ |
| TASK-017 | `Base` déclarative, convention de nommage, mixins UUID / timestamps | ✅ |
| TASK-018 | Alembic async, migration `0001` baseline, service `migrate` en Compose, test upgrade/downgrade/drift | ✅ |
| TASK-019 | `/api/v1/health/live`, `/api/v1/health/ready` (PostgreSQL + Redis, 503 si KO), `/api/health` (web → API), healthchecks Docker | ✅ |

En plus : `packages/api-client` généré depuis l'OpenAPI (`make client`), utilisé par le web pour appeler l'API.

**DoD** : tous les services démarrent ✅ · frontend ↔ backend ✅ · backend ↔ PostgreSQL ✅ ·
migrations fonctionnelles ✅ · health checks OK ✅.

### EPIC 02 — Design System (P0)
TASK-020 Tailwind · TASK-021 shadcn/ui · TASK-022 couleurs · TASK-023 typographies ·
TASK-024 espacements · TASK-025 boutons · TASK-026 cartes · TASK-027 formulaires ·
TASK-028 navigation · TASK-029 footer · TASK-030 animations · TASK-031 responsive.
Ordre : 020 → 021 → 022-024 (tokens) → 025-029 → 030 → 031.

| Tâche | Livrable | État |
|---|---|---|
| TASK-020 | Tailwind CSS v4 (PostCSS), `globals.css` | ✅ |
| TASK-021 | shadcn/ui : `components.json`, `cn()`, primitives Radix (`radix-ui`) | ✅ |
| TASK-022 | `src/styles/tokens.css` : palette rouge/noir, tokens sémantiques, surfaces inverse, test des contrastes | ✅ |
| TASK-023 | Space Grotesk + Inter (`next/font`), échelle typographique fluide | ✅ |
| TASK-024 | Gouttières, sections, largeur max, hauteur d'en-tête, rayons, ombres | ✅ |
| TASK-025 | `Button` (6 variantes, 4 tailles, `asChild`, `loading`) | ✅ |
| TASK-026 | `Card` (default, elevated, inverse, interactive) | ✅ |
| TASK-027 | `Input`, `Textarea`, `Label`, `Checkbox`, `FormField` | ✅ |
| TASK-028 | `Logo`, `SiteHeader`, `NavLinks`, `MobileNav` (Sheet), `Container`, `Section`, lien d'évitement | ✅ |
| TASK-029 | `SiteFooter` sombre | ✅ |
| TASK-030 | Tokens de mouvement, `animate-fade-in` / `slide-up`, `prefers-reduced-motion` | ✅ |
| TASK-031 | Playwright 375/768/1280 px + axe WCAG 2.1 AA, job CI `Web E2E` | ✅ |

Documentation : `docs/design-system.md`. Vitrine : `/design-system`.

**DoD** : tokens centralisés ✅ · composants réutilisables ✅ · responsive vérifié ✅ · accessibilité ✅.

### EPIC 03 — Internationalization (P0)
TASK-032 next-intl · TASK-033 dictionnaires FR · TASK-034 dictionnaires EN ·
TASK-035 routes localisées · TASK-036 sélecteur de langue (après TASK-028) ·
TASK-037 tests de navigation multilingue.

| Tâche | Livrable | État |
|---|---|---|
| TASK-032 | next-intl : `src/i18n/` (routing, navigation, request), plugin Next, `proxy.ts` (Next 16) | ✅ |
| TASK-033 | `messages/fr.json` (migration de l'ancien `src/content`) | ✅ |
| TASK-034 | `messages/en.json` ; test de parité des clés, valeurs vides et variables ICU ; clés typées | ✅ |
| TASK-035 | `app/[locale]`, préfixe systématique, slugs traduits (`/fr/a-propos` ↔ `/en/about`), détection cookie puis `Accept-Language`, `hreflang` + canonique, 404 localisée | ✅ |
| TASK-036 | `LocaleSwitcher` dans l'en-tête : même page, `aria-current`, `lang`/`hreflang` | ✅ |
| TASK-037 | `e2e/i18n.spec.ts` : détection, repli FR, préfixes, slugs, `hreflang`, changement de langue mémorisé, clavier, 404 FR/EN | ✅ |

**DoD** : navigation FR/EN complète ✅ · aucun texte en dur ✅ · tests multilingues ✅.

### EPIC 04 — Identity & Access (P0)
TASK-038 choix de l'IdP (ADR-0009) → TASK-039 authentification → TASK-040 profils →
TASK-041 organisations → TASK-042 memberships → TASK-043 rôles et permissions →
TASK-044 routes privées → TASK-045 tests d'isolation.

| Tâche | Livrable | État |
|---|---|---|
| TASK-038 | Zitadel Cloud (ADR-0009 accepté), procédure `docs/architecture/authentication.md` | ✅ |
| TASK-039 | Web : OIDC + PKCE, session chiffrée `HttpOnly` ; API : vérification JWT (JWKS, `iss`, `aud`, `exp`) | ✅ |
| TASK-040 | `users`, création à la première connexion, `GET`/`PATCH /api/v1/me` | ✅ |
| TASK-041 | `organizations`, création (créateur `owner`), lecture, renommage | ✅ |
| TASK-042 | `memberships` : ajout par e-mail, changement de rôle, retrait, départ | ✅ |
| TASK-043 | Rôles `owner`/`admin`/`member`/`staff_*` → permissions ; règles d'attribution ; au moins un `owner` | ✅ |
| TASK-044 | Proxy + vérification par page ; espace client `/fr/espace-client`, `/en/account` | ✅ |
| TASK-045 | `tests/test_isolation.py` : 404 sur chaque endpoint pour un non-membre, aucune fuite | ✅ |

**Suite prévue** : invitations par e-mail (avec les e-mails transactionnels), rafraîchissement
des jetons, création de l'organisation interne DEV4INNOVA et des comptes `staff_*` (EPIC 06).


### EPIC 05 — Corporate Website (P1)
TASK-046 navbar (après TASK-028) · TASK-047 homepage · TASK-048 About · TASK-049 Solutions ·
TASK-050 Services · TASK-051 Portfolio · TASK-052 Innovation Lab · TASK-053 Academy ·
TASK-054 Insights · TASK-055 Contact · TASK-056 SEO · TASK-057 formulaires (après TASK-067).

| Tâche | Livrable | État |
|---|---|---|
| TASK-046 | Navbar (EPIC 02) : `aria-current` aussi sur les pages de détail | ✅ |
| TASK-047 | Accueil : hero, piliers, solutions, services, démarche, Lab, Academy, appel à l'action, JSON-LD | ✅ |
| TASK-048 | À propos : mission, démarche, valeurs | ✅ |
| TASK-049 | Solutions : index + 5 fiches (`/solutions/[slug]`) | ✅ |
| TASK-050 | Services : index + 5 fiches (`/services/[slug]`) | ✅ |
| TASK-051 | Portfolio : page et état vide (études de cas via le CMS, EPIC 06) | ✅ |
| TASK-052 | Innovation Lab : thèmes explorés, programme de prototypage | ✅ |
| TASK-053 | Academy (présentation) : thèmes, formats ; catalogue en EPIC 12 | ✅ |
| TASK-054 | Insights : page et état vide (articles via le CMS, EPIC 06) | ✅ |
| TASK-055 | Contact : formulaire + étapes | ✅ |
| TASK-056 | Métadonnées par page, canonique, `hreflang`, Open Graph, `sitemap.xml`, `robots.txt` | ✅ |
| TASK-057 | Server action + `POST /api/v1/contact-requests` (consentement, honeypot, limites Redis) ; table `contact_requests` reprise par le CRM (EPIC 07) | ✅ |

**Avant la mise en ligne** : relire et valider les textes (`messages/{fr,en}.json`), rédiger les
mentions légales et la politique de confidentialité (pages en attente, non indexées), définir
la durée de conservation des demandes de contact et l'alerte e-mail à l'équipe (voir EPIC 07).

### EPIC 06 — CMS & Administration (P1)
TASK-058 modèles CMS → TASK-059 traductions → TASK-060 interface admin → TASK-061 pages ·
TASK-062 articles · TASK-063 services · TASK-064 projets · TASK-065 médias · TASK-066 SEO.

| Tâche | Livrable | État |
|---|---|---|
| TASK-058 | Tables `cms_documents`, `cms_document_translations`, `cms_media` (migration 0004), organisation interne DEV4INNOVA, rôles `staff_*` | ✅ |
| TASK-059 | Traductions FR/EN par document (slug par langue, langue requise à la publication), bascule de langue vers le slug traduit | ✅ |
| TASK-060 | Back-office `/admin` : tableau de bord, listes, éditeur Markdown + aperçu, publication ; `make grant-staff` | ✅ |
| TASK-061 | Pages libres : mentions légales et confidentialité servies par le CMS (en attente et non indexées tant qu'elles ne sont pas publiées) | ✅ |
| TASK-062 | Articles : `/insights` et `/insights/[slug]` | ✅ |
| TASK-063 | Services : 5 services repris dans le CMS (migration), accueil et `/services` | ✅ |
| TASK-064 | Projets : `/portfolio` et `/portfolio/[slug]` (secteur, client) | ✅ |
| TASK-065 | Médiathèque : envoi d'images ré-encodées vers S3 (MinIO en local), textes alternatifs FR/EN, couvertures | ✅ |
| TASK-066 | SEO par langue (titre, description), canonique et `hreflang` des slugs traduits, `sitemap.xml` dynamique | ✅ |

**À prévoir** : choisir le stockage objet de production (EPIC 13), publier les mentions
légales et la politique de confidentialité, donner le rôle `staff_editor` aux rédacteurs.

### EPIC 07 — CRM & Leads (P1)
TASK-067 prospects → TASK-068 activités · TASK-069 pipeline · TASK-070 attribution ·
TASK-071 tableau de bord · TASK-072 demandes de devis.

| Tâche | Livrable | État |
|---|---|---|
| TASK-067 | Prospects (`crm_leads`, un par e-mail) créés ou complétés par les formulaires de contact et de devis, saisie manuelle, recherche et filtres ; reprise des messages existants (migration 0005) | ✅ |
| TASK-068 | Historique : notes, appels, e-mails, rendez-vous, et événements automatiques (messages, devis, statut, étape, attribution) | ✅ |
| TASK-069 | Opportunités (qualification → proposition → négociation → gagnée / perdue), montant en EUR, pipeline par étape | ✅ |
| TASK-070 | Attribution d'un prospect ou d'une opportunité à un commercial (`staff_sales`, `staff_admin`) | ✅ |
| TASK-071 | Tableau de bord : nouveaux prospects, non attribués, pipeline ouvert, gagné et taux de transformation sur 90 jours ; compteur des nouveautés sur l'onglet CRM | ✅ |
| TASK-072 | Page publique `/devis` · `/quote` (service, besoin, budget, délai) → prospect + opportunité ; suivi des demandes dans le CRM | ✅ |

**À prévoir** : durée de conservation des prospects et messages (purge automatique),
alertes e-mail (service d'envoi à choisir), devis chiffrés avec la facturation (EPIC 13),
donner le rôle `staff_sales` aux commerciaux.

### EPIC 08 — AI Gateway (P1)
TASK-073 contrat fournisseur → TASK-074 Anthropic · TASK-075 OpenAI · TASK-076 Gemini ·
TASK-077 registre des modèles · TASK-078 prompts · TASK-079 streaming · TASK-080 tokens et coûts ·
TASK-081 quotas · TASK-082 tests des fournisseurs.

| Tâche | Livrable | État |
|---|---|---|
| TASK-073 | Contrat `AIProvider` : flux de texte, usage, raison d'arrêt et erreurs normalisés ; instructions séparées du contenu | ✅ |
| TASK-074 | Adaptateur Anthropic (SDK `anthropic`, streaming, `effort`, repli serveur en cas de refus) | ✅ |
| TASK-075 | Adaptateur OpenAI (SDK `openai`, Chat Completions en streaming avec usage) | ✅ |
| TASK-076 | Adaptateur Gemini (SDK `google-genai`, streaming asynchrone) | ✅ |
| TASK-077 | Registre des modèles en base (prix, plafonds, options, défaut) ; Claude Opus 5.5 / Sonnet 5.5 / Haiku 5.5 amorcés ; écran d'administration | ✅ |
| TASK-078 | Prompts versionnés (clé, versions immuables, activation, retour arrière, variables dans le gabarit uniquement) | ✅ |
| TASK-079 | Streaming SSE de bout en bout : API → route Next.js même origine → navigateur (bac à sable, arrêt possible) | ✅ |
| TASK-080 | Journal d'usage sans contenu : tokens, coûts USD/EUR, latence, statut ; rapport mensuel par organisation et par modèle | ✅ |
| TASK-081 | Budgets mensuels en € par organisation (coût maximal par appel vérifié avant l'appel) et limite par utilisateur | ✅ |
| TASK-082 | Tests de contrat : vrais SDK contre des fournisseurs simulés (flux, usage, refus, 401/429/500, réseau) | ✅ |

**À prévoir** : renseigner les clés des fournisseurs (secrets de déploiement), ajouter les
modèles OpenAI / Gemini souhaités avec leurs prix du moment, tenir à jour `AI_EUR_PER_USD`,
fixer les budgets des organisations clientes avant l'ouverture des expériences IA (EPIC 09).

### EPIC 09 — AI Experiences (P2)
TASK-083 AI Assistant · TASK-084 Document Analyzer · TASK-085 Content Generator ·
TASK-086 sessions · TASK-087 historiques · TASK-088 limitation des abus.
Note : 086-088 sont des prérequis de 083-085 et doivent être faites en premier.

| Tâche | Livrable | État |
|---|---|---|
| TASK-086 | Sessions privées (organisation + auteur) : création, liste, renommage, suppression unitaire ou totale | ✅ |
| TASK-087 | Historique des messages rejoué au modèle (30 derniers) ; purge après 90 jours d'inactivité (`make purge-ai-sessions`) | ✅ |
| TASK-088 | Plafond quotidien par utilisateur, tailles maximales, budgets et limite par minute du gateway, requêtes refusées non enregistrées | ✅ |
| TASK-083 | Assistant IA dans l'espace client, réponses en streaming, copie, arrêt | ✅ |
| TASK-084 | Analyse de documents PDF / Word / texte : texte extrait, fichier non conservé, refus explicite des documents trop longs | ✅ |
| TASK-085 | Générateur de contenus (article, post LinkedIn, newsletter, fiche produit, e-mail ; ton, longueur, langue) puis ajustements | ✅ |

**À prévoir** : planifier `make purge-ai-sessions` chaque jour (EPIC 13), mentionner ces
traitements dans la politique de confidentialité, relire les trois prompts dans l'admin IA.

### EPIC 10 — AI Business Diagnostic (P1)
TASK-089 questionnaire → TASK-090 scoring → TASK-091 recommandations → TASK-092 analyse IA
(après EPIC 08) → TASK-093 rapports → TASK-094 export PDF · TASK-095 connexion CRM (après EPIC 07).

| Tâche | Livrable | État |
|---|---|---|
| TASK-089 | Questionnaire public en 6 étapes (profil + 5 axes × 4 questions), FR/EN, versionné dans le code | ✅ |
| TASK-090 | Scoring déterministe par axe et global, 4 niveaux de maturité | ✅ |
| TASK-091 | Catalogue de recommandations par axe et niveau, horizons, services associés, 3 priorités | ✅ |
| TASK-092 | Analyse IA personnalisée en streaming (prompt versionné, budget interne, plafond quotidien) | ✅ |
| TASK-093 | Page de résultat (radar, barres, priorités) et rapport complet débloqué contre e-mail + consentement | ✅ |
| TASK-094 | Export PDF généré par l'API (ReportLab), aussi depuis le CRM | ✅ |
| TASK-095 | Prospect CRM créé au déblocage, activité dans l'historique, liste des diagnostics dans l'admin | ✅ |

**À prévoir** : accepter l'ADR-0014, relire le questionnaire, les recommandations et le prompt
`diagnostic.analysis`, planifier `make purge-diagnostics` chaque jour, mentionner le diagnostic
dans la politique de confidentialité.

### EPIC 11 — Client Portal (P2)
TASK-096 dashboard · TASK-097 projets · TASK-098 tâches · TASK-099 livrables ·
TASK-100 documents · TASK-101 support · TASK-102 notifications.

| Tâche | Livrable | État |
|---|---|---|
| TASK-096 | Tableau de bord du client (projets, étapes, livrables à valider, demandes) et vue d'ensemble de l'équipe | ✅ |
| TASK-097 | Projets créés par l'équipe pour une organisation cliente : statut, dates, chef de projet, avancement | ✅ |
| TASK-098 | Tâches (statuts dont « en attente de votre retour »), commentaires client / équipe | ✅ |
| TASK-099 | Livrables : dépôt, validation ou demande de modifications (owner/admin), versions | ✅ |
| TASK-100 | Documents partagés dans les deux sens : bucket privé, type vérifié, 25 Mo, liens signés de 5 min | ✅ |
| TASK-101 | Support : tickets numérotés, fil de messages, statuts, priorité, attribution | ✅ |
| TASK-102 | Notifications dans l'application (cloche, compteur, page dédiée), FR/EN | ✅ |

**À prévoir** : accepter l'ADR-0015, créer le bucket privé en production, mentionner le portail
dans la politique de confidentialité, notifications par e-mail avec un service d'envoi.

### EPIC 12 — Academy (P2)
TASK-103 catalogue · TASK-104 modules · TASK-105 leçons · TASK-106 inscriptions ·
TASK-107 progression · TASK-108 quiz · TASK-109 certificats.

| Tâche | Livrable | État |
|---|---|---|
| TASK-103 | Catalogue public (page Academy, pages de formation, sitemap) ; formations publiques ou réservées, publiées seulement si complètes en FR et EN | ✅ |
| TASK-104 | Modules ordonnés, rédigés dans `/admin/academy` | ✅ |
| TASK-105 | Leçons en Markdown FR/EN (aperçu), vidéo YouTube/Vimeo en mode respectueux de la vie privée | ✅ |
| TASK-106 | Inscription libre aux formations publiques ; inscription par l'équipe des membres d'un client, suivie par ses owners/admins | ✅ |
| TASK-107 | Progression par leçon et par quiz, reprise là où on s'était arrêté | ✅ |
| TASK-108 | Quiz à choix unique par module, corrigés par le serveur, 70 %, essais illimités, explications | ✅ |
| TASK-109 | Certificat automatique, code vérifiable publiquement, PDF | ✅ |

**À prévoir** : accepter l'ADR-0016, renseigner `SITE_URL` côté API, rédiger les premières
formations, mentionner l'Academy dans la politique de confidentialité, formations payantes avec
l'EPIC 13.

### EPIC 13 — Commerce & Billing (P2)
TASK-110 catalogue · TASK-111 devis · TASK-112 factures · TASK-113 paiements ·
TASK-114 abonnements · TASK-115 transactions. Le choix du prestataire de paiement
(et de la facturation conforme à la réglementation française, facture électronique) fera l'objet d'un ADR.

| Tâche | Livrable | État |
|---|---|---|
| TASK-110 | Catalogue (prestations, abonnements, formations payantes de l'Academy), FR/EN, TVA par produit | ✅ |
| TASK-111 | Devis rédigés par l'équipe, acceptés ou refusés en ligne par le client (bon pour accord horodaté), PDF | ✅ |
| TASK-112 | Factures et avoirs : numérotation continue, coordonnées figées, TVA par taux, mentions légales, PDF ; acompte et solde | ✅ |
| TASK-113 | Paiement en ligne par Stripe Checkout (carte, SEPA), webhooks signés et idempotents ; virement | ✅ |
| TASK-114 | Abonnements souscrits et résiliés depuis le portail, une facture par période payée | ✅ |
| TASK-115 | Transactions (paiements Stripe, virements enregistrés), tableau de bord (encours, retards, revenu récurrent) | ✅ |

**À prévoir** : accepter l'ADR-0017, configurer Stripe (clés, webhook) et les coordonnées du vendeur,
ADR facture électronique (Factur-X, plateforme agréée), politique de remboursement.

### EPIC 14 — Production & Scale
TASK-116 CI/CD (CI avancée en P0, déploiement continu livré avec l’EPIC 14) · TASK-117 monitoring · TASK-118 logs · TASK-119 sauvegardes ·
TASK-120 tests de sécurité · TASK-121 tests de charge (P3) · TASK-122 déploiement production ·
TASK-123 validation de mise en production.

| Tâche | Livrable | État |
|---|---|---|
| TASK-116 | CI (7 jobs, dont sécurité) ; déploiement continu Railway de `main` après la CI (« Wait for CI ») ; tests de fumée après chaque déploiement de production | ✅ |
| TASK-117 | Sentry API et web (serveur et navigateur), sans donnée personnelle, release = commit | ✅ |
| TASK-118 | Journaux JSON, identifiant de requête (`X-Request-ID`), journal d'accès ; journaux et métriques Railway | ✅ |
| TASK-119 | Sauvegardes du volume Railway + export quotidien vérifié vers S3 (30 jours) ; restauration testée | ✅ |
| TASK-120 | Bandit, `eslint-plugin-security`, gitleaks sur tout l'historique | ✅ |
| TASK-121 | Tests de charge | ⏸ non retenus pour l'instant |
| TASK-122 | Infrastructure Railway as code (`.railway/railway.ts`, `railway config plan` / `apply`, saisie des secrets), migrations en pré-déploiement, garde-fou des réglages de production, en-têtes de sécurité | ✅ |
| TASK-123 | Liste de contrôle d'ouverture (`docs/deployment/railway.md`), tests de fumée | ✅ (à dérouler à l'ouverture) |

**À prévoir** :
- accepter l'ADR-0018 ;
- créer les buckets S3 et les projets Sentry, compléter `SETTINGS` dans `.railway/railway.ts`,
  puis `railway init`, `make railway-plan`, `make railway-apply`, `make railway-secrets`
  (`docs/deployment/railway.md`) ;
- tester la restauration, puis dérouler la liste de contrôle d'ouverture ;
- plus tard : CSP avec nonces, environnement de recette, ZAP, Trivy, pip-audit, tests de charge.
