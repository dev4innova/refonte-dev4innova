# Règles frontend (`apps/web`, `packages/*`)

## Stack
- **Next.js 16** avec Cache Components (`cacheComponents: true`) : les API de rendu et de cache
  diffèrent des versions antérieures. Consulter `apps/web/AGENTS.md` et la documentation
  embarquée (`node_modules/next/dist/docs/`) avant d'utiliser une API Next.js.
- Next.js App Router, React Server Components par défaut. `"use client"` uniquement quand
  un composant a besoin d'état, d'effets ou d'API navigateur — et le plus bas possible dans l'arbre.
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. Interdit : `any` (utiliser
  `unknown` + narrowing), `@ts-ignore` (utiliser `@ts-expect-error` avec justification).
- Styles : Tailwind CSS v4 uniquement, via les design tokens de `src/styles/tokens.css`
  (voir `docs/design-system.md`). Pas de couleurs, tailles ou espacements en dur (`#3b82f6`,
  `text-[13px]`) hors définition des tokens. Seule exception : les couleurs du logo.
- Composants UI : shadcn/ui dans `src/components/ui` (réutiliser avant de créer) ; mise en page
  dans `src/components/layout` ; composants métier dans `src/components/<domaine>`.
- Fusion de classes avec `cn()` (`@/lib/utils`) ; variantes avec `class-variance-authority`.

## Organisation
```
apps/web/src/
├── app/[locale]/        # routes localisées (next-intl)
│   ├── (marketing)/     # site corporate public
│   ├── (portal)/        # portail client (authentifié)
│   └── (admin)/         # administration (authentifié + rôle)
├── components/ui/       # primitives design system
├── components/<domain>/ # composants métier
├── lib/                 # utilitaires, client API, config
├── i18n/                # configuration next-intl
└── messages/{fr,en}.json
```
- Un composant par fichier, nommé en `PascalCase.tsx`. Fichiers utilitaires en `kebab-case.ts`.
- Pas d'import relatif remontant de plus d'un niveau : utiliser l'alias `@/`.

## Données et API
- Les appels au backend passent **exclusivement** par `packages/api-client` (généré depuis
  l'OpenAPI). Pas de `fetch` ad hoc vers l'API. Côté serveur : `serverApi()` de `@/lib/api`.
- Les variables serveur (`API_URL`, …) sont lues dans des modules marqués `import "server-only"`.
- Récupération de données côté serveur (Server Components / Route Handlers) en priorité.
- Les validations de formulaires utilisent Zod ; le backend reste l'autorité de validation.
- Aucune clé secrète dans le frontend. Seules les variables `NEXT_PUBLIC_*` explicitement
  publiques sont exposées au navigateur.

## Internationalisation
- Aucun texte visible en dur : tout passe par `getTranslations` (Server Components) ou
  `useTranslations`. Les composants réutilisables (`src/components/`) reçoivent leurs textes
  **par props** ; seules les pages et layouts lisent les messages.
- Dictionnaires : `apps/web/messages/{fr,en}.json`, un namespace par zone (`Navigation`,
  `Footer`, `Home`…). Chaque clé est ajoutée **dans les deux fichiers dans le même commit** :
  `src/i18n/messages.test.ts` vérifie la parité des clés, les valeurs vides et les variables ICU.
  Les clés sont typées (`src/i18n/global.d.ts`) : une clé inexistante ne compile pas.
- Routes : toute page vit sous `src/app/[locale]/`, appelle `setRequestLocale(locale)` (rendu
  statique) et déclare ses `alternates` avec `localeAlternates()` (`src/i18n/metadata.ts`).
  Une nouvelle URL est déclarée dans `pathnames` (`src/i18n/routing.ts`), avec son slug
  traduit si besoin (`/fr/a-propos` ↔ `/en/about`).
- Liens internes : `Link`, `useRouter`, `usePathname`, `redirect` de `@/i18n/navigation`
  uniquement. ESLint interdit `next/link` et ces fonctions de `next/navigation`.
- Dates, nombres et montants formatés via next-intl (`useFormatter` / `getFormatter`),
  jamais à la main.

## Qualité
- Accessibilité : WCAG 2.1 AA. HTML sémantique, labels sur tous les champs, focus visible,
  contraste vérifié, navigation clavier, `alt` sur les images significatives.
- Responsive mobile-first ; vérifier au minimum 375px, 768px, 1280px.
- Performance : `next/image` pour les images, `next/font` pour les polices, pas de
  bibliothèque lourde sans justification. Objectif Lighthouse ≥ 90 sur les pages publiques.
- SEO : `generateMetadata` sur chaque page publique, `hreflang` FR/EN.
- Lint (ESLint) et format (Prettier) doivent passer ; typecheck sans erreur.
- Tests : Vitest + Testing Library pour la logique et les composants (`*.test.ts` en
  environnement node, `*.test.tsx` en jsdom, audit `axeViolations` de `@/test/axe`) ;
  Playwright (`e2e/`, `make e2e`) pour le responsive, l'accessibilité en navigateur réel et les
  parcours critiques.
