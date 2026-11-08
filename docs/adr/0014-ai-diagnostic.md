# ADR-0014 — Diagnostic IA public : rapport contre e-mail, questionnaire versionné dans le code

- **Statut** : Proposé (public, questionnaire et PDF validés par le responsable du projet le
  2026-11-08 ; ADR à accepter formellement)
- **Date** : 2026-11-08
- **Tâches liées** : TASK-089 → TASK-095 ; s'appuie sur l'ADR-0011 (CRM) et l'ADR-0012 (AI Gateway)

## Contexte
L'EPIC 10 propose aux visiteurs une évaluation de leur maturité IA. C'est à la fois un service
rendu et un outil de prospection : il doit être accessible sans friction, produire un résultat
utile immédiatement, et alimenter le CRM sans collecter de données sans consentement.

## Décision
- **Public, sans compte** (`/fr/diagnostic-ia`, `/en/ai-diagnostic`). Le score global, le
  niveau, le radar par axe et les trois priorités sont affichés tout de suite. Le **rapport
  complet** (recommandations détaillées, analyse IA personnalisée, PDF) est débloqué contre un
  nom, une adresse e-mail et un **consentement horodaté** ; ce déblocage crée ou met à jour un
  prospect CRM (source et activité `diagnostic`).
- **Lien secret** : chaque diagnostic est désigné par un jeton aléatoire (32 octets) ; seule son
  empreinte SHA-256 est stockée. Page de résultat `noindex`, `Referrer-Policy: no-referrer`.
- **Questionnaire versionné dans le code** (`app/modules/diagnostic/questionnaire.py`, version
  `2026-11`) : 5 axes (stratégie, données, technologie, compétences, gouvernance) × 4 questions,
  plus un profil facultatif (secteur, taille, fonction), en FR et EN. Un changement de questions
  ou de barème est une nouvelle version, revue comme du code ; chaque diagnostic garde sa version.
- **Scoring déterministe** : options notées 0 à 3, score par axe ramené sur 100, score global =
  moyenne des axes ; niveaux Découverte (< 25), Expérimentation (< 50), Structuration (< 75),
  Transformation. Recommandations tirées d'un catalogue par axe et par niveau (faible / avancé),
  avec un horizon et un service DEV4INNOVA associé ; priorités = les trois axes les plus faibles.
- **Analyse IA** : prompt versionné `diagnostic.analysis` (migration 0008), appelé par l'AI
  Gateway pour l'organisation interne (budget DEV4INNOVA), une seule fois par diagnostic
  débloqué, puis conservée. Plafond quotidien global (`AI_DIAGNOSTIC_DAILY_ANALYSES`, 300),
  limites de débit par visiteur (10 diagnostics et 5 déblocages par heure), honeypot.
- **PDF généré par l'API** avec ReportLab (Python pur, polices standard) : score, radar,
  barres, priorités, recommandations, analyse. Tous les textes sont échappés.
- **Conservation** : diagnostics jamais débloqués purgés après **30 jours**
  (`make purge-diagnostics`, à planifier chaque jour) ; les diagnostics débloqués suivent le
  prospect et sont supprimés avec lui (effacement RGPD).

## Conséquences
- Le questionnaire et les recommandations sont des textes métier à relire par l'équipe ; les
  modifier impose une nouvelle version du questionnaire.
- La politique de confidentialité doit mentionner le diagnostic (finalité, conservation,
  transmission des réponses au fournisseur d'IA).
- Le coût de l'analyse est porté par DEV4INNOVA ; le plafond quotidien borne le risque d'abus.
- Pas d'envoi du rapport par e-mail pour l'instant (pas de service d'envoi) : à ajouter avec
  les notifications.
