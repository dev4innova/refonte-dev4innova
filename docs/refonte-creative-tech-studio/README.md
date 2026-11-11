# Refonte « Creative Tech Studio » — dossier de conception

Phases A (audit) et B (conception). **Aucun code de production n'a été modifié** : le
développement (phase D) attend votre validation.

| Document | Contenu |
|---|---|
| [01 — Audit de l'existant](01-audit-existant.md) | Socle technique, structure, rendu actuel, contenus réels, risques |
| [02 — Direction artistique](02-direction-artistique.md) | Positionnement, palette (contrastes calculés), typographie, grilles, illustrations, mouvement |
| [03 — Design system](03-design-system.md) | Tokens (avant/après), composants existants et nouveaux, états, responsive |
| [04 — Architecture de la page d'accueil](04-architecture-homepage.md) | Ajustements argumentés, 11 sections, variantes par écran |
| [05 — Plan des médias et illustrations](05-plan-medias-illustrations.md) | 13 visuels avec objectif, technique et poids ; captures réelles ; refus argumentés (3D, vidéo, Lottie) |
| [06 — Architecture technique](06-architecture-technique.md) | Arborescence, animations, accessibilité, budget de performance, SEO, tests |
| [07 — Plan d'implémentation](07-plan-implementation.md) | 8 lots, environ 11,5 jours, points de validation |
| [08 — Critères de recette](08-criteres-recette.md) | Critères vérifiables : fonctionnel, WCAG 2.2 AA, responsive, performance, SEO |

## Prototype visuel

- **Fichier** : `prototype/index.html`. Il est autonome : ouvrez-le dans un navigateur, aucun
  serveur n'est nécessaire, polices et visuels sont inclus.
- **Captures** : `prototype/captures/accueil-desktop.webp` (1 440 px),
  `accueil-tablet.webp` (834 px) et `accueil-mobile.webp` (390 px).
- **Rendu actuel, pour comparaison** : `audit/home-desktop.webp` et `audit/home-mobile.webp`.
- **Capture réelle** : `prototype/media/diagnostic-resultat.png` est la vraie page de
  résultat du Diagnostic IA, obtenue en remplissant le questionnaire en local (données de
  démonstration). Les trois autres emplacements produits sont **signalés comme à capturer**
  (lot L6) : rien n'est inventé.

### Contrôles effectués sur le prototype

| Contrôle | 1 440 px | 834 px | 390 px | 320 px |
|---|---|---|---|---|
| axe (WCAG 2.0, 2.1 et 2.2 A/AA) | 0 violation | 0 | 0 | 0 |
| Défilement horizontal | aucun | aucun | aucun | aucun |
| LCP (local, fichier) | 84 ms | 72 ms | 92 ms | 76 ms |
| CLS | 0 | 0 | 0 | 0,054 (changement de police) |

À 320 px, le CLS de 0,054 vient du changement de police au chargement (`font-display: swap`
sans police de repli ajustée). En production, `next/font` génère des polices de repli
ajustées, ce qui supprime ce décalage. Ce point est vérifié par le critère P2.
