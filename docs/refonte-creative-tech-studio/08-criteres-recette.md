# 08 — Critères de recette

Chaque critère est **vérifiable**, avec sa méthode. La refonte est acceptée quand tous les
critères bloquants sont verts.

## 1. Fonctionnel (bloquant)

| # | Critère | Méthode |
|---|---|---|
| F1 | Aucune route publique ou privée supprimée ou renommée | E2E `pages`, `i18n` et `auth` ; sitemap inchangé (même liste d'URL) |
| F2 | Parcours inchangés : contact, devis, diagnostic (jusqu'au rapport), inscription, connexion, espace client, Academy, portail, facturation, admin | Suite E2E complète verte |
| F3 | Contenus CMS (services, projets, articles, pages) affichés et administrables comme avant ; sections vides gérées sans « trou » | E2E CMS ; test de l'accueil avec un CMS vide et avec un CMS rempli |
| F4 | FR/EN complets : aucun texte en dur, parité des messages | Test de parité des messages (Vitest) ; revue |
| F5 | Aucune donnée fictive présentée comme réelle : témoignages, logos, chiffres, projets | Revue de contenu ; légende « données de démonstration » sur chaque capture |

## 2. Accessibilité, WCAG 2.2 AA (bloquant)

| # | Critère | Méthode |
|---|---|---|
| A1 | 0 violation axe (WCAG 2.0, 2.1 et 2.2 A/AA) sur l'accueil et les pages publiques, en FR et EN, aux 3 tailles | E2E `a11y` étendu (balises `wcag22aa`) |
| A2 | Contrastes : texte ≥ 4,5:1 (grands titres ≥ 3:1), composants d'interface ≥ 3:1 | `tokens.test.ts` et axe |
| A3 | Navigation clavier complète : ordre logique, focus visible partout, pas de piège, lien d'évitement | E2E `responsive` existants et parcours au clavier de l'accueil |
| A4 | Focus jamais masqué par l'en-tête collant (2.4.11) | Test : tabulation sur tous les liens de l'accueil, vérification de la boîte du focus |
| A5 | `prefers-reduced-motion` : aucune animation, état final immédiat | E2E « reduced motion » étendu à l'accueil |
| A6 | Un `h1` par page, hiérarchie des titres sans saut | E2E `pages` |
| A7 | Illustrations : décoratives masquées ; informatives dotées d'une alternative textuelle | Tests Vitest des illustrations |

## 3. Responsive (bloquant)

| # | Critère | Méthode |
|---|---|---|
| R1 | Aucun défilement horizontal de 320 px à 1 920 px | E2E à 320, 375, 768, 1 024, 1 280 et 1 920 px |
| R2 | Cibles tactiles ≥ 44 px sur mobile | E2E existant |
| R3 | Lisibilité : corps ≥ 16 px, lignes ≤ 80 caractères | Revue des captures |
| R4 | Variantes par écran conformes au doc 04 § 4 | Revue des captures, validée par vous |

## 4. Performance (bloquant sur budget, objectif p75 en production)

| # | Critère | Méthode |
|---|---|---|
| P1 | LCP ≤ 2,5 s ; local ≤ 1 s sur l'accueil | Test E2E de budget ; Lighthouse en profil mobile |
| P2 | CLS ≤ 0,1 ; local ≤ 0,02 | Test E2E de budget |
| P3 | INP ≤ 200 ms ; JavaScript ajouté ≤ 3 Ko gzip | Lighthouse (TBT comme indicateur), analyse du bundle |
| P4 | Accueil ≤ 450 Ko au chargement initial ; captures en lazy-load, en AVIF/WebP | Réseau Playwright |
| P5 | Score Lighthouse mobile : Performance ≥ 90, Accessibilité 100, Bonnes pratiques ≥ 95, SEO 100 | Lighthouse local, rapports joints |

## 5. SEO (bloquant)

| # | Critère | Méthode |
|---|---|---|
| S1 | Titre, description, canonique et hreflang conservés sur chaque page | E2E `pages` |
| S2 | JSON-LD `Organization` conservé, `WebSite` ajouté, valides | E2E et validateur schema.org |
| S3 | Image Open Graph présente (1 200 × 630) | E2E (balises `og:image`) |

## 6. Qualité du code (bloquant)

Lint sans avertissement, typecheck, Vitest, E2E complet, build de production, CI verte (7 jobs),
aucune dépendance d'exécution ajoutée, aucune valeur de couleur brute dans les composants.

## 7. Direction artistique (validation humaine)

| # | Critère |
|---|---|
| D1 | La page se reconnaît comme DEV4INNOVA : logo, rouge signature, filament |
| D2 | Pas de rendu « modèle SaaS » : composition asymétrique, rythme des surfaces, illustrations propres |
| D3 | Chaque illustration a un message identifiable (doc 05) |
| D4 | Le rouge est rare et signifiant (moins de 5 % de la surface) |
| D5 | Les animations sont discrètes, justifiées, jamais en boucle |

## 8. Résultats

Tableau à compléter en phase E (fin de L8) : statut de chaque critère, mesures, captures,
limitations et éventuelles régressions.
