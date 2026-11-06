# ADR-0009 — Fournisseur d'identité

- **Statut** : Proposé — **décision ouverte** (TASK-038)
- **Date** : 2026-11-06
- **Tâches liées** : TASK-038, TASK-039

## Contexte
Il faut une authentification sûre (email/mot de passe, magic link, OAuth Google/Microsoft,
MFA à terme) pour le portail client, l'admin et l'Academy, vérifiable par le backend FastAPI.
Les organisations et rôles restent gérés par **notre** base (ADR-0006).

## Options à départager
| Option | Pour | Contre |
|---|---|---|
| **Clerk** | intégration Next.js très rapide, UI prête, MFA | coût par utilisateur actif, données hors UE par défaut |
| **Auth0** | mature, standards OIDC, entreprise (SSO) | coût élevé à l'échelle |
| **Keycloak** (auto-hébergé) | open source, OIDC complet, données maîtrisées (RGPD) | exploitation et mises à jour à notre charge |
| **Supabase Auth / Zitadel Cloud** | OIDC, offre UE possible, coût modéré | écosystème plus jeune (Zitadel) |

## Critères
Hébergement des données en UE (RGPD), coût à 1 000 / 10 000 utilisateurs, vérification JWT
standard (JWKS) côté FastAPI, SSO entreprise futur, effort d'exploitation.

## Décision
À prendre par le responsable du projet avant le démarrage de l'EPIC 04. Quel que soit le choix,
le backend ne dépend que de la vérification OIDC/JWT standard, ce qui limite le verrouillage.
