# AGENTS.md · Convenciones de Stenia para agentes de código

Stenia es una PWA de gimnasio y calistenia con IA. El documento rector es `stenia-PRD.md` (sección 0 explica
cómo usarlo). Este archivo resume lo que necesitas para trabajar en el repo sin romper nada.

## Reglas no negociables

- **pnpm** para dependencias (workspaces). Nunca npm ni yarn. **Bun** para scripts (`scripts/`): si no está
  instalado globalmente, úsalo con `pnpm exec bun`.
- TypeScript `strict`. Toda entrada externa y toda salida del LLM se valida con **zod**.
- Interfaz en español de México (`es-MX`), unidades métricas (kg, cm). Textos visibles siempre en español.
- Commits con Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`…).
- Nada de secretos en el repo: `.env.example` lleva las claves sin valor. Nunca imprimas keys ni tokens.
- En Dokploy solo se toca el proyecto `stenia`; limpiezas y borrados requieren aprobación explícita del usuario.
- Decisiones no cubiertas por el PRD se anotan en `docs/decisions.md` con fecha.
- No crear `CLAUDE.md`; este archivo es el único de convenciones.

## Definición de terminado (cada tarea)

```bash
pnpm lint && pnpm typecheck && pnpm test
```

- Lógica de `packages/core` con pruebas unitarias (progresión, nutrición, cronómetros, esquemas).
- Pantallas nuevas probadas en móvil (375 × 812) y escritorio.
- Si cambia el esquema: `pnpm db:generate` y migración aplicada (`pnpm db:migrate` o la prueba sobre PGlite).
- Sin `TODO` sin issue asociado.

## Estructura

```
apps/web            Next.js 16 (App Router, Server Actions, Route Handlers), salida standalone, PWA
packages/core       esquemas zod compartidos, formateadores, motor de progresión, cálculos nutricionales
packages/db         esquema Drizzle (src/schema), migraciones (drizzle/), semillas, helper PGlite para pruebas
packages/catalog    importadores de ejercicios y alimentos (USDA), glosarios es-MX, datos versionados (data/)
packages/ai         proveedores (Vercel AI SDK), cifrado de la key, precios y costo, prompts versionados
scripts/            importadores Bun (free-exercise-db, calistenia, RepDB), semillas, migrador
infra/              Dockerfile y docker-compose.dev.yml
.github/workflows/  ci-deploy.yml (lint, tipos, pruebas → imagen en GHCR → webhook de Dokploy)
docs/decisions.md   bitácora de decisiones del agente
docs/despliegue-manual.md  guía para desplegar desde la interfaz de Dokploy
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | App en http://localhost:3000 |
| `pnpm build` / `pnpm start` | Build standalone y servidor de producción |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Puerta de calidad |
| `pnpm test:e2e` | Playwright (móvil y escritorio); necesita la app y la base corriendo (`--workers=1` con PGlite) |
| `PLAYWRIGHT_OFFLINE=1 pnpm test:e2e offline` | Prueba sin conexión del service worker; solo contra un build de producción |
| `pnpm db:generate` | Genera migración a partir de `packages/db/src/schema` |
| `pnpm db:migrate` | Aplica migraciones a `DATABASE_URL` |
| `pnpm db:seed` | Siembra el catálogo de equipamiento |
| `pnpm db:dev` | Postgres local sin Docker (PGlite por socket, datos en `.cache/pglite`) |
| `bun run scripts/import-exercises.ts` | Importa catálogos y espeja imágenes en R2 (`--no-mirror` sin R2) |
| `bun run scripts/import-foods.ts` | Importa los alimentos USDA del archivo versionado (la app también lo hace sola) |
| `bun run scripts/build-foods.ts` | Regenera `packages/catalog/data/usda-foods.json` desde USDA (necesita `unzip`) |

## Desarrollo local

1. `cp .env.example .env.local` y rellena `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAILS` y `ENCRYPTION_KEY`.
2. Base de datos: `docker compose -f infra/docker-compose.dev.yml up -d` **o**, sin Docker, `pnpm db:dev` en una
   terminal aparte (expone Postgres en `127.0.0.1:5432`; en ese caso pon `DATABASE_POOL_MAX=1` en `.env.local`).
3. `pnpm db:migrate && pnpm db:seed`.
4. `pnpm dev`.

## Convenciones de código

- Rutas en español (`/hoy`, `/progreso`, `/nutricion`, `/perfil`, `/configuracion`), salvo
  `/settings/developer` que el PRD fija en inglés.
- Server Components por defecto; `'use client'` solo donde hay estado o eventos. Acceso a datos solo en el
  servidor (`lib/*.ts` con `import 'server-only'`), verificando siempre el `userId` de la sesión.
- Componentes base en `apps/web/components/ui` (estilo shadcn, Tailwind 4 con tokens en `app/globals.css`).
- El acento `--accent` se usa para una sola cosa por pantalla.
- Identificadores: `text` con UUID generado en la app (también en el cliente para sincronización offline).
- Las notas del usuario que entran a un prompt se envuelven con `asUserData()` (datos, no instrucciones).

## Licencias del catálogo

- free-exercise-db: Unlicense. Calistenia (Martjn): Apache-2.0 (imágenes con su licencia).
- RepDB free: atribución visible obligatoria ("Exercise data by RepDB (repdb.co)"), **sin redistribución** del
  dataset y **sin usar sus imágenes como entrada de IA generativa**.
- Open Food Facts (Fase 3): ODbL; sus filas (`source = 'off'`) no se mezclan en exportaciones.
