# packages/api-client

Client TypeScript typé du backend, **généré** depuis le schéma OpenAPI de `apps/api` (ADR-0004).

- `openapi.json` et `src/generated/schema.ts` sont générés : ne pas les éditer à la main.
- Régénérer après toute modification de l'API : `pnpm --filter @dev4innova/api-client generate`.

```ts
import { createApiClient } from "@dev4innova/api-client";

const api = createApiClient(process.env.API_URL!);
const { data, error } = await api.GET("/api/v1/health/live");
```
