# Design system DEV4INNOVA

Identité : **moderne, minimaliste, premium et technologique**, fidèle au logo historique rouge
et noir. Positionnement : « DEV4INNOVA — L'intégrateur de solutions IA ».

Vitrine vivante de tous les tokens et composants : **`/design-system`** (page interne, non indexée).

## Principes

1. **Une seule source de vérité** : `apps/web/src/styles/tokens.css`. Les composants n'utilisent
   jamais de valeur brute (couleur hexadécimale, taille en px) : uniquement les utilitaires
   Tailwind générés depuis les tokens (`bg-primary`, `text-display-lg`, `px-gutter`…).
2. **Accessibilité WCAG 2.1 AA** : contrastes vérifiés automatiquement, navigation clavier, focus
   visible rouge, cibles tactiles ≥ 44 px, `prefers-reduced-motion` respecté.
3. **Prêt pour le FR/EN** : aucun texte en dur dans `src/components/` ; tout libellé arrive par
   props. Les textes actuels vivent dans `src/content/*` en attendant next-intl (EPIC 03).
4. **Composants shadcn/ui** : code copié dans le dépôt (`src/components/ui`), basé sur Radix UI,
   adapté aux tokens. `components.json` permet d'en ajouter avec `pnpm dlx shadcn add <nom>`.

## Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `primary` | `#D90000` (provisoire) | actions principales, accents, focus |
| `primary-hover` | `#B80000` | survol et appui des actions principales |
| `secondary` / `foreground` | `#171717` | texte, boutons secondaires |
| `background` | `#F4F4F4` | fond de page |
| `card` | `#FFFFFF` | surfaces (cartes, champs, sections claires) |
| `muted` / `muted-foreground` | `#E8E8E8` / `#525252` | fonds neutres, textes secondaires |
| `accent` / `accent-foreground` | `#FFF1F1` / `#990000` | mises en avant discrètes |
| `destructive` | `#990000` | erreurs |
| `border` / `input` | `#D4D4D4` / `#8A8A8A` | séparateurs / bordures de champs (≥ 3:1) |
| `inverse` / `inverse-foreground` | `#171717` / `#F4F4F4` | sections sombres, footer |
| `primary-on-inverse` | `#FF4D4D` | rouge lisible sur fond noir |

**Changer le rouge de marque** : modifier `--d4i-red-500` (et ses voisins `400`, `600`, `700`)
dans `tokens.css`, puis lancer `pnpm --filter @dev4innova/web test` : `tokens.test.ts` vérifie
que tous les contrastes restent conformes.

### Contrastes (vérifiés par `src/styles/tokens.test.ts`)

| Combinaison | Ratio | Autorisé pour |
|---|---|---|
| Blanc sur `#D90000` | 5,3:1 | tout texte |
| `#D90000` sur blanc / sur `#F4F4F4` | 5,3:1 / 4,8:1 | tout texte |
| `#D90000` sur `#171717` | 3,4:1 | **grands textes et éléments d'interface uniquement** |
| `#FF4D4D` sur `#171717` | 5,5:1 | tout texte sur fond sombre |

## Typographie

- **Space Grotesk** (`font-heading`) pour les titres, **Inter** (`font-sans`, par défaut) pour
  le texte. Auto-hébergées par `next/font` (`src/lib/fonts.ts`) : aucun appel à Google depuis
  le navigateur.
- Échelle fluide (`clamp()`), hauteur de ligne et interlettrage inclus :

| Utilitaire | Taille (mobile → desktop) | Usage |
|---|---|---|
| `text-display-xl` | 40 → 76 px | titre de hero (un seul `h1`) |
| `text-display-lg` | 34 → 56 px | titres de page |
| `text-display-md` | 28 → 40 px | titres de section (`h2`) |
| `text-heading-lg` | 22 → 28 px | titres de carte (`h3`) |
| `text-heading-sm` | 18 px | sous-titres |
| `text-lg`, `text-base`, `text-sm` | 18, 16, 14 px | corps de texte |

## Espacements et mise en page

- Échelle Tailwind (base 4 px) pour les espacements internes.
- Tokens de mise en page fluides : `px-gutter` (16 → 40 px), `py-section` (64 → 128 px),
  `max-w-site` (1280 px), `h-header` (64 px).
- `Container` (largeur max et marges latérales) et `Section` (`default`, `card`, `muted`, `inverse`).
- Points de rupture : `sm` 640, `md` 768, `lg` 1024 (navigation desktop), `xl` 1280.
- Rayons : `rounded-sm` → `rounded-xl` dérivés de `--radius` (8 px). Ombres : `shadow-card`, `shadow-elevated`.

## Animations

| Token | Valeur | Utilitaire |
|---|---|---|
| `--motion-duration-fast` / `base` / `slow` | 150 / 250 / 450 ms | `duration-fast`, `duration-base`, `duration-slow` |
| `--motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | `ease-standard` |
| `--motion-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | `ease-out-soft` |

Animations d'entrée : `animate-fade-in`, `animate-slide-up`. Les animations des composants
Radix (menu mobile) utilisent `tw-animate-css`. Si l'utilisateur préfère réduire les
mouvements, toutes les animations et transitions sont neutralisées globalement.

## Composants

| Composant | Fichier | Points clés |
|---|---|---|
| `Button` | `ui/button.tsx` | variantes `primary`, `secondary`, `outline`, `ghost`, `link`, `inverse` ; tailles `sm`, `md`, `lg`, `icon` ; `asChild` pour les liens ; `loading` (`aria-busy`) |
| `Card` (+ `Header`, `Title`, `Description`, `Content`, `Footer`) | `ui/card.tsx` | variantes `default`, `elevated`, `inverse` ; `interactive` ; niveau de titre réglable (`as`) |
| `Input`, `Textarea`, `Label`, `Checkbox` | `ui/*.tsx` | bordures ≥ 3:1, état `aria-invalid` stylé |
| `FormField` | `ui/form-field.tsx` | relie label, description et erreur (`aria-describedby`, `aria-invalid`, `aria-required`, `role="alert"`) |
| `Sheet` | `ui/sheet.tsx` | panneau latéral (Radix Dialog) : focus piégé, Échap, retour du focus |
| `Logo`, `LogoMark` | `brand/logo.tsx` | ampoule D4I vectorisée et logotype « Dev4Innova » (« 4 » rouge, soulignement rouge) |
| `SiteHeader`, `MobileNav`, `NavLinks` | `layout/` | en-tête collant, `aria-current`, menu burger sous 1024 px, emplacement `localeSwitcher` |
| `SiteFooter` | `layout/site-footer.tsx` | pied de page sombre, colonnes de liens, mentions légales |
| `Container`, `Section` | `layout/` | mise en page standard |

### Exemples

```tsx
<Button asChild size="lg">
  <Link href="/contact">{t("cta")}</Link>
</Button>

<FormField label={t("email")} description={t("emailHelp")} error={errors.email} required requiredLabel={t("required")}>
  <Input type="email" name="email" autoComplete="email" />
</FormField>

<Section variant="inverse">
  <h2 className="text-display-md">{t("title")}</h2>
</Section>
```

## Logo

Le logo est vectorisé à partir du logo historique : ampoule au contour rouge sombre et noir,
monogramme D4I (« 4 » rouge), filament rouge, culot noir. Il existe en trois formes :
- `LogoMark` (SVG en ligne) ;
- `public/brand/dev4innova-mark.svg` (usage externe) ;
- `src/app/icon.svg` (favicon).

Le logotype « Dev4Innova » est rendu en texte (Space Grotesk), donc net et lisible par les
lecteurs d'écran. Si le fichier source officiel (SVG) est disponible, il remplace ces trois
fichiers sans modifier les composants.

## Tests

- **Vitest** (`pnpm --filter @dev4innova/web test`) :
  - contrastes des tokens ;
  - comportement des composants (variantes, clavier, menu mobile, `aria-current`, formulaires) ;
  - audits axe-core.
- **Playwright** (`make e2e`) à 375, 768 et 1280 px :
  - pas de défilement horizontal ;
  - navigation desktop ou burger selon la largeur ;
  - focus piégé et Échap dans le menu ;
  - lien d'évitement ;
  - cibles tactiles ;
  - `prefers-reduced-motion` ;
  - audit axe WCAG 2.1 AA en navigateur réel, contrastes compris.

  Les captures d'écran sont jointes au rapport (artefact `playwright-report` de la CI).
