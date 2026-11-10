# ADR-0009 — Fournisseur d'identité

- **Statut** : Remplacé par ADR-0019 (comptes intégrés, 2026-11-10) — était : Accepté, Zitadel Cloud
- **Date** : 2026-11-06
- **Tâches liées** : TASK-038, TASK-039, TASK-044

## Contexte
Il faut une authentification sûre (email/mot de passe, magic link, OAuth Google/Microsoft,
MFA à terme) pour le portail client, l'admin et l'Academy, vérifiable par le backend FastAPI.
Les organisations et rôles restent gérés par **notre** base (ADR-0006).

## Options étudiées
| Option | Pour | Contre |
|---|---|---|
| **Zitadel Cloud** ✅ | OIDC standard, hébergement UE, open source (auto-hébergeable plus tard), MFA, SSO entreprise | écosystème plus jeune qu'Auth0 |
| Keycloak (auto-hébergé) | open source, données maîtrisées | exploitation et mises à jour à notre charge |
| Clerk | intégration Next.js très rapide | coût par utilisateur actif, données hors UE par défaut |
| Auth0 | mature, SSO entreprise | coût élevé à l'échelle |

## Décision
- **Zitadel Cloud, région UE**, pour l'authentification uniquement (écrans de connexion, mots
  de passe, MFA, fournisseurs sociaux). Aucun mot de passe n'est stocké chez nous.
- **Web (BFF)** : le serveur Next.js mène le flux OIDC *authorization code* avec **PKCE**,
  `state` et `nonce` (bibliothèque `openid-client`). Le jeton d'accès est conservé dans un
  cookie **chiffré** (JWE A256GCM), `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS : aucun jeton
  n'est accessible au JavaScript du navigateur.
- **API** : vérifie à chaque requête le **JWT d'accès** (signature JWKS, `iss`, `aud` = ID du
  projet Zitadel, `exp`, `nbf`, `sub`) avec PyJWT. Utilisateurs créés à la première requête
  (*just-in-time*), e-mail lu via `userinfo` s'il manque dans le jeton.
- **Autorisation** : uniquement dans notre base (memberships et rôles par organisation).

## Conséquences
- Changer de fournisseur ne demande que de nouvelles valeurs `AUTH_*` (OIDC standard) et la
  reprise des comptes (`users.external_subject`).
- Les jetons d'accès doivent être au format **JWT** (réglage de l'application Zitadel).
- Pas de rafraîchissement de jeton pour l'instant : à expiration, l'utilisateur repasse par
  Zitadel, ce qui est transparent tant que sa session Zitadel est active. Le rafraîchissement
  (`refresh_token`, déjà demandé via `offline_access`) pourra être ajouté sans changement d'API.
- Procédure de configuration : `docs/architecture/authentication.md`.
