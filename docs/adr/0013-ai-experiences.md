# ADR-0013 — Expériences IA : sessions privées, documents non conservés, limites d'usage

- **Statut** : Proposé (public, traitement des documents, durée de conservation et visibilité
  validés par le responsable du projet le 2026-11-08 ; ADR à accepter formellement)
- **Date** : 2026-11-08
- **Tâches liées** : TASK-083 → TASK-088 ; s'appuie sur l'ADR-0012 (AI Gateway)

## Contexte
L'EPIC 09 ouvre aux clients trois usages de l'IA : un assistant conversationnel, un
analyseur de documents et un générateur de contenus. Ces usages manipulent des données
potentiellement confidentielles (conversations, documents) et coûtent de l'argent à chaque appel.

## Décision
- **Public** : les membres des organisations, connectés, depuis l'espace client
  (`/espace-client/ia/{organisation}`). Pas de démo publique anonyme pour l'instant.
- **Sessions privées** (`ai_sessions`, `ai_messages`) : rattachées à une organisation **et** à
  leur auteur ; toute requête filtre sur les deux. Les owners/admins ne voient que l'usage agrégé
  du mois (`ai:usage:read` : coût, nombre d'appels par fonction), jamais le contenu.
- **Documents** : PDF, Word (.docx) ou texte, 10 Mo maximum. Le type est détecté d'après le
  contenu, le texte est extrait en mémoire (pypdf, python-docx) et **le fichier est jeté**. Seul
  le texte extrait est conservé avec la session pour les questions de suivi. Un document trop long
  (200 000 caractères par défaut) est **refusé, jamais tronqué**. Le texte est transmis au modèle
  entre balises `<document>`, et les instructions demandent de le traiter comme des données.
- **Prompts** : `assistant.default`, `document.analyze`, `content.generate`, amorcés par la
  migration 0007 et ajustables par les `staff_admin` dans l'admin IA (versions immuables).
  Réponses demandées en texte simple et affichées en texte brut (jamais en HTML). Le générateur
  laisse des espaces réservés plutôt que d'inventer des chiffres.
- **Conservation** : sessions purgées après **90 jours d'inactivité**
  (`AI_SESSION_RETENTION_DAYS`) par `make purge-ai-sessions`, à planifier quotidiennement en
  production (EPIC 13). Chaque utilisateur peut supprimer une session ou toutes les siennes.
- **Limites d'usage** (TASK-088), en plus du budget mensuel de l'organisation et de la limite
  par minute du gateway : plafond quotidien de messages et de documents par utilisateur
  (`AI_DAILY_MESSAGES_PER_USER`, 200 par défaut), messages de 8 000 caractères maximum,
  historique rejoué limité aux 30 derniers messages, sortie plafonnée par prompt. Les requêtes
  refusées ne sont pas enregistrées.
- **Streaming** : SSE de l'API relayé par une route Next.js même origine
  (`/api/ai/{organisation}/sessions/{session}/messages`), sans exposer le jeton au navigateur.

## Conséquences
- La politique de confidentialité doit mentionner ces traitements (finalité, conservation de
  90 jours, transmission du contenu aux fournisseurs d'IA configurés).
- La purge doit être planifiée au déploiement ; sans elle, les sessions inactives restent.
- Pas de démo publique ni de partage de sessions en équipe : à rouvrir si le besoin apparaît.
