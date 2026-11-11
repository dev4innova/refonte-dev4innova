# 07 — Plan d'implémentation (phase D, après validation)

Branche dédiée : `feat/redesign-creative-tech-studio`, créée depuis `main` après votre accord.
Une PR par lot, revue et CI verte avant le lot suivant. **Aucune fusion sans votre
validation.**

| Lot | Contenu | Livrable vérifiable | Estimation |
|---|---|---|---|
| **L1 — Fondations** | Tokens (palette, typographie, rayons, ombres, mouvement), correspondance Tailwind, tests de contraste étendus, vitrine `/design-system` mise à jour | Vitrine à jour ; admin et portail repassés en axe ; captures avant et après | 1 j |
| **L2 — Primitives** | `Eyebrow`, `SectionHeading`, `BentoGrid`, `ProductFrame`, `Reveal`, `MethodTimeline`, évolutions de `Button`, `Card` et `Section` | Tests Vitest des composants ; vitrine | 1,5 j |
| **L3 — Illustrations** | Les 11 SVG (doc 05), variantes compactes, variables `--illu-*` | Planche de toutes les illustrations sur la vitrine (clair et sombre) | 2 j |
| **L4 — En-tête et pied de page** | Variante `overlay` sur le hero, lien actif, pied de page enrichi | Tests de navigation et de menu mobile verts | 0,5 j |
| **L5 — Page d'accueil** | Les 11 sections, messages FR/EN, rendus CMS vides, JSON-LD `WebSite`, image OG | E2E accueil (ordre, liens, 320 px, mouvement réduit, axe FR/EN, budget LCP/CLS) | 2 j |
| **L6 — Captures de produits** | `scripts/capture-products.mjs`, organisation de démonstration, 4 captures et leur `alt` FR/EN | Captures relues par vous avant publication | 1 j |
| **L7 — Pages publiques secondaires** | `PageHeader` illustré et rythme de sections pour Solutions (liste et détail), Services, Portfolio, Innovation Lab, Academy (catalogue), Insights, À propos, Contact, Devis, Diagnostic. Le contenu reste inchangé. | Tests `pages`, `a11y` et `responsive` verts ; captures | 2,5 j |
| **L8 — Contrôle qualité** | Lint, types, Vitest, E2E complet, build, axe, Lighthouse avant/après, captures 320 / 768 / 1 280 / 1 920 px, revue des pages connectées | Rapport de recette (doc 08 complété) | 1 j |

**Total estimé** : environ 11,5 jours de travail effectif, livrés par lots.

## Ordre et dépendances

```
L1 → L2 → L3 ─┬→ L5 → L6 → L7 → L8
              └→ L4 ┘
```

## Points de contrôle avec vous

1. **Après L1 et L3** : validation de la palette appliquée et des illustrations sur la vitrine.
2. **Après L5** : validation de l'accueil sur une URL de recette, si vous ouvrez un
   environnement Railway `staging`, ou sinon avec des captures.
3. **Après L6** : validation des captures de produits et de leurs légendes.
4. **Après L8** : décision de mise en production. Fusion dans `main`, puis déploiement
   automatique.

## Gestion des risques pendant le développement

- **Tokens partagés avec l'admin** : L1 est livré seul, avec des captures de l'admin et du
  portail, avant toute autre évolution.
- **Retour arrière** : chaque lot est une PR indépendante, annulable par un revert.
- **Textes** : le `h1` de l'accueil est conservé. Toute modification de texte visible passe par
  les messages FR/EN, avec le test de parité.
