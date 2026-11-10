# Authentification et autorisation

Décision : ADR-0019 (comptes intégrés, remplace l'ADR-0009 Zitadel). Isolation des
organisations : ADR-0006.

## Vue d'ensemble

```
Navigateur ──/fr/espace-client──▶ Next.js proxy ── pas de cookie ──▶ /api/auth/login
     │                                                                  │ (redirection)
     │◀───────────────────────── /fr/connexion?returnTo=… ◀─────────────┘
     │── formulaire (Server Action) ──▶ Next.js ── POST /api/v1/auth/sign-in ──▶ FastAPI
     │                                              ◀── jeton de session (une seule fois)
     │◀── cookie d4i_session (HttpOnly, SameSite=Lax, Secure) + redirection vers returnTo
     │── /fr/espace-client ──▶ Next.js ── Bearer <jeton> ──▶ FastAPI ── SHA-256(jeton)
                                                             └─ auth_sessions, users (PostgreSQL)
```

- **Inscription** : `POST /api/v1/auth/sign-up`, qui connecte aussitôt.
- **Déconnexion** : `POST /api/v1/auth/sign-out`, qui révoque la session.
- **Changement de mot de passe** : `POST /api/v1/me/password`, qui ferme les autres sessions.
- **Mot de passe oublié** : l'équipe génère un mot de passe temporaire.
  - Back-office : *Admin → Comptes* (`staff_admin`), qui appelle
    `POST /api/v1/admin/accounts/password-reset`.
  - Ou par la CLI : `python -m app.cli reset-password EMAIL`.

| Élément | Fichier |
|---|---|
| Hachage (Argon2id), jetons | `apps/api/app/modules/identity/auth.py` |
| Comptes, sessions, mots de passe | `apps/api/app/modules/identity/service.py` |
| Routes `/auth`, `/me/password`, `/admin/accounts` | `apps/api/app/modules/identity/router.py` |
| Utilisateur courant, contexte d'organisation | `apps/api/app/modules/identity/dependencies.py` |
| Rôles et permissions | `apps/api/app/modules/identity/permissions.py` |
| Pages connexion, inscription, sécurité | `apps/web/src/app/[locale]/{sign-in,sign-up,account/security}` |
| Server Actions et validation | `apps/web/src/lib/auth/actions.ts`, `forms.ts` |
| Cookie de session | `apps/web/src/lib/auth/session.ts` |
| Redirection `/api/auth/login`, déconnexion | `apps/web/src/app/api/auth/{login,logout}/route.ts` |
| Pages protégées | `apps/web/src/lib/auth/protected-paths.ts` + `src/proxy.ts` |

**Sécurité** :
- mots de passe de 12 à 128 caractères, hachés en Argon2id ;
- seule l'empreinte du jeton est stockée, et la session expire après 30 jours ;
- tentatives limitées par client et par adresse (`AUTH_ATTEMPTS_*`) ;
- réponse identique pour une adresse inconnue ou un mauvais mot de passe.

## Rôles

| Rôle | Organisation | Permissions |
|---|---|---|
| `owner` | client | tout, y compris accorder ou retirer le rôle `owner` ; usage IA agrégé |
| `admin` | client | lire, renommer, gérer les membres (sauf les `owner`) ; usage IA agrégé |
| `member` | client | lire l'organisation et ses membres ; outils IA (sessions privées) |
| `staff_admin` | interne DEV4INNOVA | tout : contenus, médias, CRM, effacement d'un prospect (RGPD), AI Gateway (registre, prompts, budgets, bac à sable) |
| `staff_editor` | interne DEV4INNOVA | contenus et médias (CMS) : lire, écrire, publier |
| `staff_sales` | interne DEV4INNOVA | CRM : lire, écrire, attribuer ; lecture des contenus |

Les rôles `staff_*` sont attribués hors API (`make grant-staff email=... role=...`).
`staff_admin` peut aussi générer un mot de passe temporaire (`accounts:manage`).

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

## Premier administrateur

1. Créer son compte sur le site (*Créer un compte*).
2. Lui donner le rôle depuis le shell du service `api` (Railway) ou en local :
   `python -m app.cli grant-staff <email> staff_admin` (`make grant-staff …` en local).
3. Mot de passe oublié par le seul administrateur : `python -m app.cli reset-password <email>`.
