# 02 — Direction artistique : Creative Tech Studio

## 1. Positionnement visuel

DEV4INNOVA ne vend pas un logiciel : l'entreprise vend **sa capacité à concevoir et à
construire**. Le site doit donc se lire comme le travail d'un studio d'ingénierie : précis,
éditorial et démonstratif. Chaque visuel montre **comment** on pense un système d'IA (flux,
données, interfaces), jamais une illustration décorative interchangeable.

**Trois mots** : *précision* (grilles, filets fins, données), *matière* (sections graphite et
ivoire, grain discret, papier technique), *signal* (le rouge signature, rare, qui marque
l'action et le point d'attention).

**À éviter** :
- les dégradés violet-bleu, le verre dépoli partout, les orbes floutés ;
- les illustrations 3D génériques, les mosaïques de logos clients inventés ;
- les compteurs de chiffres, les animations en boucle.

## 2. Ancrage de marque

- **Le logo historique** (ampoule et monogramme D4I) reste la signature. Son **filament** devient
  le motif graphique du système : une ligne continue qui part de l'idée (l'ampoule) et devient
  un circuit, puis une interface. On le retrouve dans :
  - le hero ;
  - les séparateurs de section ;
  - l'état de focus des cartes Bento (filet rouge qui se dessine).
- **Le « 4 » rouge** du monogramme justifie un usage typographique du rouge : un seul mot ou un
  seul glyphe rouge par titre au maximum, par exemple « L'intégrateur de solutions **IA** ».

## 3. Palette

| Rôle | Nom | Valeur | Usage |
|---|---|---|---|
| Fond sombre | **Graphite** | `#141417` | Hero, sections immersives, pied de page, cadres de produit |
| Surface sombre élevée | Graphite 2 | `#1E1F24` | Cartes sur fond sombre (ivoire dessus : 15,3:1) |
| Fond clair | **Ivoire** | `#F7F7F5` | Fond par défaut du site |
| Surface claire | Blanc | `#FFFFFF` | Cartes, formulaires |
| Signal | **Rouge signature** | `#E11927` | Aplats (boutons primaires, texte blanc 4,81:1), éléments graphiques, grands titres |
| Signal, texte sur clair | Rouge encre | `#C8101E` | Liens et texte rouge sur ivoire et blanc (5,52:1) |
| Signal, texte sur sombre | Rouge lumière | `#FF4757` | Liens, sur-titres et focus sur graphite (5,51:1) |
| Neutre | **Gris acier** | `#8B8D98` | Bordures, traits d'illustration, texte secondaire **sur graphite** (5,57:1) |
| Neutre, texte sur clair | Acier encre | `#5F616C` | Texte secondaire sur ivoire (5,74:1) et sur glacier (4,85:1) |
| Teinte froide | **Glacier** | `#DCE5F4` | Surfaces « données et technologie » (Solutions, Academy), fonds d'illustration, état sélectionné |

Les contrastes ont été calculés selon la formule WCAG 2.x. **Le rouge #E11927 n'est jamais
utilisé pour du texte courant sur fond clair** (4,48:1, sous le seuil de 4,5:1) : c'est le rôle
du rouge encre. Le rouge reste rare, **moins de 5 % de la surface d'un écran**.

**Rythme des surfaces** de la page d'accueil : graphite (hero), ivoire, glacier (Solutions),
graphite (Réalisations et produits), ivoire, ivoire et glacier (Lab et Academy), graphite
(contact et pied de page). Jamais deux sections sombres de suite, hors appel à l'action et pied
de page.

## 4. Typographie

| Usage | Police | Graisse | Détails |
|---|---|---|---|
| Titres éditoriaux | **Space Grotesk** | 500 et 600 (700 pour le hero) | Approche serrée (-0,035 em sur les grandes tailles), césure désactivée, `text-wrap: balance` |
| Interface et texte | **Inter** | 400, 500 et 600 | 16 à 18 px pour le corps, interlignage de 1,6, longueur de ligne de 60 à 72 caractères |
| Sur-titres et étiquettes techniques | Space Grotesk | 500, capitales, +0,18 em | Préfixés d'un index (`01 —`, `02 —`) : registre de « dossier technique » |
| Données (scores, étapes, codes) | Inter, `tabular-nums` | 500 | Les chiffres s'alignent dans les visualisations |

L'échelle fluide existe déjà (`text-display-xl` à `text-heading-sm`). On y ajoute :
- **`display-2xl`** pour le hero : `clamp(2.75rem, 1.2rem + 6.4vw, 6rem)` ;
- **`body-lg`** pour les chapôs.

## 5. Grilles et composition

- Grille de 12 colonnes, largeur maximale de **1 280 px** (inchangée), gouttières fluides.
- **Asymétrie maîtrisée** : les en-têtes de section occupent 5 colonnes sur 12, à gauche, et le
  contenu démarre en décalé. Le hero est en 7/5 (texte et visuel).
- **Bento** pour les Solutions et les produits : des cellules de tailles différentes, choisies
  par l'importance du contenu et non au hasard. Une grande cellule par grille, au plus.
- **Filets et repères** : lignes de 1 px en acier (10 à 20 % d'opacité), croix de repérage aux
  angles des cadres de produit. Ce vocabulaire de dessin technique sert de signature discrète.

## 6. Iconographie et illustrations

- **Icônes** : lucide (déjà présent), trait de 1,5 px, couleur `currentColor`. Pas de pastilles
  colorées derrière les icônes, contrairement à aujourd'hui.
- **Illustrations** : SVG originaux en trait (1,5 px, acier ou ivoire selon le fond) avec un seul
  accent rouge par illustration, le « signal ». Style schéma d'architecture et interface
  abstraite. Pas de personnages, pas de robots, pas de cerveaux lumineux.
- **Captures de produits** : vraies interfaces de la plateforme, dans un cadre « fenêtre »
  graphite, avec données de démonstration étiquetées. Détails dans
  `05-plan-medias-illustrations.md`.

## 7. Mouvement

Principe : **le mouvement explique, il ne décore pas**.
- Une seule animation narrative, celle du hero : le filament se dessine, une fois, au chargement.
- Révélations au défilement sobres : fondu et translation de 12 px, en 450 ms, en cascade de
  60 ms au plus.
- Micro-interactions au survol et au focus :
  - le filet rouge des cartes se dessine en 250 ms ;
  - la flèche des liens se décale de 4 px ;
  - les boutons s'enfoncent de 1 px.
- Aucune animation infinie, aucun effet de parallaxe sur le défilement, aucun curseur
  personnalisé.
- `prefers-reduced-motion` : tout est statique et l'état final est affiché d'emblée. La règle
  globale existe déjà.

## 8. Ton éditorial (textes FR/EN)

Concret, sobre, orienté résultat et vérifiable. Pas de superlatifs non prouvés (« leader »,
« n°1 ») ni de chiffres sans source. Les textes actuels sont conservés autant que possible, ce
qui préserve les tests et la cohérence FR/EN. Les nouveaux blocs sont proposés dans
`04-architecture-homepage.md`.
