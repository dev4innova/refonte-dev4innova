# 05 — Plan des médias et des illustrations

Règle : **chaque visuel a un objectif de communication**. Pas de visuel « pour décorer ».
Format par défaut : SVG en composant React serveur, sans requête réseau, coloré par les tokens
via `currentColor` et les variables CSS.

## 1. Inventaire

| # | Visuel | Emplacement | Message | Technique | Poids cible | Mobile |
|---|---|---|---|---|---|---|
| 1 | **« Du signal au système »** (signature) | Hero | De l'idée (l'ampoule de la marque) au système en production | SVG en ligne, tracé `stroke-dashoffset` joué une fois | ≤ 8 Ko | Variante compacte : filament et un seul module |
| 2 | Assistants et agents | Bento Solutions | Un assistant qui répond **et agit** dans les outils (appel d'outil visible) | SVG : bulles, puce « outil : CRM », trace d'exécution | ≤ 4 Ko | même SVG, mis à l'échelle |
| 3 | Automatisation documentaire | Bento | Un document dont les champs sont extraits et vérifiés | SVG : page, zones surlignées, champs extraits cochés | ≤ 4 Ko | idem |
| 4 | Analyse et prédiction | Bento | Données historiques puis prévision avec intervalle | SVG : courbe, bande de confiance, point d'alerte rouge | ≤ 3 Ko | idem |
| 5 | IA générative et contenus | Bento | Un contenu produit dans **votre ton**, validé par un humain | SVG : blocs de texte, curseur de ton, bouton « Valider » | ≤ 3 Ko | idem |
| 6 | Intégration dans vos outils | Bento (large) | L'IA branchée sur CRM, ERP, messagerie et intranet | SVG : moyeu central et connecteurs étiquetés | ≤ 4 Ko | étiquettes réduites |
| 7 | Radar du diagnostic (exemple) | Section Diagnostic | Résultat sur 5 axes | **Composant existant** `RadarChart`, valeurs d'exemple étiquetées | 0 (existant) | sous le texte |
| 8 | Captures de produits (×4) | Réalisations | Interfaces réellement développées | **PNG vers AVIF/WebP** via `next/image`, dans `ProductFrame` | ≤ 60 Ko chacune (AVIF, 1 200 px) | `sizes` adaptés, recadrage |
| 9 | Boucle de méthode | Méthode | Itératif : on revient à Explorer après Améliorer | SVG : tracé en boucle à 4 jalons | ≤ 3 Ko | tracé vertical |
| 10 | Planche Innovation Lab | Lab | Exploration, prototype, module réutilisable | SVG : 3 vignettes reliées, croquis puis maquette puis composant | ≤ 4 Ko | 3 vignettes empilées |
| 11 | Parcours Academy | Academy | Formation en modules, quiz, certificat vérifiable | SVG : chemin à étapes, médaille avec code de certificat | ≤ 4 Ko | idem |
| 12 | Motif de grille technique | Fonds sombres | Signature « dessin technique » | CSS `background-image` (dégradés linéaires de 1 px) | 0 | densité réduite |
| 13 | Image Open Graph | Partage social | Mot-symbole, accroche et filament | `opengraph-image.tsx` (Next, généré au build) | — | — |

**Total des illustrations SVG** : environ 45 Ko non compressés, soit moins de 12 Ko transférés
en Brotli, intégrés au HTML. Les captures ne sont chargées qu'à l'approche (`loading="lazy"`,
sous la ligne de flottaison).

## 2. Captures de produits réels (Réalisations)

- **Source** : la plateforme elle-même, en local ou en recette, avec des **données de
  démonstration** :
  - organisation « Démo SA » ;
  - contenus factices **étiquetés comme tels** : légende « Interface réelle — données de
    démonstration ».
- **Production** : script Playwright `scripts/capture-products.mjs`, reproductible :
  - mêmes cadrages à chaque version ;
  - largeur de 1 440 px, `deviceScaleFactor` 2 ;
  - export en PNG, puis conversion en AVIF et WebP par `next/image`.
- **Écrans prévus** :
  1. le résultat d'un diagnostic (radar et recommandations) ;
  2. le hub des outils IA (assistant en conversation, analyse de document) ;
  3. un projet du portail client (jalons, livrables à valider) ;
  4. une leçon de l'Academy et la page publique de vérification d'un certificat.
- **Accessibilité** : un `alt` descriptif par capture (FR/EN) qui dit ce que montre l'écran, pas
  seulement son nom.
- **Interdits** :
  - aucun faux nom de client ni faux chiffre d'affaires ;
  - aucune donnée personnelle réelle ;
  - aucune capture de produit tiers.

### Produire ou mettre à jour les captures (lot L6)

Le script crée les données de démonstration par l'API puis prend les captures. Il **refuse
tout autre hôte que `localhost`**, car il crée des comptes et des contenus.

1. Démarrer la pile locale : `make services` (PostgreSQL, Redis, MinIO), `make api-dev`, puis
   l'application web (`pnpm --filter @dev4innova/web build && pnpm --filter @dev4innova/web start`).
2. Créer un compte sur le site local, puis lui donner le rôle `staff_admin` :
   `make grant-staff email=... role=staff_admin`.
3. Lancer depuis `apps/web` :
   `CAPTURE_STAFF_EMAIL=... CAPTURE_STAFF_PASSWORD=... pnpm capture:products`
   (`CAPTURE_WEB_URL` et `CAPTURE_API_URL` si les ports diffèrent de 3000 et 8000).

Données créées, toutes fictives et réutilisées d'une exécution à l'autre : le compte
« Camille Démo » (`camille.demo@demo.dev4innova.com`), l'organisation « Démo SA », le projet
« Assistant du service client » avec cinq étapes et un livrable à valider (nécessite MinIO ;
sans lui, le livrable est omis avec un avertissement), la formation publique « L'IA générative
au quotidien » suivie jusqu'au certificat, et un diagnostic déverrouillé par langue.

Résultat : `apps/web/public/captures/{diagnostic,ai-tools,portal,academy}-{fr,en}.webp`
(1 600 × 1 000, 35 à 50 Ko). L'en-tête et le pied de page du site sont masqués : seule
l'interface du produit apparaît. Les contrôles natifs du navigateur (bouton de choix de
fichier) suivent la langue de Chromium : avec un Chromium sans le pack de langue français,
ils restent en anglais.

## 3. Projets clients (CMS)

Quand vous publierez un projet dans le CMS (type `project`), la section Réalisations l'affichera
automatiquement avec :
- sa couverture (médiathèque, servie par l'API) ;
- ses `attributes`. Convention proposée, à valider : `client`, `sector`, `result`, `year`. Le
  champ `result` n'est affiché que s'il est renseigné : c'est **vous** qui garantissez sa
  véracité.

## 4. Règles de production des SVG

- `viewBox` fixe et dimensions intrinsèques réservées par `aspect-ratio` en CSS, donc aucun CLS.
- `aria-hidden="true"` sur les illustrations décoratives. Quand une illustration porte une
  information (le radar, la boucle de méthode), son équivalent textuel est présent dans le DOM :
  liste des axes, liste ordonnée des étapes.
- Couleurs : uniquement `currentColor` et les variables `--illu-stroke`, `--illu-fill` et
  `--illu-signal`, qui s'adaptent aux surfaces claires et sombres.
- Traits de 1,5 px (`vector-effect: non-scaling-stroke`), extrémités arrondies, grille de 8 px.
- Optimisés à la main (pas d'export Figma brut), relus. Aucun script et aucune image externe
  dans les SVG.

## 5. Ce qui n'est pas retenu

- **Bibliothèque 3D (Three.js, Spline)** : de 150 à 600 Ko de JavaScript, LCP et INP dégradés
  sur mobile, pour un apport de communication faible face à des schémas explicites. Non retenu.
- **Vidéo d'arrière-plan** : poids, consommation de données et accessibilité. Non retenu.
- **Images génératives** (« IA ») : risque d'aspect générique, et incohérent avec l'exigence
  d'authenticité. Non retenu.
- **Lottie** : dépendance de plusieurs dizaines de Ko pour des effets que CSS et SVG font nativement. Non
  retenu.
