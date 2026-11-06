# infra/docker

Environnement local complet, lancé depuis la racine avec `make up` (ou
`docker compose -f infra/docker/compose.yaml up -d --build --wait`).

| Service | Image | Rôle | Port local |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | base principale + base de test `dev4innova_test` | 5432 |
| `redis` | `redis:7-alpine` | cache, quotas, files (persistance AOF) | 6379 |
| `migrate` | `dev4innova/api:local` | exécute `alembic upgrade head` puis s'arrête | — |
| `api` | `dev4innova/api:local` (`api.Dockerfile`) | FastAPI, démarre après `migrate` | 8000 |
| `web` | `dev4innova/web:local` (`web.Dockerfile`) | Next.js (standalone), démarre quand l'API est saine | 3000 |

Ordre de démarrage garanti par les healthchecks : `postgres` → `migrate` → `api` (+ `redis`) → `web`.
Les ports ne sont exposés que sur `127.0.0.1`. Les valeurs par défaut (identifiants compris)
sont **réservées au local** ; voir `.env.example`.

Les images tournent avec un utilisateur non-root. Données persistées dans les volumes
`postgres-data` et `redis-data` (`docker compose down -v` pour repartir de zéro).
Le script `postgres/init/` ne s'exécute qu'à la création du volume.
