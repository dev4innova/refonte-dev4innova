# Design system DEV4INNOVA

Identité : **« Creative Tech Studio »** (refonte 2026, `docs/refonte-creative-tech-studio/`),
fidèle au logo historique : graphite, ivoire, rouge signature, acier et glacier.
Positionnement : « DEV4INNOVA — L'intégrateur de solutions IA ».

Vitrine vivante de tous les tokens et composants : **`/fr/design-system`** et `/en/design-system` (page interne, non indexée).

## Principes

1. **Une seule source de vérité** : `apps/web/src/styles/tokens.css`. Les composants n'utilisent
   jamais de valeur brute (couleur hexadécimale, taille en px) : uniquement les utilitaires
   Tailwind générés depuis les tokens (`bg-primary`, `text-display-lg`, `px-gutter`…).
2. **Accessibilité WCAG 2.1 AA** : contrastes vérifiés automatiquement, navigation clavier, focus
   visible rouge, cibles tactiles ≥ 44 px, `prefers-reduced-motion` respecté.
3. **FR/EN** : aucun texte en dur dans `src/components/` ; tout libellé arrive par props, depuis
   les dictionnaires next-intl (`messages/{fr,en}.json`, voir `docs/rules/frontend.md`).
4. **Composants shadcn/ui** : code copié dans le dépôt (`src/components/ui`), basé sur Radix UI,
   adapté aux tokens. `components.json` permet d'en ajouter avec `pnpm dlx shadcn add <nom>`.

## Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `primary` | `#E11927` (rouge signature) | **aplats** : boutons (texte blanc), graphiques, grands titres. Jamais de petit texte sur fond clair |
| `primary-hover` | `#C8101E` | survol des aplats rouges |
| `primary-ink` / `primary-ink-hover` | `#C8101E` / `#A30D18` | **texte et liens rouges sur fond clair** (`text-primary-ink`) |
| `secondary` / `foreground` | `#141417` (graphite) | texte, boutons secondaires |
| `background` | `#F7F7F5` (ivoire) | fond de page |
| `card` | `#FFFFFF` | surfaces (cartes, champs, sections claires) |
| `muted` / `muted-foreground` | `#E2E3E7` / `#5F616C` (acier encre) | fonds neutres, textes secondaires |
| `tint` / `tint-subtle` / `tint-foreground` | `#DCE5F4` / `#EEF2FA` / `#141417` | surfaces « données et technologie » (glacier) |
| `accent` / `accent-foreground` | `#FDECEE` / `#A30D18` | mises en avant discrètes |
| `destructive` | `#A30D18` | erreurs |
| `success` / `warning` | `#1F7A4D` / `#8A5A00` | états (texte et icônes) |
| `border` / `input` | `#E2E3E7` / `#8B8D98` (acier) | séparateurs / bordures de champs (≥ 3:1) |
| `ring` | `#C8101E` | focus sur fond clair |
| `inverse` / `inverse-elevated` / `inverse-deep` | `#141417` / `#1E1F24` / `#0E0E10` | sections sombres, surfaces surélevées, pied de page |
| `inverse-foreground` / `inverse-muted-foreground` | `#F7F7F5` / `#8B8D98` | texte sur graphite |
| `primary-on-inverse` | `#FF4757` | rouge lisible sur graphite (texte, focus) |

**Règle du rouge** : `bg-primary` pour les aplats, `text-primary-ink` pour le texte rouge sur
fond clair, `text-primary-on-inverse` sur graphite. `text-primary` n'est permis que pour les
grands textes (≥ 24 px, ou ≥ 18,66 px en gras) et le « 4 » du logo.

Sur une surface sombre, ajoutez `data-variant="inverse"` (déjà posé par `Section variant="inverse"`
et le pied de page) : le focus passe au rouge clair et les variables d'illustration `--illu-*`
s'adaptent.

**Changer le rouge de marque** : modifier `--d4i-red-*` dans `tokens.css`, puis lancer
`pnpm --filter @dev4innova/web test` : `tokens.test.ts` vérifie que tous les contrastes restent
conformes.

### Contrastes (vérifiés par `src/styles/tokens.test.ts`)

| Combinaison | Ratio | Autorisé pour |
|---|---|---|
| Blanc sur `#E11927` | 4,81:1 | tout texte (boutons) |
| `#C8101E` sur ivoire / sur blanc | 5,52:1 / 5,92:1 | tout texte |
| `#E11927` sur ivoire | 4,48:1 | **grands textes et éléments d'interface uniquement** |
| `#5F616C` sur ivoire | 5,74:1 | tout texte (secondaire) |
| `#8B8D98` sur ivoire | 3,08:1 | bordures, illustrations ; **jamais de texte** |
| `#FF4757` sur `#141417` | 5,51:1 | tout texte sur fond sombre |
| `#8B8D98` sur `#141417` | 5,57:1 | texte secondaire sur fond sombre |

## Typographie

- **Space Grotesk** (`font-heading`) pour les titres, **Inter** (`font-sans`, par défaut) pour
  le texte. Auto-hébergées par `next/font` (`src/lib/fonts.ts`) : aucun appel à Google depuis
  le navigateur.
- Échelle fluide (`clamp()`), hauteur de ligne et interlettrage inclus :

| Utilitaire | Taille (mobile → desktop) | Usage |
|---|---|---|
| `text-display-2xl` | 44 → 96 px | titre du hero de l'accueil uniquement |
| `text-display-xl` | 40 → 76 px | titre de hero (un seul `h1`) |
| `text-display-lg` | 34 → 56 px | titres de page |
| `text-display-md` | 28 → 40 px | titres de section (`h2`) |
| `text-heading-lg` | 22 → 28 px | titres de carte (`h3`) |
| `text-heading-sm` | 18 px | sous-titres |
| `text-body-lg` | 17 → 20 px | chapeaux et introductions |
| `text-lg`, `text-base`, `text-sm` | 18, 16, 14 px | corps de texte |
| `text-eyebrow` | 13 px, interlettrage 0,18 em | sur-titres (en capitales) |

`font-numeric` aligne les chiffres (scores, étapes, tableaux).

## Espacements et mise en page

- Échelle Tailwind (base 4 px) pour les espacements internes.
- Tokens de mise en page fluides : `px-gutter` (16 → 40 px), `py-section` (64 → 128 px),
  `max-w-site` (1280 px), `h-header` (64 px).
- `py-section-tight` (48 → 96 px) pour les sections denses, `gap-bento` (12 → 20 px) pour la grille Bento.
- `Container` (largeur max et marges latérales) et `Section` (`default`, `card`, `muted`, `tint`, `inverse`).
- Points de rupture : `sm` 640, `md` 768, `lg` 1024 (navigation desktop), `xl` 1280.
- Rayons : `rounded-sm` → `rounded-xl` dérivés de `--radius` (12 px) ; `rounded-frame` (20 px) pour
  les cellules Bento et les cadres de produit. Ombres : `shadow-card`, `shadow-elevated`, `shadow-frame`.
- Lignes : `border-hairline` (acier à 22 %) pour les grilles et séparateurs fins ; `pattern-blueprint`
  pour la grille technique des sections sombres.

## Animations

| Token | Valeur | Utilitaire |
|---|---|---|
| `--motion-duration-fast` / `base` / `slow` | 150 / 250 / 450 ms | `duration-fast`, `duration-base`, `duration-slow` |
| `--motion-duration-draw` / `--motion-stagger` | 1 200 / 60 ms | tracé unique du filament du hero, décalage des révélations |
| `--motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | `ease-standard` |
| `--motion-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | `ease-out-soft` |

Animations d'entrée : `animate-fade-in`, `animate-slide-up`. Les animations des composants
Radix (menu mobile) utilisent `tw-animate-css`. Si l'utilisateur préfère réduire les
mouvements, toutes les animations et transitions sont neutralisées globalement.

Révélation au défilement : envelopper un bloc dans `Reveal` (seul îlot client des primitives,
environ 1 Ko). L'état masqué (`data-reveal="hidden"`) n'est posé qu'après l'hydratation, et
seulement pour un bloc encore hors de l'écran. Le contenu est donc lisible sans JavaScript, et
rien ne bouge en mouvement réduit. `step` décale une cascade de `--motion-stagger`.

## Composants

| Composant | Fichier | Points clés |
|---|---|---|
| `Button` | `ui/button.tsx` | variantes `primary`, `secondary`, `outline`, `ghost`, `link`, `inverse` et `signal-link` (lien éditorial rouge, flèche qui glisse au survol et au focus, cible de 44 px) ; tailles `sm`, `md`, `lg`, `icon` ; `asChild` pour les liens ; `loading` (`aria-busy`) |
| `Card` (+ `Header`, `Title`, `Description`, `Content`, `Footer`) | `ui/card.tsx` | variantes `default`, `elevated`, `inverse` et `frame` (filet acier, trait rouge au survol et au focus) ; `interactive` ; niveau de titre réglable (`as`) |
| `Input`, `Textarea`, `Label`, `Checkbox` | `ui/*.tsx` | bordures ≥ 3:1, état `aria-invalid` stylé |
| `NativeSelect` | `ui/native-select.tsx` | `<select>` natif au style des champs, utilisable dans `FormField` |
| `FormField` | `ui/form-field.tsx` | relie label, description et erreur (`aria-describedby`, `aria-invalid`, `aria-required`, `role="alert"`) |
| `Sheet` | `ui/sheet.tsx` | panneau latéral (Radix Dialog) : focus piégé, Échap, retour du focus |
| `Logo`, `LogoMark` | `brand/logo.tsx` | ampoule D4I vectorisée et logotype « Dev4Innova » (« 4 » rouge, soulignement rouge) |
| `SiteHeader`, `MobileNav`, `NavLinks` | `layout/` | en-tête collant, `aria-current`, menu burger sous 1024 px, emplacement `localeSwitcher` |
| `LocaleSwitcher` | `layout/locale-switcher.tsx` | FR / EN sur la même page, `aria-current`, `lang` et `hreflang` sur chaque lien |
| `SiteFooter` | `layout/site-footer.tsx` | pied de page sombre, colonnes de liens, mentions légales |
| `Container`, `Section` | `layout/` | mise en page standard. `Section` : surfaces `default`, `card`, `muted`, `tint`, `inverse` ; `spacing="tight"` ; `rule` (filet supérieur décoratif) |

### Primitives « studio » (`src/components/studio/`)

Composants de la refonte Creative Tech Studio. Ils sont rendus côté serveur, sauf `Reveal`.
Tous leurs textes arrivent par props.

| Composant | Fichier | Points clés |
|---|---|---|
| `Eyebrow` | `eyebrow.tsx` | sur-titre indexé (`01 Solutions`), rouge encre sur clair, rouge clair sur graphite ; `as="h2"` quand il nomme la section |
| `SectionHeading` | `section-heading.tsx` | sur-titre, titre (`id` pour `aria-labelledby`), chapô et actions ; composition 5/12 dès 1 024 px |
| `BentoGrid`, `BentoCell` | `bento-grid.tsx` | liste dont l'ordre du DOM est l'ordre de lecture ; 1, 6 puis 12 colonnes ; tailles `sm` (4), `md` (5), `lg` (7), `wide` (12) ; surfaces `card`, `tint`, `inverse`. Un lien `data-stretched` dans le titre rend toute la cellule cliquable, en restant le seul élément focalisable |
| `ProductFrame` | `product-frame.tsx` | cadre « fenêtre » d'une **capture réelle** (`next/image`, `alt` obligatoire), légende `demoLabel` obligatoire (« Démonstration »). Sans image, affiche ses enfants (squelette) |
| `Reveal` | `reveal.tsx` | voir « Animations » |
| `MethodTimeline`, `MethodLoop` | `method-timeline.tsx` | étapes en `<ol>` (titres `h3`, numéros décoratifs, livrable optionnel), dernier segment en pointillé rouge (retour au début) ; boucle SVG décorative aux couleurs `--illu-*` |
| `Tag`, `StatusDot`, `Kbd` | `micro.tsx` | étiquette (`neutral`, `tint`, `signal`), pastille d'état décorative (le statut est toujours écrit à côté), touche de clavier |

Règle de contenu : aucun `ProductFrame` ne montre une maquette ou un projet client inventé.
Seules les vraies interfaces construites par DEV4INNOVA y figurent, avec des données de
démonstration annoncées comme telles.

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

<Section aria-labelledby="home-solutions">
  <SectionHeading id="home-solutions" index="02" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
  <BentoGrid>
    <BentoCell size="lg">
      <h3><Link href="/solutions/ai-assistants" data-stretched>{t("item")}</Link></h3>
    </BentoCell>
  </BentoGrid>
</Section>
```

## Illustrations (`src/components/illustrations/`)

Inventaire et intentions : `docs/refonte-creative-tech-studio/05-plan-medias-illustrations.md`.
Ce sont des SVG écrits à la main, en composants serveur (0 Ko de JavaScript).

| Composant | Message | Variantes |
|---|---|---|
| `SignalToSystem` | Visuel signature « Du signal au système » : le filament de l'ampoule devient un circuit qui alimente trois modules (assistant, document, prévision). Tracé joué une fois (`illu-draw`), modules en fondu (`illu-fade-late`) | complète dès 640 px, `SignalToSystemCompact` en dessous |
| `SolutionIllustration slug=…` | Une illustration par solution : l'assistant qui **agit** (ticket CRM), les champs extraits et vérifiés, la prévision avec intervalle et alerte, le contenu dans votre ton validé par un humain, l'IA reliée à vos outils | mise à l'échelle |
| `LabBoard` | Innovation Lab : idée, prototype, module réutilisable | vignettes empilées sous 640 px |
| `AcademyPath` | Academy : modules, quiz, certificat vérifiable en ligne | mise à l'échelle |
| `MethodLoop` (`studio/`) | Méthode itérative : retour à « Explorer » après « Améliorer » | — |
| `IllustrationPanel` | Fond (`--illu-backdrop`) et rapport d'aspect réservé (`video`, `wide`, `square`) : aucun décalage de mise en page | — |

Règles, vérifiées par `illustrations.test.tsx` :
- **Décoratives** : `aria-hidden="true"` et `focusable="false"`. L'information est portée par
  le texte de la page (titre et résumé de la solution, liste des étapes…).
- **Couleurs** : uniquement `currentColor` et les variables `--illu-*` (`backdrop`, `stroke`,
  `stroke-soft`, `fill`, `ink`, `label`, `solid`, `on-solid`, `signal`), redéfinies sous
  `[data-variant="inverse"]`. Une même illustration fonctionne donc sur ivoire et sur graphite.
  Un seul accent rouge (`--illu-signal`) par illustration.
- **Libellés traduits** : namespace `Illustrations` de `messages/{fr,en}.json`, assemblés par
  `illustrationLabels(t)` (`labels.ts`) puis passés en props.
- **Poids** : au plus 8 Ko pour le visuel signature, 4 Ko pour une solution ou l'Academy, 6 Ko
  pour la planche du Lab (ses deux variantes). Aucun script, aucune ressource externe.
- **Mouvement réduit** : état final immédiat (règle CSS dédiée, délais compris).

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
