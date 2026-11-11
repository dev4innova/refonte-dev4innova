# 03 — Design system : évolution « Studio »

Principe : **faire évoluer**, ne pas remplacer. La source unique reste
`apps/web/src/styles/tokens.css`, exposée à Tailwind par `@theme inline` dans `globals.css`. Les
**noms sémantiques existants sont conservés** : admin, portail et Academy en héritent sans
modification de code. On ajoute une couche « studio » pour les pages publiques.

## 1. Tokens de couleur

### 1.1 Palette de marque (primitives)

```css
--d4i-graphite-950: #0e0e10;  --d4i-graphite-900: #141417;  --d4i-graphite-800: #1e1f24;
--d4i-graphite-700: #2a2b31;  --d4i-steel-500: #8b8d98;    --d4i-steel-600: #5f616c;
--d4i-steel-300: #c4c6ce;     --d4i-steel-200: #e2e3e7;    --d4i-ivory-50: #f7f7f5;
--d4i-glacier-100: #dce5f4;   --d4i-glacier-50: #eef2fa;
--d4i-red-500: #e11927;       /* signature : aplats, graphisme */
--d4i-red-600: #c8101e;       /* encre : texte et liens sur clair (5,52:1), survol des boutons */
--d4i-red-700: #a30d18;       /* pressé, texte d'erreur */
--d4i-red-400: #ff4757;       /* lumière : texte et focus sur graphite (5,51:1) */
--d4i-red-50:  #fdecee;       /* fond d'accent */
```

### 1.2 Sémantique (noms conservés, valeurs mises à jour)

| Token | Avant | Après | Note |
|---|---|---|---|
| `--background` | gris #f4f4f4 | ivoire `#f7f7f5` | |
| `--foreground` | #171717 | graphite `#141417` | |
| `--card` | blanc | blanc | |
| `--primary` | #d90000 | `#e11927` | aplats avec texte blanc (4,81:1) |
| `--primary-hover` | #b80000 | `#c8101e` | |
| `--primary-ink` (nouveau) | — | `#c8101e` | texte et liens rouges sur clair |
| `--muted` | #e8e8e8 | `#e2e3e7` | |
| `--muted-foreground` | #525252 | `#5f616c` | 5,74:1 sur ivoire |
| `--border` | #d4d4d4 | `#e2e3e7` | |
| `--input` | #8a8a8a | `#8b8d98` | 3:1 minimum pour les bordures de champs (WCAG 1.4.11) |
| `--ring` | rouge | `#c8101e` | `#ff4757` sur les surfaces inversées |
| `--inverse` | #171717 | `#141417` | |
| `--inverse-elevated` (nouveau) | — | `#1e1f24` | cartes sur graphite |
| `--inverse-muted-foreground` | #a3a3a3 | `#8b8d98` | 5,57:1 sur graphite |
| `--primary-on-inverse` | #ff4d4d | `#ff4757` | |
| `--tint` (nouveau) | — | glacier `#dce5f4` | surfaces « données » |
| `--tint-foreground` (nouveau) | — | `#141417` | |
| `--success`, `--warning` (nouveaux) | — | `#1f7a4d` et `#8a5a00` | états des formulaires et des statuts (≥ 4,5:1 sur blanc) |

**Tests** : `tokens.test.ts` vérifie les paires critiques, avec un seuil de 4,5:1 pour le texte
et de 3:1 pour les composants d'interface. La liste des paires est étendue aux nouveaux tokens.

## 2. Typographie

| Token | Valeur | Usage |
|---|---|---|
| `text-display-2xl` (nouveau) | `clamp(2.75rem, 1.2rem + 6.4vw, 6rem)`, interligne 0,98, -0,04 em | titre du hero uniquement |
| `text-display-xl` à `text-heading-sm` | inchangés | titres de section et de carte |
| `text-body-lg` (nouveau) | `clamp(1.125rem, 1rem + 0.4vw, 1.3125rem)`, interligne 1,55 | chapôs |
| `text-eyebrow` (nouveau) | 0,8125 rem, +0,18 em, capitales, Space Grotesk 500 | sur-titres indexés |
| `font-numeric` (utilitaire) | `font-variant-numeric: tabular-nums` | scores, étapes |

## 3. Espacements et grille

- Inchangés : `--layout-gutter`, `--layout-section-y`, `--layout-max-width` (80 rem).
- Ajouts :
  - `--layout-section-y-tight` : `clamp(3rem, 2rem + 4vw, 6rem)` ;
  - `--bento-gap` : `clamp(0.75rem, 0.5rem + 1vw, 1.25rem)`.
- Grille : 12 colonnes à partir de `lg` (1 024 px), 6 colonnes en `md` (768 px), 1 colonne en
  dessous. La grille Bento est décrite au § 6.

## 4. Rayons, bordures, élévations

| Token | Valeur | Usage |
|---|---|---|
| `--radius` | 0,5 rem → **0,75 rem** | cartes, champs |
| `--radius-frame` (nouveau) | 1,25 rem | cellules Bento, cadres de produit |
| `--radius-pill` (nouveau) | 999px | badges, puces d'étape |
| `--hairline` (nouveau) | `1px solid rgb(139 141 152 / 0.22)` | filets de grille et séparateurs |
| `--elevation-1` et `--elevation-2` | conservés, teinte graphite | |
| `--elevation-frame` (nouveau) | `0 24px 60px -24px rgb(14 14 16 / 0.35)` | cadres de produit sur fond clair |

Sur fond sombre, l'élévation passe par la **surface** (`--inverse-elevated`) et un filet, pas
par une ombre.

## 5. Mouvement

Les tokens existants sont conservés (`--motion-duration-fast`, `-base` et `-slow`, et les
courbes). Ajouts :
- `--motion-duration-draw` : 1 200 ms, pour le tracé du filament du hero, joué une seule fois ;
- `--motion-stagger` : 60 ms, pour les cascades de révélation.

`prefers-reduced-motion` : la règle globale existante est conservée, et les composants `Reveal`
et `Filament` affichent directement leur état final.

## 6. Composants

### 6.1 Composants existants qui évoluent

| Composant | Évolution |
|---|---|
| `Button` | Variantes conservées (`primary`, `secondary`, `outline`, `ghost`, `link`, `inverse`). **Nouvelle** variante `signal-link` : lien éditorial avec une flèche qui se décale au survol. Cibles d'au moins 44 px (test existant). |
| `Card` | Rayon 0,75 rem. **Nouvelle** variante `frame` : bordure fine et filet rouge au survol et au focus. La variante `interactive` reste, avec la zone de clic étendue au titre (accessibilité). |
| `Section` | Variantes `default`, `card`, `muted` et `inverse` conservées. **Nouvelle** variante `tint` (glacier). Option `rule` : filet supérieur avec index de section. |
| `SiteHeader` | Fond ivoire translucide sur page claire, **graphite translucide sur le hero** (variante `overlay`). Lien actif souligné en rouge. Même structure HTML : les tests de navigation restent valides. |
| `SiteFooter` | Grand mot-symbole, colonnes conservées, rappel du contact et du diagnostic. Graphite. |
| `PageHeader` | Sur-titre indexé, titre en `display-xl`, chapô `body-lg`, illustration optionnelle à droite. Utilisé par toutes les pages secondaires. |
| `CtaBand` | Devient « ContactPanel » : deux voies, contact et diagnostic. Fond graphite et filament. |
| Formulaires (`FormField`, `Input`…) | Rayons et couleurs via les tokens. États erreur, succès et chargement inchangés dans la logique, harmonisés visuellement. |

### 6.2 Nouveaux composants (`src/components/studio/`)

| Composant | Rôle | Rendu |
|---|---|---|
| `Eyebrow` | Sur-titre indexé (`01 — Solutions`) | serveur |
| `SectionHeading` | Sur-titre, titre `h2`, chapô et actions, en composition asymétrique 5/12 | serveur |
| `BentoGrid` et `BentoCell` | Grille Bento accessible : ordre du DOM égal à l'ordre de lecture, tailles `sm`, `md`, `lg` et `wide` | serveur |
| `ProductFrame` | Cadre « fenêtre » pour une capture réelle : barre de titre, légende « Démonstration » obligatoire, `next/image` | serveur |
| `Reveal` | Révélation au défilement (IntersectionObserver), rien si mouvement réduit, aucun décalage de mise en page (opacité et transformation seulement) | client, ~1 Ko |
| `MethodTimeline` | Les 4 étapes de la méthode, en liste ordonnée sémantique et schéma SVG | serveur |
| `StatusDot`, `Kbd`, `Tag` | Micro-éléments d'interface des illustrations et des badges | serveur |

### 6.3 États

Le chargement, l'erreur et le succès existent déjà (formulaires, `EmptyState`, squelettes
`ContentGridSkeleton`). Ils sont harmonisés :
- les squelettes ont exactement la taille finale (aucun CLS) ;
- les erreurs utilisent `role="alert"` et la couleur `--destructive` ;
- les succès utilisent `role="status"`.

## 7. Responsive

| Point de rupture | Largeur | Adaptations clés |
|---|---|---|
| base | 320 px et plus | 1 colonne. Illustrations simplifiées (variante `compact` des SVG). Titre du hero `display-2xl` au minimum, soit 2,75 rem. |
| `sm` | 640 px | Boutons côte à côte |
| `md` | 768 px | Bento sur 6 colonnes, Méthode en 2 × 2 |
| `lg` | 1 024 px | Navigation complète, grille de 12 colonnes, hero 7/5 |
| `xl` | 1 280 px | Largeur maximale. Au-delà, marges latérales et motif de grille en fond. |

## 8. Vitrine

La page interne `/design-system` (non indexée) est mise à jour avec les nouveaux tokens et
composants. Elle sert de référence et de support de test.
