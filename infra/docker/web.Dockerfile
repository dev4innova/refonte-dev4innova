# Frontend image. Build context: repository root (pnpm workspace).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
RUN pnpm install --frozen-lockfile --filter "@dev4innova/web..."

FROM deps AS build
COPY packages ./packages
COPY apps/web ./apps/web
# Public origin, baked into statically prerendered metadata (canonical, hreflang, Open Graph).
ARG SITE_URL=http://localhost:3000
# robots.txt is prerendered too: without this build argument it would forbid indexing even
# in production (Railway passes service variables only to the declared build arguments).
ARG ALLOW_INDEXING=false
ENV NEXT_TELEMETRY_DISABLED=1 \
    SITE_URL=${SITE_URL} \
    ALLOW_INDEXING=${ALLOW_INDEXING}
RUN pnpm --filter @dev4innova/web build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "apps/web/server.js"]
