# ADR-0010 — CMS intégré, Markdown et stockage objet des médias

- **Statut** : Proposé (choix du format, du stockage et du périmètre validés par le responsable
  du projet le 2026-11-07 ; ADR à accepter formellement)
- **Date** : 2026-11-07
- **Tâches liées** : TASK-058 → TASK-066

## Contexte
Le site corporate (EPIC 05) a besoin de contenus éditables sans déploiement : articles
(Insights), études de cas (Portfolio), services, pages libres (mentions légales,
confidentialité), médias et métadonnées SEO, en français et en anglais. Les textes d'interface
et les Solutions restent dans `messages/{fr,en}.json` (next-intl).

## Options étudiées
| Option | Pour | Contre |
|---|---|---|
| **CMS intégré à l'API** ✅ | une seule base, mêmes rôles et isolation (ADR-0006), pas de service à exploiter | éditeur et workflow à construire |
| CMS headless (Strapi, Payload, Directus) | éditeur riche prêt à l'emploi | second back-office, seconde gestion des comptes, synchronisation des rôles |
| SaaS (Contentful, Sanity) | aucune exploitation | coût, données hors de notre base, dépendance fournisseur |

| Format | Pour | Contre |
|---|---|---|
| **Markdown + aperçu** ✅ | simple, diffable, rendu côté serveur maîtrisé | moins visuel qu'un WYSIWYG |
| Éditeur riche (blocs JSON) | confort de rédaction | dépendance lourde, rendu à reconstruire côté web |

| Médias | Pour | Contre |
|---|---|---|
| **Stockage objet S3** ✅ (MinIO en local) | standard, CDN possible, indépendant des conteneurs | un service de plus en local |
| Disque local de l'API | aucun service | perdu au redéploiement, pas de mise à l'échelle |

## Décision
- **Modèle** : `cms_documents` (type `article` / `project` / `service` / `page`, statut
  brouillon / publié, position, attributs JSONB par type, couverture) et
  `cms_document_translations` (une ligne par langue : slug, titre, résumé, Markdown, SEO).
  Le slug est unique par organisation, type et langue ; il peut différer d'une langue à l'autre.
- **Organisation interne** : les contenus du site appartiennent à l'organisation interne
  DEV4INNOVA (`00000000-0000-4000-8000-000000000001`, créée par la migration 0004), et toute
  requête reste filtrée par `organization_id`. Le back-office est réservé aux membres de cette
  organisation avec un rôle `staff_*` (`staff_editor` : écriture et publication ;
  `staff_sales` : lecture). Les rôles `owner`/`admin` d'une organisation cliente n'y donnent
  aucun accès.
- **Rendu** : Markdown converti en HTML **par l'API** (markdown-it-py, HTML brut désactivé),
  puis assaini par **nh3** (liste blanche de balises, `rel="noopener noreferrer"`, images
  limitées à l'URL publique des médias). Le web affiche ce HTML tel quel.
- **Médias** : images JPEG / PNG / WebP de 5 Mo maximum, **ré-encodées** par Pillow (métadonnées
  EXIF supprimées, 40 mégapixels maximum), clé aléatoire, `Cache-Control: immutable`, textes
  alternatifs FR/EN. Stockage S3-compatible (boto3) ; MinIO en local, fournisseur S3 européen
  en production (à choisir avec l'hébergement, EPIC 13).
- **Publication** : seuls les contenus publiés sont exposés par `GET /api/v1/content/...`. Le web
  les met en cache (`'use cache'`, `cacheLife("hours")`, étiquette `cms:{type}`) ; chaque
  modification depuis le back-office appelle `updateTag`, donc elle est visible immédiatement.
- Un contenu publié ne peut pas être supprimé : il faut d'abord le dépublier.

## Conséquences
- Les services du site viennent désormais du CMS (5 services initialisés par la migration).
- Le job CI « Web E2E » démarre l'API, PostgreSQL et Redis.
- Pas d'historique des versions ni de planification de publication pour l'instant (à prévoir si
  le besoin apparaît, sans changer le modèle de traduction).
