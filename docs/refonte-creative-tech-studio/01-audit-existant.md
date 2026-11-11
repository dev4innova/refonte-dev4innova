# 01 — Audit de l'existant

Mission : refonte UX/UI « Creative Tech Studio ». Phase A, réalisée sur `main` (`f86d746`,
11/11/2026), avant toute modification du code.

## 1. Socle technique

| Élément | Version / état | Conséquence pour la refonte |
|---|---|---|
| Framework | Next.js **16.4.5**, App Router, **Cache Components** activé, sortie `standalone` | Les pages publiques sont des coquilles statiques prérendues, avec des îlots dynamiques en `<Suspense>`. Toute lecture du CMS passe par `await connection()`. Les animations ne doivent pas casser le prérendu. |
| UI | React 19.3, **Tailwind CSS v4** (tokens via `@theme inline`), shadcn/ui (Radix), `class-variance-authority`, `lucide-react` | On garde ces briques : **aucune nouvelle dépendance n'est nécessaire**. |
| Typographies | Space Grotesk et Inter, auto-hébergées par `next/font` (`src/lib/fonts.ts`) | Ce sont déjà les polices candidates. Il reste à travailler les graisses, l'échelle et les chiffres tabulaires. |
| i18n | next-intl 4, FR/EN, chemins localisés (`/fr/a-propos`, `/en/about`), `messages/{fr,en}.json` | Tous les nouveaux textes passent par les dictionnaires. Un test vérifie la parité FR/EN et la syntaxe ICU. |
| CMS | API FastAPI : `service`, `project`, `article`, `page`. Markdown nettoyé, couverture d'image, `attributes` libres (10 au plus). Médias servis par l'API (bucket privé) | Services, réalisations et articles restent administrables. La page d'accueil ne doit **rien** écrire en dur à leur place. |
| Images | Aucune image matricielle publique. Seule image de marque : `public/brand/dev4innova-mark.svg` (ampoule et monogramme D4I) | Partir d'une page vide de visuels : tout est à créer, en SVG d'abord. |
| Animations | `tw-animate-css`, tokens `--motion-*`, `animate-fade-in` et `animate-slide-up`, `prefers-reduced-motion` global (durées à 0,01 ms) | La base d'accessibilité existe et sera conservée telle quelle. |
| Tests | Vitest (317 tests, dont composants de mise en page, contrastes des tokens et parité des messages), Playwright 192 tests sur 3 tailles (375 / 768 / 1280 px), axe WCAG 2.1 AA, absence de défilement horizontal, menu mobile, mouvement réduit | Filet de sécurité solide. Les tests E2E vérifient le `h1` exact de l'accueil (i18n) et la structure des pages. |
| Perf mesurée (local, build de production) | Accueil FR : **LCP 236 ms** (bureau) et 136 ms (mobile), **CLS 0,000**, 337 Ko transférés, 0 image, 21 SVG (icônes) | Excellent point de départ. La refonte doit **ajouter du visuel sans dégrader ces chiffres** (budget au § 6 de `06-architecture-technique.md`). |

## 2. Structure du frontend

```
apps/web/src/
├── app/[locale]/          pages publiques, compte, admin, auth (sign-in, sign-up)
├── components/
│   ├── ui/                Button (6 variantes), Card, Input, Textarea, Checkbox, Select, Sheet, FormField
│   ├── layout/            SiteHeader (sticky, flou), MobileNav (Sheet), SiteFooter, Section (4 surfaces), Container
│   ├── marketing/         PageHeader, OfferGrid, OfferDetail, Steps, CtaBand, EmptyState, Breadcrumb
│   ├── cms/               ServicesGrid, ContentGrid, CmsDetail, Prose
│   ├── brand/logo.tsx     logo ampoule et mot-symbole
│   ├── diagnostic/        DiagnosticForm, RadarChart (SVG), UnlockForm, AiAnalysis
│   └── (admin, portal, academy, billing, ai…)  espaces connectés
├── config/                navigation.ts (structure du site), offer.ts (5 solutions et leurs icônes)
├── styles/tokens.css      source unique des tokens (89 lignes)
└── app/globals.css        correspondance tokens vers Tailwind, styles de base, prose CMS
```

**Routes publiques** : `/`, `/solutions` et `/solutions/[slug]` (5 solutions, en code),
`/services` et `/services/[slug]` (CMS), `/portfolio` et `/portfolio/[slug]` (CMS),
`/innovation-lab`, `/academy` et ses formations, la vérification de certificat, `/insights`
et `/insights/[slug]` (CMS), `/a-propos`, `/contact`, `/devis`, `/diagnostic-ia` et ses
résultats, les mentions légales, la page de confidentialité, `/connexion` et `/inscription`.

**Routes privées** : `/espace-client/**` (portail, IA, formations, facturation, sécurité) et
`/admin/**`. Elles sont **hors du périmètre visuel principal** : elles hériteront des tokens,
mais leur ergonomie n'est pas retravaillée dans cette mission.

## 2 bis. Rendu actuel de l'accueil

Captures `audit/home-desktop.webp` et `audit/home-mobile.webp` (dans ce dossier).

| Section actuelle | Constat |
|---|---|
| Hero sombre | Titre fort mais **aucun visuel** : moitié droite vide, simple halo rouge flouté. Rien ne montre le savoir-faire. |
| « De l'idée à la production » | Trois colonnes de texte (Cadrer, Construire, Faire vivre), qui **répètent** la section Méthode plus bas. |
| Nos solutions | Cinq cartes identiques (icône lucide, titre, résumé). Grille 3 + 2 déséquilibrée, rendu de modèle SaaS générique. |
| Nos services | Alimentée par le CMS. **Vide** si aucun service n'est publié dans la langue : un titre suivi d'un grand vide. |
| Diagnostic IA | Simple carte, alors que c'est **la seule expérience interactive réelle** du site, avec radar SVG et recommandations. Sous-exploité. |
| Notre démarche | Quatre étapes numérotées, en texte. Correct, mais sans représentation visuelle du processus. |
| Innovation Lab et Academy | Deux cartes identiques, avec icône et texte. Les deux univers ne se distinguent pas. |
| Appel à l'action et pied de page | Corrects. Le pied de page est complet (offre, innovation, entreprise, mentions). |

**Diagnostic visuel** : le site est propre, accessible et rapide, mais **sans identité visuelle
propre**. Il manque trois choses :
- aucune illustration ;
- aucune preuve concrète (portfolio vide, aucune capture de produit) ;
- un rythme monotone (en-tête de section puis grille de cartes, sept fois de suite).

Le rouge #D90000 est utilisé presque uniquement pour les boutons et les sur-titres.

## 3. Contenus réels disponibles (contrainte « aucune donnée fictive »)

| Contenu | Disponibilité | Impact |
|---|---|---|
| Solutions (5) | Dans le code et les messages FR/EN | Base de la grille Bento. Textes déjà rédigés. |
| Services | CMS, semés par la migration (FR/EN) | Disponibles en production. Le rendu doit couvrir le cas vide. |
| **Réalisations (portfolio)** | CMS, **aucune semée**. Probablement **vide** en production | **Impossible** de montrer des « projets réels et résultats vérifiés » sans données. Voir l'arbitrage au doc 04. |
| Articles (Insights) | CMS, probablement vide | Section conditionnelle seulement. |
| Témoignages, logos clients, chiffres | **Aucun** | Interdits s'ils sont inventés : on n'en affiche aucun. |
| **Produits réellement construits** | Diagnostic IA (radar, score, analyse IA), outils IA (assistant, analyse de documents), portail client (projets, livrables, tickets), Academy (formations, quiz, certificats vérifiables), facturation | **Preuves authentiques** : ce sont de vraies interfaces développées par DEV4INNOVA. On peut en faire des captures réelles, avec des données de démonstration étiquetées comme telles. |

## 4. Risques de régression identifiés

| Risque | Gravité | Parade |
|---|---|---|
| Changement de valeurs des tokens : les espaces connectés (admin, portail) utilisent les mêmes tokens | Élevée | Garder les **noms** sémantiques et faire évoluer les valeurs. Repasser axe sur les pages connectées. Les nouveaux tokens « marketing » sont ajoutés, sans rien renommer. |
| Contraste du nouveau rouge #E11927 : 4,48:1 sur ivoire (texte courant **non conforme**) | Élevée | Rouge « encre » #C8101E pour le texte rouge sur fond clair (5,52:1), #FF4757 sur graphite (5,51:1). Tests de contraste mis à jour (`tokens.test.ts`). |
| Gris acier #8B8D98 : 3,08:1 sur ivoire (texte **non conforme**) | Élevée | Texte secondaire en #5F616C (5,74:1). L'acier reste pour les bordures, les illustrations et le texte sur graphite (5,57:1). |
| Tests E2E dépendants du DOM (`h1` exact, un seul `h1`, liens « Espace client », menu mobile) | Moyenne | Conserver le texte du `h1` ou mettre à jour les tests en même temps. Garder les rôles et noms accessibles. |
| Cache Components : un composant client au mauvais niveau rend la page dynamique | Moyenne | Animations dans de petits îlots `"use client"` (révélation au défilement). Illustrations en composants serveur (SVG statique). |
| Grille Bento sur mobile : défilement horizontal et ordre de lecture | Moyenne | Grille CSS avec l'ordre du DOM = ordre visuel. Test « pas de défilement horizontal » déjà présent à 375 px, étendu à 320 px. |
| Performance : illustrations lourdes et polices supplémentaires | Moyenne | SVG en ligne optimisés (< 8 Ko chacun), aucune bibliothèque 3D, budget de poids. Mesure du LCP et du CLS dans l'E2E. |
| Sections CMS vides | Moyenne | Chaque section CMS a un rendu « vide » assumé, ou se masque. |

## 5. Architecture frontend proposée (synthèse)

- **Conserver** : Next 16, Tailwind v4, shadcn/Radix, next-intl, `Section` et `Container`, `Button`
  et `Card` (variantes étendues), la structure de routes et les composants CMS.
- **Ajouter** :
  - un module `src/components/studio/` (primitives éditoriales : Eyebrow, SectionHeading,
    BentoGrid, Reveal, Marker, ProductFrame) ;
  - `src/components/illustrations/` (SVG en composants serveur) ;
  - une couche de tokens « studio » dans `tokens.css`.
- **Remplacer** : la page d'accueil, puis progressivement les en-têtes des pages publiques
  secondaires.
- Détails : `06-architecture-technique.md`.
