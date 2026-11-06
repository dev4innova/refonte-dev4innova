# Règles de sécurité

Référence : OWASP ASVS niveau 2, OWASP Top 10, OWASP Top 10 for LLM Applications. RGPD applicable.

## Secrets
- Aucun secret dans le dépôt, les images Docker, les logs ou le bundle frontend.
  `.env` est ignoré par git ; seul `.env.example` (valeurs factices) est versionné.
- Secrets de production dans le gestionnaire de secrets de l'hébergeur / CI, jamais en clair.
- Une fuite suspectée = rotation immédiate de la clé, même si le commit est supprimé.

## Authentification et autorisation
- L'authentification est déléguée au fournisseur d'identité choisi (TASK-038, ADR-0009).
  Pas de stockage maison de mots de passe sauf décision ADR contraire (alors Argon2id).
- Le backend vérifie **à chaque requête** la validité du jeton (signature, `exp`, `aud`, `iss`).
- Autorisation côté serveur uniquement : RBAC par organisation (owner, admin, member, client…).
  Le masquage d'un bouton dans l'UI n'est pas une protection.
- Isolation des organisations : un utilisateur ne peut jamais lire ni modifier une ressource
  d'une organisation dont il n'est pas membre. Couvert par des tests dédiés (TASK-045).
  Renvoyer `404` (et non `403`) pour une ressource d'une autre organisation.
- Sessions/cookies : `HttpOnly`, `Secure`, `SameSite=Lax` minimum ; protection CSRF pour
  les mutations basées sur cookie.

## Entrées et sorties
- Toute entrée est validée par un schéma Pydantic (backend) ; le frontend valide pour l'UX seulement.
- Pas de SQL concaténé, pas de `dangerouslySetInnerHTML` sans sanitisation (DOMPurify) —
  contenus CMS riches compris.
- Uploads : vérification du type MIME réel et de la taille, renommage, stockage hors
  webroot (stockage objet), URLs signées à durée limitée, analyse antivirus si possible.
- En-têtes HTTP : CSP stricte, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `frame-ancestors`. CORS limité aux origines connues.

## Abus et disponibilité
- Rate limiting (Redis) sur l'authentification, les formulaires publics (contact, devis,
  diagnostic) et **tous** les endpoints IA. Captcha/anti-bot sur les formulaires publics.
- Quotas IA par organisation et par utilisateur (TASK-081) ; coût maximal par requête borné.

## IA (AI Gateway)
- Les clés Anthropic/OpenAI/Gemini ne sortent jamais du backend.
- Traiter toute sortie de modèle comme non fiable : pas d'exécution, pas de rendu HTML non
  sanitisé, pas d'action à privilège déclenchée sans validation.
- Défense contre l'injection de prompt : séparer instructions système et contenu utilisateur,
  ne pas exposer de données d'autres organisations dans le contexte.
- Ne pas envoyer de données personnelles ou confidentielles à un fournisseur sans base
  légale et sans que l'organisation l'ait accepté. Journaliser l'usage (tokens, coût), pas
  le contenu sensible.

## Données personnelles (RGPD)
- Minimisation : ne collecter que le nécessaire. Consentement explicite pour le marketing
  et les cookies non essentiels.
- Droit d'accès / d'effacement / de portabilité réalisables techniquement.
- Les logs ne contiennent ni mot de passe, ni jeton, ni contenu de document, ni donnée de paiement.

## Paiements
- Aucune donnée de carte ne transite par nos serveurs : paiement via le formulaire hébergé
  du prestataire (PCI DSS SAQ A). Webhooks vérifiés par signature et traités de façon idempotente.

## Dépendances et CI
- Dépendances épinglées (lockfiles versionnés). Analyse automatique des vulnérabilités
  (Dependabot / `pnpm audit` / `pip-audit`) et des secrets dans la CI (TASK-116, TASK-120).
