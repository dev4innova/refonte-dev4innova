# ADR-0012 — AI Gateway : budgets en euros, prompts versionnés, exposition interne

- **Statut** : Proposé (choix des quotas, des modèles amorcés, de l'exposition et des prompts
  validés par le responsable du projet le 2026-11-08 ; ADR à accepter formellement)
- **Date** : 2026-11-08
- **Tâches liées** : TASK-073 → TASK-082 ; précise l'ADR-0007

## Contexte
L'ADR-0007 fixe le principe : un module `ai_gateway`, seul point d'appel aux fournisseurs,
adaptateurs Anthropic / OpenAI / Gemini via leurs SDK officiels, registre des modèles,
prompts versionnés, journal d'usage et quotas. Restait à décider comment exprimer les quotas,
quels modèles amorcer, qui appelle le gateway et comment gérer les prompts.

## Décision
- **Contrat fournisseur** (`providers/base.py`) : un flux de `TextDelta` puis un `Completed`
  (tokens, raison d'arrêt normalisée `end` / `max_tokens` / `refusal` / `other`, modèle ayant
  répondu) ; erreurs normalisées (`provider_auth`, `provider_bad_request`,
  `provider_rate_limited`, `provider_unavailable`, `provider_not_configured`) avec un indicateur
  « réessayable ». Les instructions (système) restent toujours séparées du contenu utilisateur.
- **SDK** : `anthropic` (2.x, `AsyncAnthropic`, `messages.stream`), `openai` (Chat Completions
  en streaming avec `include_usage`), `google-genai` (`aio.models.generate_content_stream`).
  Anthropic : `effort` et le repli serveur en cas de refus (`fallbacks: "default"`, bêta
  `server-side-fallback-2026-07-01`) se règlent par modèle dans le registre (`options`).
- **Registre** (`ai_models`) : données de référence de la plateforme (non rattachées à une
  organisation), prix en **USD par million de tokens**, sortie maximale par appel, options,
  activé / par défaut (un seul). Amorcé avec **Claude Opus 5.5** (par défaut), **Sonnet 5.5**
  et **Haiku 5.5** aux prix officiels ; les modèles OpenAI et Gemini sont saisis par l'équipe
  avec les identifiants et prix du moment.
- **Prompts** (`ai_prompts`, `ai_prompt_versions`) : clé stable utilisée dans le code, versions
  **immuables**, une version active (activation et retour arrière sans déploiement).
  Variables `{{nom}}` **uniquement dans le gabarit du message utilisateur**, jamais dans les
  instructions : une donnée fournie par un utilisateur ne peut pas devenir une instruction.
- **Coûts et quotas** : chaque appel est journalisé (`ai_usage` : organisation, utilisateur,
  modèle, prompt et version, tokens, coût USD et EUR, latence, statut) **sans aucun contenu**.
  Budget **mensuel en euros** par organisation (`ai_quotas`, sinon
  `AI_DEFAULT_MONTHLY_BUDGET_EUR`), taux de conversion `AI_EUR_PER_USD`. Avant l'appel, le
  gateway refuse (429 `ai_quota_exceeded`) si le **coût maximal possible** (entrée estimée à
  3 caractères par token, sortie au plafond `max_tokens`) dépasse le budget restant : le coût
  maximal par requête est borné. Limite de débit par utilisateur (`AI_USER_REQUESTS_PER_MINUTE`).
- **Exposition** : service **interne** appelé par les modules métier (`gateway.prepare` puis
  `gateway.run` / `gateway.complete`, EPIC 09-10). Pour cette EPIC, seuls les `staff_admin`
  (permission `ai:manage`) y accèdent via le back-office : registre, prompts, usage et budgets de
  toutes les organisations (vue d'exploitant, agrégée, sans contenu), bac à sable en streaming
  SSE décompté du budget de DEV4INNOVA.
- **Fournisseur simulé** (`simulated`, écho hors ligne) activable par
  `AI_ENABLE_SIMULATED_PROVIDER` pour le développement local ; jamais en production.

## Conséquences
- Les tests de contrat (TASK-082) exécutent les **vrais SDK** contre un serveur HTTP local qui
  imite les trois fournisseurs (flux, usage, refus, erreurs 401/429/500, réseau coupé).
- Deux appels simultanés peuvent dépasser légèrement le budget (vérification avant appel, pas
  de réservation) ; un appel interrompu par le visiteur n'est pas journalisé. Acceptables à
  ce stade ; une réservation Redis pourra venir si besoin.
- En cas de repli Anthropic vers un autre modèle, le coût est calculé au prix du modèle
  demandé (le modèle ayant répondu est journalisé).
- Le taux `AI_EUR_PER_USD` est à tenir à jour (ou à remplacer par un taux récupéré
  automatiquement).
