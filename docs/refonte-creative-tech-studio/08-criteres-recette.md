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

## 8. Résultats (lot L8, 11/11/2026)

Recette réalisée sur `main` après la fusion des lots L1 à L7 (PR n° 24 à 30), en build de
production local. Pièces jointes dans `recette/` : captures de l'accueil à 320, 768, 1 280 et
1 920 px, rapports Lighthouse mobile et bureau. Captures de chaque lot : `captures/l1` à `l7`.

**Légende** : ✅ conforme ; ⚠️ conforme avec réserve ; 👤 validation humaine.

### Fonctionnel

| # | Statut | Mesure |
|---|---|---|
| F1 | ✅ | Aucune route supprimée ni renommée. Suites E2E `pages`, `i18n` et `auth` vertes ; test du sitemap inchangé et vert. |
| F2 | ✅ | Suite E2E complète : 231 tests verts (contact, devis, diagnostic jusqu'au rapport, inscription, connexion, espace client, Academy, portail, facturation, admin). |
| F3 | ✅ | Services, projets et articles toujours tirés du CMS. Accueil : services en liste éditoriale (test E2E) ; projets et articles affichés seulement s'il en existe (pas de section vide). Pages vides : `EmptyState`. Réserve de test : le rendu « CMS rempli » des projets et articles sur l'accueil n'a pas de test E2E, faute de données semées. |
| F4 | ✅ | Test de parité FR/EN et de syntaxe ICU vert ; aucun texte visible en dur (les libellés des illustrations passent par le namespace `Illustrations`). |
| F5 | ✅ | Aucun témoignage, logo client ni chiffre inventé. Les 8 captures montrent de vraies interfaces avec des données de démonstration, légendées « Interface réelle — données de démonstration » ; le radar d'exemple est légendé comme tel ; les engagements ont été validés au point de contrôle 2. |

### Accessibilité (WCAG 2.2 AA)

| # | Statut | Mesure |
|---|---|---|
| A1 | ✅ | axe (balises `wcag22aa`) : 0 violation sur toutes les pages publiques en FR et EN à 375, 768 et 1 280 px (E2E `a11y`), sur l'accueil de 320 à 1 920 px, et sur 9 pages connectées (espace client, admin). |
| A2 | ✅ | `tokens.test.ts` : 48 vérifications de contraste (thème clair et portée sombre). Lighthouse Accessibilité : 100. |
| A3 | ✅ | Lien d'évitement premier élément focalisable, menu mobile qui piège le focus et se ferme avec Échap (E2E `responsive`). Toutes les cartes cliquables n'ont qu'un lien focalisable. |
| A4 | ✅ | Nouveau test E2E : tabulation sur toute l'accueil, aucun élément focalisé masqué par l'en-tête collant (`scroll-padding-top`). |
| A5 | ✅ | E2E « reduced motion » : aucune révélation masquée, filament tracé immédiatement, animations neutralisées. |
| A6 | ✅ | Un seul `h1` par page (E2E `pages`) ; ordre des titres de l'accueil vérifié (E2E `home`). |
| A7 | ✅ | `illustrations.test.tsx` : illustrations `aria-hidden` et non focalisables, couleurs par variables uniquement, poids plafonné ; textes alternatifs descriptifs des captures. |

### Responsive

| # | Statut | Mesure |
|---|---|---|
| R1 | ✅ | Aucun défilement horizontal à 320, 375, 768, 1 280 et 1 920 px (E2E `responsive` et `chrome`). Le débordement de 7 px de l'en-tête à 320 px, antérieur à la refonte, est corrigé (lot L4). |
| R2 | ✅ | Cibles tactiles de 44 px au moins (E2E). |
| R3 | ✅ | Corps de texte à 16 px au moins ; chapôs limités à environ 70 caractères (`max-w-2xl`). |
| R4 | 👤 | Variantes conformes au doc 04 § 4, à une exception assumée : la méthode reste une liste verticale à côté de la boucle sur bureau (comme le prototype validé), au lieu d'une ligne horizontale. Captures dans `recette/`. |

### Performance

Mesures Lighthouse 12.8 sur l'accueil `/fr`, build de production local, avant (`f86d746`) et après la refonte :

| Mesure | Avant (mobile / bureau) | Après (mobile / bureau) |
|---|---|---|
| Score Performance | 91–93 / 100 | 91–97 / 100 |
| LCP (simulé) | 2,86–3,04 s / 0,65 s | 2,49–2,97 s / 0,69 s |
| CLS | 0 / 0 | 0 / 0 |
| TBT | 158–211 ms / 0 ms | 97–207 ms / 2–8 ms |
| Poids de la page | 352 / 380 Ko | 384 / 422 Ko |
| JavaScript transféré | 226,2 Ko | 230,2 Ko |

| # | Statut | Mesure |
|---|---|---|
| P1 | ⚠️ | LCP mesuré sans bridage (test E2E) : 480 ms sur bureau, 224 ms sur mobile, sous le budget local de 1 s. LCP simulé par Lighthouse en profil mobile (4G lente) : 2,5 à 3,0 s, **inchangé par rapport à avant la refonte** ; l'élément LCP est le `h1` et le temps de réponse du serveur local en représente environ 15 %. À confirmer en production (p75 des visiteurs). |
| P2 | ✅ | CLS : 0 sur bureau et mobile. |
| P3 | ⚠️ | TBT : 2 à 8 ms sur bureau, 97 à 207 ms en mobile simulé (comme avant). JavaScript ajouté : **4,0 Ko** transférés, au-dessus du budget de 3 Ko : la frontière client de `Reveal` (3,1 Ko, en-têtes HTTP compris) et quelques références dans les fichiers de page. |
| P4 | ✅ | 422 Ko au chargement initial sur bureau (budget 450 Ko). Les 4 captures (35 à 50 Ko chacune, WebP) sont chargées en différé. |
| P5 | ✅ | Lighthouse mobile : Performance 93, Accessibilité 100, Bonnes pratiques 100, SEO 100 (avec la configuration de production, voir S1). |

### SEO

| # | Statut | Mesure |
|---|---|---|
| S1 | ✅ | Titre, description, canonique et hreflang conservés (E2E `pages`). **Défaut trouvé et corrigé** : `robots.txt` est prérendu au build, mais `ALLOW_INDEXING` n'était pas transmis au build Docker (`infra/docker/web.Dockerfile`). En production, il interdisait donc probablement l'indexation. Ajout de `ARG ALLOW_INDEXING` ; vérifié en local : Lighthouse SEO passe de 61 à 100. **À vérifier après déploiement** : `https://www.dev4innova.com/robots.txt` doit contenir `Allow: /`. |
| S2 | ✅ | JSON-LD `Organization` et `WebSite` (E2E). Le validateur schema.org en ligne n'a pas été lancé (réseau restreint). |
| S3 | ✅ | Image Open Graph 1 200 × 630 générée par langue et déclarée sur toutes les pages publiques (E2E). |

### Qualité du code

✅ Lint sans avertissement, typecheck, Vitest (51 fichiers, 402 tests), E2E complet, build de
production ; CI verte (7 jobs) sur chaque PR des lots L1 à L7. Aucune dépendance ajoutée. Aucune
couleur brute dans les composants, à deux exceptions documentées : le logo (couleurs de marque
volontairement figées) et l'image Open Graph (le moteur de rendu n'a pas accès aux variables CSS).

### Direction artistique

| # | Statut | Commentaire |
|---|---|---|
| D1 | 👤 | Logo, rouge signature et filament présents dans le hero, les en-têtes, l'appel à l'action et l'image Open Graph. |
| D2 | 👤 | Composition asymétrique (5/12), alternance ivoire, glacier et graphite, grille Bento, illustrations propres. |
| D3 | 👤 | Chaque illustration porte un message (doc 05) ; vous les avez validées au point de contrôle 1. |
| D4 | 👤 | Le rouge reste réservé aux accents : boutons, filament, sur-titres, un seul accent par illustration. |
| D5 | 👤 | Animations uniques (filament, révélations), jamais en boucle, neutralisées en mouvement réduit. |

### Limitations et suites possibles

- **Capture des outils IA** : le bouton natif de choix de fichier est en anglais dans la version
  FR (Chromium sans pack de langue). Relancer `pnpm capture:products` sur un poste avec Chrome en
  français pour le corriger.
- **JavaScript** : réduire `Reveal` au-dessous de 3 Ko demanderait un script inline sans React ;
  gain d'environ 1 Ko, non prioritaire.
- **LCP mobile en production** : à suivre sur des données réelles de visiteurs ; piste si besoin,
  précharger la police des titres.
