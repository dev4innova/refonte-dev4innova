# ADR-0008 — Internationalisation FR/EN

- **Statut** : Proposé
- **Date** : 2026-11-06
- **Tâches liées** : TASK-032 à TASK-037, TASK-059

## Décision
- Langues : **français (défaut)** et **anglais**. Routes préfixées systématiquement
  (`/fr/...`, `/en/...`) via le middleware **next-intl** ; `/` redirige selon `Accept-Language`
  ou le cookie de préférence.
- Textes d'interface : dictionnaires `apps/web/messages/{fr,en}.json`, parité de clés vérifiée en CI.
- Contenus éditoriaux (CMS) : tables de traduction `*_translations (entity_id, locale, ...)`.
  Les slugs sont traduits ; `hreflang` et sitemap par langue.
- L'API reçoit la langue souhaitée (`Accept-Language` ou paramètre `locale`) et renvoie
  le contenu correspondant, avec repli sur le français.

## Mise en œuvre (EPIC 03)
- next-intl 4 ; configuration dans `apps/web/src/i18n/`, détection de langue dans `src/proxy.ts`
  (« proxy » est le nouveau nom du middleware depuis Next.js 16).
- Ordre de détection pour `/` : cookie `NEXT_LOCALE` (dernier choix), puis `Accept-Language`,
  puis le français.
- Les composants ne lisent pas les messages : ils reçoivent leurs textes par props, ce qui
  évite d'envoyer les dictionnaires au navigateur.

## Conséquences
Ajouter une langue = ajouter un dictionnaire et des traductions, sans changement de schéma.
