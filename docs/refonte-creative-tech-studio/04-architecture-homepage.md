# 04 — Architecture de la nouvelle page d'accueil

Prototype visuel : `prototype/index.html` (fichier autonome, à ouvrir dans un navigateur) et
captures `prototype/captures/` aux formats bureau, tablette et mobile.

## 1. Ajustements argumentés de la structure demandée

| Demande | Ajustement proposé | Raison |
|---|---|---|
| 4. Réalisations : « projets réels et résultats vérifiés » | **« Réalisations » devient double** : (a) les **produits construits par DEV4INNOVA**, visibles en captures réelles de la plateforme (Diagnostic IA, outils IA, portail client, Academy) ; (b) les **projets clients publiés dans le CMS**, affichés **seulement s'il en existe** | Le portfolio du CMS est vide aujourd'hui et toute donnée fictive est exclue. Les produits de la plateforme sont de vraies réalisations, démontrables et vérifiables : c'est la preuve la plus forte disponible. |
| 6. Diagnostic IA en 6ᵉ position | **Remonté en 3ᵉ position**, juste après la proposition de valeur, sous forme d'aperçu interactif : radar de démonstration, cinq axes, appel à l'action | C'est la seule expérience interactive publique et l'outil de conversion le plus engageant. Il prouve le savoir-faire IA dès le début. |
| 2. Proposition de valeur et section « Cadrer, Construire, Faire vivre » | **Fusionnées** dans une proposition de valeur en trois engagements, et la redondance avec la Méthode est supprimée | La page actuelle dit deux fois la même chose : section Piliers et section Démarche. |
| 7. Méthodologie : Explorer, Prototyper, Industrialiser, Améliorer | Gardée telle quelle. La 4ᵉ étape s'appelle aujourd'hui « Déployer et améliorer » dans les messages : on la renomme **« Améliorer »**, avec le même texte | Formulation demandée, plus concise. |
| — | **Ajout** d'une bande « Engagements » sobre et factuelle : hébergement en UE, données non utilisées pour l'entraînement, code et accès sécurisés, transfert de compétences | Elle remplace les témoignages et logos qu'on ne peut pas montrer. Ce sont des faits vérifiables, portés par l'architecture (ADR-0018 et ADR-0019) et la politique de confidentialité. **À valider** : chaque formulation doit correspondre à vos engagements contractuels. |
| — | Les **Insights** (derniers articles du CMS) apparaissent en option, seulement s'il existe au moins deux articles publiés dans la langue | Pas de section vide. |

## 2. Structure finale (ordre de lecture = ordre du DOM)

| # | Section | Surface | Contenu | Données |
|---|---|---|---|---|
| 0 | En-tête | Graphite translucide, en superposition sur le hero | Logo, navigation, FR/EN, compte, bouton « Nous contacter » | config |
| 1 | **Hero** | Graphite | Sur-titre « Studio d'ingénierie IA », `h1` « L'intégrateur de solutions IA » (texte conservé), chapô, deux appels à l'action (*Parler de votre projet*, *Faire le diagnostic IA*), **visuel signature** « Du signal au système » | messages |
| 2 | **Proposition de valeur** | Ivoire | Titre « Une seule équipe, de l'idée à la production », trois engagements (Cadrer, Construire, Faire vivre), chacun avec un pictogramme et une phrase de preuve | messages |
| 3 | **Diagnostic IA** | Ivoire, carte graphite | Aperçu : radar SVG de démonstration (légendé « Exemple de résultat »), cinq axes listés, durée de 5 minutes, appel à l'action | messages et composant radar existant |
| 4 | **Solutions IA** | Glacier | Grille Bento de 5 cellules, chacune avec son **illustration propre** : Assistants (cellule large), Documents, Données, Contenus, Intégration. Lien vers chaque page solution. | config et messages |
| 5 | **Réalisations** | Graphite | (a) 3 ou 4 **produits de la plateforme** en `ProductFrame`, avec de vraies captures et la légende « Démonstration » ; (b) projets du CMS s'ils sont publiés, avec couverture et `attributes` (client, secteur, résultat) | captures et CMS |
| 6 | **Services** | Ivoire | Liste éditoriale : numéro, titre, résumé, flèche. Liste plutôt que cartes, pour casser le rythme. État vide géré. | CMS |
| 7 | **Méthode** | Ivoire, filet de rupture | `MethodTimeline` : 4 étapes sur un tracé en boucle (Explorer, Prototyper, Industrialiser, Améliorer), avec les livrables de chaque étape | messages |
| 8 | **Engagements** | Ivoire | Quatre faits courts, avec icônes au trait | messages, **à valider** |
| 9 | **Innovation Lab et Academy** | Graphite et glacier, côte à côte | Deux univers distincts. **Lab** : planche d'expériences (idée, prototype, module). **Academy** : parcours avec modules, quiz et certificat vérifiable. | messages, et catalogue Academy si disponible |
| 10 | **Contact** | Graphite | Panneau de conversion à deux voies, *Parler de votre projet* et *Diagnostic gratuit*, plus le lien vers le devis | messages |
| 11 | **Pied de page** | Graphite profond | Grand mot-symbole, navigation complète (Offre, Innovation, Entreprise), mentions, confidentialité, FR/EN | config |

En option, une section **Insights** se place entre 9 et 10 (rendu conditionnel).

## 3. Détail des sections clés

### 3.1 Hero (bureau : 7 colonnes de texte, 5 de visuel)
- **Texte** :
  - sur-titre `Studio d'ingénierie IA — Conseil · Développement · Intégration` ;
  - `h1` avec le mot « IA » en rouge signature (grand titre : ratio 3,83:1 sur graphite,
    au-dessus des 3:1 exigés pour un titre de cette taille) ;
  - chapô inchangé.
- **Appels à l'action** : primaire rouge « Parler de votre projet » (`/contact`), secondaire en
  contour clair « Faire le diagnostic IA » (`/diagnostic-ia`).
- **Visuel « Du signal au système »** : le filament de l'ampoule se prolonge en circuit et
  relie trois modules d'interface abstraits : Assistant, Document et Tableau de bord. Il dit
  « de l'idée au système en production ».
  - SVG en ligne, d'environ 6 Ko ;
  - tracé animé une seule fois (1,2 s), état final immédiat si le mouvement est réduit ;
  - masqué sur mobile en dessous de 640 px, où une **variante compacte** est placée sous les
    appels à l'action.
- **LCP** : c'est le `h1` (texte), donc il n'est pas retardé par le visuel.

### 3.2 Diagnostic IA
- Carte graphite à deux colonnes : à gauche le texte, les cinq axes (Stratégie, Données,
  Technologie, Compétences, Gouvernance) et l'appel à l'action ; à droite le radar de
  démonstration.
- Le radar affiche des valeurs d'exemple, avec la mention visible « Exemple de résultat ». Ce
  n'est pas une donnée client.

### 3.3 Solutions (Bento, 12 colonnes)

```
┌──────────────────────────┬─────────────┐
│ Assistants et agents IA  │ Automatisa- │
│ (illustration conversa-  │ tion docu-  │
│ tion et outils, 7 col.)  │ mentaire    │
├─────────────┬────────────┴─────────────┤
│ Analyse et  │ IA générative (contenus) │
│ prédiction  │                          │
├─────────────┴──────────────────────────┤
│ Intégration dans vos outils (wide)     │
└────────────────────────────────────────┘
```

- Tablette : 6 colonnes, 2 par ligne, l'intégration en pleine largeur. Mobile : 1 colonne.
- Toute la cellule est cliquable, le lien porté par le titre. Focus visible : filet rouge et
  contour.

### 3.4 Réalisations, partie produits

Quatre cadres, chacun avec un titre, une phrase et un lien vers la fonctionnalité publique
quand elle existe :

| Produit | Lien public |
|---|---|
| Diagnostic de maturité IA | `/diagnostic-ia` |
| Outils IA sécurisés (assistant, analyse de documents) | pas de lien public : renvoi vers `/contact` |
| Portail client (projets, livrables, support) | pas de lien public : renvoi vers `/contact` |
| Academy (formations, quiz, certificats vérifiables) | `/academy` |

Chaque capture porte la légende **« Interface réelle — données de démonstration »**.

## 4. Variantes par écran

| Section | Bureau (≥ 1 024 px) | Tablette (768 px) | Mobile (320 à 639 px) |
|---|---|---|---|
| Hero | 7/5, visuel complet | Texte puis visuel en pleine largeur | Texte, appels à l'action empilés, visuel compact |
| Valeur | 3 colonnes | 3 colonnes | Empilé |
| Diagnostic | 2 colonnes | 2 colonnes | Radar sous le texte |
| Solutions | Bento de 12 colonnes | 2 colonnes | 1 colonne, illustration en haut de cellule |
| Réalisations | Grille 2 × 2 de cadres | 2 × 2 | 1 colonne, captures recadrées |
| Méthode | Ligne horizontale en boucle | 2 × 2 | Liste verticale avec tracé à gauche |
| Lab et Academy | 2 colonnes | 2 colonnes | Empilé |
| Contact | 2 voies côte à côte | Côte à côte | Empilé |

## 5. Messages FR/EN

Tous les textes nouveaux ou modifiés sont ajoutés dans `messages/{fr,en}.json` (namespace
`Home`). Le `h1` existant est conservé, et les tests E2E qui le vérifient restent valides. Le
prototype contient la version FR ; la version EN sera rédigée à la phase D, avec la même
structure.
