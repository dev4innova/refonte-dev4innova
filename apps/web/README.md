# apps/web — Frontend Next.js

Règles : [frontend](../../docs/rules/frontend.md). Next.js 16 : lire [AGENTS.md](AGENTS.md).

```bash
cp .env.example .env.local   # API_URL
pnpm dev                     # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test
pnpm build                   # sortie standalone (utilisée par infra/docker/web.Dockerfile)
```

- `src/lib/api.ts` : client API serveur (`@dev4innova/api-client`, généré depuis l'OpenAPI).
- `src/app/api/health/route.ts` : health check du frontend, vérifie que l'API répond.
