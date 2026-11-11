# 06 — Architecture technique de la refonte

## 1. Principes

1. **Aucune nouvelle dépendance d'exécution.** Next 16, React 19, Tailwind v4, Radix, lucide et
   next-intl suffisent. `sharp`, déjà présent comme dépendance de Next (variantes glibc et
   musl), permet l'optimisation des images par `next/image` dans l'image Docker `standalone`.
2. **Composants serveur par défaut.** Seuls quelques îlots sont des composants client :
   `Reveal`, le menu mobile (existant) et le sélecteur de langue (existant). Les illustrations
   SVG sont des composants serveur, donc du HTML statique sans JavaScript.
3. **Cache Components préservé.** La coquille de l'accueil reste prérendue au build. Les données
   du CMS (services, projets, articles) restent dans des `<Suspense>` avec squelettes de taille
   fixe et `await connection()`, comme aujourd'hui.
4. **Rien n'est renommé côté métier** : routes, API, client généré, CMS, authentification et
   messages existants. On **ajoute** des clés de messages et on fait évoluer les valeurs des
   tokens.

## 2. Arborescence ajoutée

```
apps/web/src/
├── styles/tokens.css                 (valeurs mises à jour et couche « studio » ajoutée)
├── components/
│   ├── studio/                       nouvelles primitives éditoriales
│   │   ├── eyebrow.tsx  section-heading.tsx  bento.tsx  product-frame.tsx
│   │   ├── reveal.tsx   ("use client", IntersectionObserver, ~1 Ko)
│   │   └── method-timeline.tsx
│   ├── illustrations/                SVG en composants serveur, un fichier par visuel
│   │   ├── signal-to-system.tsx  solution-assistants.tsx  solution-documents.tsx
│   │   ├── solution-data.tsx  solution-content.tsx  solution-integration.tsx
│   │   ├── method-loop.tsx  lab-board.tsx  academy-path.tsx
│   │   └── illustrations.test.tsx    (accessibilité, viewBox, absence de couleur brute)
│   └── home/                         sections de l'accueil (une par fichier)
│       ├── hero.tsx  value.tsx  diagnostic-preview.tsx  solutions-bento.tsx
│       ├── work.tsx  services-list.tsx  method.tsx  commitments.tsx
│       └── lab-academy.tsx  contact-panel.tsx
├── app/[locale]/page.tsx             assemble les sections (environ 60 lignes)
└── app/[locale]/opengraph-image.tsx  image de partage générée au build
public/media/products/                captures sources en PNG (optimisées par next/image)
scripts/capture-products.mjs          capture reproductible des écrans produits (Playwright)
```

## 3. Styles

- Tokens dans `tokens.css` (doc 03). Correspondance Tailwind dans `globals.css` : nouvelles
  couleurs (`tint`, `inverse-elevated`, `primary-ink`, `success`, `warning`), typographies
  (`display-2xl`, `body-lg`, `eyebrow`), rayons (`frame`, `pill`) et ombres (`frame`).
- **Aucune valeur brute dans les composants** (règle existante). Les illustrations utilisent
  des variables CSS (`--illu-*`) définies par surface (`[data-variant="inverse"]`, etc.).
- Le motif de grille technique est un utilitaire `@utility pattern-blueprint` en CSS pur.
- Pas de CSS-in-JS ni de bibliothèque d'animation : transitions CSS et un IntersectionObserver.

## 4. Animations

| Animation | Technique | Coût | Mouvement réduit |
|---|---|---|---|
| Tracé du filament (hero) | `stroke-dasharray` et `stroke-dashoffset`, keyframe CSS jouée une fois | 0 Ko de JavaScript, composité | état final immédiat (règle globale et `@media`) |
| Révélation au défilement | `Reveal` : la classe `data-revealed` déclenche `opacity` et `transform` | ~1 Ko de JavaScript, IntersectionObserver déconnecté après le premier passage | contenu visible d'emblée, sans observateur |
| Survols et focus | transitions CSS (`--motion-duration-base`) | 0 | durées à 0,01 ms |

Pour garantir l'absence de CLS, `Reveal` n'agit que sur `opacity` et `transform`. Le contenu
est **visible sans JavaScript** : la classe d'état caché n'est posée qu'une fois l'hydratation
faite, donc le JavaScript n'est pas requis pour lire la page.

## 5. Accessibilité (WCAG 2.2 AA)

- Un `h1` par page, hiérarchie `h2` et `h3` stricte, régions annotées
  (`aria-labelledby` sur chaque section).
- Grille Bento : l'ordre du DOM correspond à l'ordre visuel, sans `order` CSS ni grille
  « dense ». Les cartes sont cliquables par un lien unique dans le titre, avec la zone de clic
  étendue par un pseudo-élément (motif déjà utilisé sur le site).
- Focus toujours visible : contour de 2 px, `--ring` sur clair et `#ff4757` sur sombre.
  **2.4.11 Focus non masqué** : `scroll-padding-top` couvre déjà l'en-tête collant.
- Cibles d'au moins 24 × 24 px (2.5.8). Le projet vise déjà 44 px (test existant).
- Contrastes : vérifiés par `tokens.test.ts` (paires de texte à 4,5:1, interface à 3:1) et par
  axe dans l'E2E.
- Illustrations : `aria-hidden="true"`, avec une alternative textuelle quand elles portent une
  information. Captures avec un `alt` descriptif.

## 6. Performance : budget et mesure

| Indicateur | Objectif (p75) | Mesure actuelle (local) | Budget de la refonte |
|---|---|---|---|
| LCP | ≤ 2,5 s | 0,24 s (bureau) | Élément LCP = le `h1` (texte), polices en `display: swap` et préchargées par next/font |
| CLS | ≤ 0,1 | 0,000 | ≤ 0,02. Toutes les illustrations et captures ont leurs dimensions réservées. |
| INP | ≤ 200 ms | n.d. | 1 seul îlot client ajouté (Reveal). Aucun gestionnaire de défilement. |
| Poids transféré de l'accueil | — | 337 Ko | ≤ 450 Ko au chargement initial. Captures en lazy-load (AVIF ≤ 60 Ko). |
| JavaScript ajouté | — | — | ≤ 3 Ko gzip |

Mesures :
1. en E2E, un test Playwright relève le LCP et le CLS (PerformanceObserver) de l'accueil sur les
   3 tailles, et **échoue au-delà du budget** ;
2. Lighthouse en local avant et après (rapports joints à la PR) ;
3. en production, les Core Web Vitals réels se lisent dans la Search Console (p75), sans outil
   tiers ajouté.

## 7. SEO technique

Éléments conservés :
- métadonnées par page (`pageMetadata`), hreflang FR/EN, canonique ;
- sitemap et robots ;
- JSON-LD `Organization`.

Améliorations :
- image Open Graph de marque (`opengraph-image.tsx`) ;
- JSON-LD `WebSite` ;
- `alt` des captures ;
- titres de section explicites.

## 8. Tests

| Niveau | Ajouts |
|---|---|
| Vitest | Primitives studio (rôles, liens, variantes), illustrations (rendu, `aria-hidden`, aucune couleur hexadécimale en dur), Bento (ordre du DOM), contrastes des nouveaux tokens |
| E2E existants | `pages`, `i18n`, `a11y`, `responsive` et `navigation` doivent rester verts, en s'adaptant seulement aux nouveaux textes |
| E2E nouveaux | Accueil : présence et ordre des sections, liens des solutions, appels à l'action vers `/contact` et `/diagnostic-ia`, **aucun défilement horizontal à 320 px**, mouvement réduit (tracé immédiat), budget LCP/CLS, axe sur l'accueil en FR et EN, sections CMS vides (rendu sans trou) |
| Visuel | Captures Playwright de référence (bureau, tablette, mobile) jointes à la PR pour revue humaine. Pas de comparaison au pixel en CI : trop fragile pour un rendu de polices. |

## 9. Compatibilité avec les espaces connectés

Les pages admin, portail et Academy utilisent les mêmes tokens sémantiques. Elles changeront de
teinte (ivoire, rouge #E11927, rayons de 0,75 rem) sans modification de leur structure.
Contrôle : leurs tests E2E (axe compris) sont repassés, et des captures sont faites pour les
écrans principaux.
