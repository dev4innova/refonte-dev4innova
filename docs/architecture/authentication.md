# Authentification et autorisation

Décision : ADR-0009 (Zitadel Cloud). Isolation des organisations : ADR-0006.

## Vue d'ensemble

```
Navigateur ──(1) /fr/espace-client──▶ Next.js proxy ── pas de cookie ──▶ /api/auth/login
     │                                                                       │ PKCE + state + nonce
     │◀──────────────────────────(2) redirection vers Zitadel ◀──────────────┘
     │── connexion sur Zitadel (mot de passe, MFA, Google…) ──▶ Zitadel
     │◀──(3) /api/auth/callback?code=… ── échange du code ──▶ jeton d'accès (JWT)
     │       cookie d4i_session (chiffré, HttpOnly)
     │──(4) /fr/espace-client ──▶ Next.js ──Bearer JWT──▶ FastAPI ── vérifie le JWT (JWKS)
                                                              └─ users / memberships (PostgreSQL)
```

| Élément | Fichier |
|---|---|
| Démarrage de la connexion | `apps/web/src/app/api/auth/login/route.ts` |
| Retour de Zitadel | `apps/web/src/app/api/auth/callback/route.ts` |
| Déconnexion (POST) | `apps/web/src/app/api/auth/logout/route.ts` |
| Session (cookie chiffré) | `apps/web/src/lib/auth/session.ts`, `seal.ts` |
| Pages protégées | `apps/web/src/lib/auth/protected-paths.ts` + `src/proxy.ts` |
| Vérification du jeton | `apps/api/app/modules/identity/auth.py` |
| Utilisateur courant, contexte d'organisation | `apps/api/app/modules/identity/dependencies.py` |
| Rôles et permissions | `apps/api/app/modules/identity/permissions.py` |

## Rôles

| Rôle | Organisation | Permissions |
|---|---|---|
| `owner` | client | tout, y compris accorder ou retirer le rôle `owner` |
| `admin` | client | lire, renommer, gérer les membres (sauf les `owner`) |
| `member` | client | lire l'organisation et ses membres |
| `staff_admin` | interne DEV4INNOVA | tout : contenus, médias, CRM, effacement d'un prospect (RGPD) |
| `staff_editor` | interne DEV4INNOVA | contenus et médias (CMS) : lire, écrire, publier |
| `staff_sales` | interne DEV4INNOVA | CRM : lire, écrire, attribuer ; lecture des contenus |

Les rôles `staff_*` sont attribués hors API (`make grant-staff email=... role=...`).

Règles garanties par les tests :
- une organisation garde toujours au moins un `owner` ;
- un non-membre reçoit **404** sur toute ressource d'une organisation, comme si elle n'existait pas ;
- les rôles `staff_*` ne peuvent pas être attribués par l'API.

## Ajouter un endpoint protégé

```python
@router.get("/organizations/{organization_id}/projects")
async def list_projects(ctx: OrgContext, session: Session) -> list[ProjectOut]:
    ctx.require(Permission.PROJECTS_READ)          # 403 si le rôle ne le permet pas
    return await repository.list_projects(session, ctx.organization_id)  # toujours filtré
```

`OrgContext` ne se résout que pour un membre de l'organisation de l'URL (sinon 404).
Ajouter le test d'isolation correspondant dans `tests/test_isolation.py`.

## Configurer Zitadel Cloud

1. Créer une instance sur zitadel.com en **région UE**. Son URL est l'*issuer*, par exemple
   `https://dev4innova-xxxx.zitadel.cloud`.
2. Créer un **projet** « DEV4INNOVA » et noter son **ID**, qui sert d'audience de l'API.
3. Dans ce projet, créer une **application Web** :
   - méthode d'authentification **PKCE** (aucun secret client) ;
   - *Redirect URI* : `https://<site>/api/auth/callback` (et `http://localhost:3000/api/auth/callback`
     en mode développement) ;
   - *Post logout URI* : `https://<site>` ;
   - **Auth Token Type : JWT** (indispensable : l'API vérifie des JWT).
4. Renseigner les variables, puis redémarrer :

| Variable | Où | Valeur |
|---|---|---|
| `AUTH_ISSUER` | API et web | URL de l'instance |
| `AUTH_AUDIENCE` | API | ID du projet |
| `AUTH_PROJECT_ID` | web | ID du projet (le même) |
| `AUTH_CLIENT_ID` | web | Client ID de l'application |
| `AUTH_SESSION_SECRET` | web | secret aléatoire ≥ 32 caractères (`openssl rand -base64 32`) |
| `SITE_URL` | web | origine publique (`https://www.dev4innova.com`) |

Sans ces variables, la connexion répond 503 et l'API renvoie 503 sur les endpoints
authentifiés : le reste du site fonctionne normalement.
