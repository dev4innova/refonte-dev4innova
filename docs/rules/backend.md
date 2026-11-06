# Règles backend (`apps/api`)

## Stack
- Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 (async, style 2.0), Alembic.
- Dépendances gérées par `uv` (`pyproject.toml` + `uv.lock` versionné).
- Lint/format : Ruff. Typage : mypy en mode strict sur `app/`. Tests : pytest + pytest-asyncio + httpx.

## Architecture en couches
```
apps/api/app/
├── main.py               # création de l'app, middlewares, routers
├── core/                 # config (pydantic-settings), sécurité, logging, erreurs
├── db/                   # engine, session, base déclarative, mixins
├── modules/<domain>/     # un module par domaine (cms, crm, ai_gateway, ...)
│   ├── router.py         # endpoints HTTP — fin, aucune logique métier
│   ├── schemas.py        # modèles Pydantic d'entrée/sortie
│   ├── models.py         # modèles SQLAlchemy
│   ├── service.py        # logique métier
│   ├── repository.py     # accès aux données (requêtes)
│   └── dependencies.py   # dépendances FastAPI du module
└── tests/
```
- Sens des dépendances : `router → service → repository → models`. Un router n'accède
  jamais directement à la base. Un module n'importe pas le `repository` d'un autre module :
  il passe par son `service`.
- Les modèles SQLAlchemy ne sont jamais renvoyés tels quels : toujours un schéma Pydantic de sortie.

## API
- Préfixe versionné : `/api/v1/...`. Ressources au pluriel, `kebab-case` dans les URLs,
  `snake_case` dans les payloads JSON.
- Chaque endpoint déclare `response_model`, codes de statut et `tags` : l'OpenAPI est le
  contrat consommé par le frontend (génération du client TS).
- Pagination standard (`limit`/`cursor` ou `page`/`size`, au choix unique documenté dans
  un ADR) et format d'erreur unique :
  `{"error": {"code": "string", "message": "string", "details": {}}}`.
- Les opérations longues (génération IA, PDF, emails) sont asynchrones (tâche en arrière-plan
  ou file Redis), pas dans le cycle requête/réponse.

## Multi-tenancy
- Le contexte de requête (`user`, `organization_id`, `roles`) est résolu par une dépendance
  FastAPI et passé explicitement aux services.
- Tout repository d'une ressource tenant-scoped exige `organization_id` en paramètre.
- Les vérifications de permission se font dans le service ou via une dépendance dédiée,
  jamais seulement dans le frontend.

## Configuration et erreurs
- Toute config vient de variables d'environnement via `pydantic-settings` ; `.env.example`
  documente chaque variable. Pas de valeur par défaut pour un secret.
- Exceptions métier typées (`NotFoundError`, `PermissionDeniedError`, ...) converties en
  réponses HTTP par un handler global. Jamais de stack trace renvoyée au client.
- Logs structurés (JSON) avec `request_id` ; aucune donnée sensible loggée.

## Tests
- Chaque endpoint : au moins un test nominal, un test d'autorisation refusée et, si
  tenant-scoped, un test prouvant qu'une autre organisation n'y a pas accès.
- Tests d'intégration sur un vrai PostgreSQL (conteneur), pas SQLite.
- Les fournisseurs externes (IA, paiement, email) sont simulés dans les tests unitaires.
