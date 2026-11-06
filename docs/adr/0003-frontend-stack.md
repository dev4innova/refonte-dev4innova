# ADR-0003 — Stack frontend : Next.js, Tailwind CSS, shadcn/ui

- **Statut** : Proposé
- **Date** : 2026-11-06
- **Tâches liées** : TASK-010, TASK-020, TASK-021

## Contexte
Le site corporate exige un bon SEO et des performances élevées ; le portail et l'admin
exigent une UI riche et cohérente.

## Décision
- **Next.js (App Router) + TypeScript strict** : SSR/RSC pour le SEO, une seule application
  pour site, portail et admin (route groups `(marketing)`, `(portal)`, `(admin)`).
- **Tailwind CSS** avec design tokens centralisés (CSS variables) et **shadcn/ui**
  (composants copiés dans le repo, basés sur Radix UI, accessibles).
- **next-intl** pour l'i18n (voir ADR-0008). **Zod** pour la validation des formulaires.
- Tests : Vitest + Testing Library, Playwright pour les parcours E2E.

## Alternatives considérées
- Applications séparées pour site et portail : duplication du design system et de l'auth.
- Bibliothèque de composants packagée (MUI, Chakra) : moins de contrôle sur l'identité visuelle.

## Conséquences
Le design system vit dans `apps/web/src/components/ui` ; il pourra être extrait dans
`packages/ui` si une deuxième application apparaît.
