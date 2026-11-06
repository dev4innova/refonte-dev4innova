# ADR-0007 — AI Gateway multi-fournisseurs

- **Statut** : Proposé
- **Date** : 2026-11-06
- **Tâches liées** : TASK-073 à TASK-082

## Contexte
Plusieurs fonctionnalités (assistant, analyse de documents, génération de contenu,
diagnostic) utilisent des LLM. Les fournisseurs, prix et modèles évoluent vite.

## Décision
- Module backend `ai_gateway`, **seul** point d'appel aux fournisseurs.
- Interface `AIProvider` commune (complétion, streaming, comptage de tokens, erreurs normalisées)
  implémentée par des adaptateurs **Anthropic**, **OpenAI**, **Gemini** utilisant leurs SDK officiels.
- **Registre des modèles** en base (fournisseur, identifiant, prix par token, capacités,
  activé/désactivé) : changer de modèle ne demande pas de déploiement.
- **Prompts versionnés** en base, référencés par clé ; chaque appel journalise prompt/version,
  modèle, tokens, coût, latence, organisation, utilisateur.
- **Quotas** par organisation/utilisateur appliqués avant l'appel (Redis) ; streaming via SSE
  vers le frontend.

## Conséquences
Les fonctionnalités métier ne dépendent d'aucun SDK fournisseur. Tests de contrat par
adaptateur (TASK-082) avec fournisseurs simulés en CI.
