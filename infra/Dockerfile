# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ai/package.json packages/ai/
COPY packages/catalog/package.json packages/catalog/
COPY scripts/package.json scripts/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# El migrador se empaqueta en un solo archivo porque la salida standalone no incluye drizzle-orm ni pg
# en una ruta que apps/web/migrate.mjs pueda resolver (ver docs/decisions.md, decisión 11).
RUN pnpm --filter web build && pnpm --filter web build:migrate

FROM node:24-alpine AS runner
WORKDIR /app
# STENIA_DEPLOYMENT=server impide usar la suscripción de Claude fuera de la Mac del usuario (términos de uso).
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 STENIA_DEPLOYMENT=server
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/.next/migrate.bundle.mjs ./apps/web/migrate.mjs
COPY --from=build /repo/packages/db/drizzle ./drizzle
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1
CMD ["sh", "-c", "node apps/web/migrate.mjs && node apps/web/server.js"]
