# Decisiones del agente

Bitácora de decisiones no cubiertas por el PRD o que lo ajustan. Fecha en formato ISO.

## 2026-10-12 · Fase 0

1. **TypeScript 6.0.3 en lugar de 7.0.2.** `typescript-eslint` exige `typescript < 6.1` y TS 7 es el compilador
   nativo (Go) con compatibilidad aún parcial en el ecosistema. Se revisará al inicio de la Fase 1.
2. **ESLint 9.39.5 en lugar de 10.x.** Los plugins que arrastra `eslint-config-next` (import, jsx-a11y, react)
   declaran compatibilidad solo hasta ESLint 9.
3. **Bun como devDependency (`bun@1.4.3`).** No está instalado globalmente en la máquina de desarrollo; los
   scripts se ejecutan con `pnpm exec bun` o con un Bun global si existe.
4. **Sin Docker en la máquina de desarrollo.** Las migraciones se verifican en pruebas contra PGlite (Postgres en
   WASM) con `@stenia/db/testing`. Para correr la app en local sin Docker se añade `pnpm db:dev` (PGlite por socket
   TCP, datos en `.cache/pglite`); `infra/docker-compose.dev.yml` sigue siendo la vía recomendada cuando hay Docker.
   PGlite acepta una sola conexión real y resetea las demás bajo concurrencia, por lo que el pool es configurable con
   `DATABASE_POOL_MAX` (usar `1` con PGlite; 5 por defecto). `next.config.ts` carga el `.env.local` de la raíz
   porque Next solo lee los `.env*` de `apps/web`.
5. **Tabla `workout_session` en lugar de `session`.** Better Auth ya usa `session` para las sesiones de acceso; las
   demás tablas conservan el nombre del PRD (`session_exercise`, `set_log`…).
6. **pnpm 12: `allowBuilds` y `minimumReleaseAgeExclude`.** pnpm 12 bloquea scripts de instalación y versiones muy
   recientes por defecto; la lista en `pnpm-workspace.yaml` la generó `pnpm approve-builds`.
7. **Service worker (Serwist) pospuesto a la Fase 1** junto con el modo offline; en la Fase 0 solo se publica el
   `manifest.webmanifest` e iconos SVG. Iconos PNG (192/512 y apple-touch) pendientes para iOS.
8. **Tipografías por la API de Fontshare** (Clash Grotesk 500, Switzer 400/500/600). Se autoalojarán en la Fase 1
   para que funcionen sin conexión.
9. **Next.js 16: `proxy.ts` en lugar de `middleware.ts`.** Comprobación optimista por cookie de sesión; cada página
   verifica la sesión en el servidor.
10. **Playwright no corre en CI todavía.** Necesita base de datos y app en marcha; se añadirá un servicio Postgres al
    workflow cuando exista una sesión de prueba sembrada (Fase 1).
11. **Dockerfile y migrador:** la salida `standalone` de Next 16 (Turbopack) empaqueta `drizzle-orm` dentro de
    los chunks y deja `pg` solo en `node_modules/.pnpm`, así que un `apps/web/migrate.mjs` suelto no resuelve
    sus imports en el contenedor (verificado simulando el layout del runner). Solución: `pnpm --filter web
    build:migrate` empaqueta `migrate.mjs` con `bun build` en un único archivo (~0.3 MB, `pg-native` externo)
    que el Dockerfile copia a `/app/apps/web/migrate.mjs`; el `CMD` del PRD se conserva. También se copia
    `scripts/package.json` para que `pnpm install --frozen-lockfile` reconozca todos los workspaces y se añade
    un `HEALTHCHECK` contra `/api/health`.
12. **Discrepancias entre los dos PRD:** se sigue `stenia-PRD.md`. Bloques obligatorios del cuestionario: 1, 2, 5
    y 6 (el PRD humano dice 1 y 2). Usuario de Postgres: `stenia` (el PRD humano dice `gym_ia`).
13. **Dokploy, paso 0 ejecutado (solo lectura):** RAM libre ≈ 3.2 GB y disco libre ≈ 26 GB (ambos sobre el
    umbral). No hay destinos de respaldo. No existe un proyecto `stenia`, pero sí uno vacío llamado
    **"Gym Calistenia IA"** creado el mismo día con la descripción del MVP. Pendiente que el usuario decida si se
    renombra/reutiliza o se crea `stenia`. "Gym System" no se tocó. Los pasos 1–9 esperan los prerrequisitos de
    la sección 12.1 (R2, GitHub, DNS, Google OAuth).
14. **RepDB:** su licencia prohíbe redistribuir el dataset y usar sus imágenes como entrada de IA generativa. Por
    eso (a) el espejo en R2 es solo para uso dentro de la app, (b) nunca se envían imágenes de RepDB al LLM y (c)
    la atribución "Exercise data by RepDB (repdb.co)" se muestra en `/creditos`. Sus textos en español son
    traducciones del proveedor, así que se marcan `reviewed = true`.
15. **Slugs del catálogo con prefijo por fuente** (`fed-`, `cal-`, `rep-`). Habrá duplicados entre fuentes (p. ej.
    tres versiones de "Push-Up"); la deduplicación y la selección de la ficha preferida se hacen en la Fase 1 al
    construir el filtro del catálogo.
16. **Nombres en español del catálogo:** free-exercise-db y el dataset de calistenia solo traen inglés; `name_es`
    copia el inglés con `reviewed = false` hasta la traducción por LLM con revisión humana (Fase 1, cuando exista
    proveedor configurado).
17. **Equipo requerido "uno de varios":** el modelo guarda equipo requerido plano (todos obligatorios). Cuando un
    catálogo dice solo "cable" o "machine" se infiere la máquina más probable por el nombre y, si no se puede, se
    usa `cable_high` o `machine_generic` ("Otras máquinas"). Se revisará con datos reales de uso.
18. **Exportar datos y borrar cuenta** (sección 16) se implementaron ya en la Fase 0 dentro de `/configuracion`,
    aunque el roadmap no los asignaba a una fase.
19. **Colores derivados con contraste AA sobre `#0E0E0E`:** `--up #3FBF7F` (8.2:1), `--down #E0A526` (8.8:1),
    `--protein #8FA8C8`, `--carbs #C9A96E`, `--fat #B38FBF`; `--accent #CE0037` con texto blanco 5.7:1.
20. **Endpoint `/api/health`** para la verificación del runbook y el healthcheck de Dokploy.
21. **`import-foods.ts`** existe como marcador que termina con error explicando que corresponde a la Fase 3, para
    cumplir la lista de scripts raíz sin fingir una implementación.
22. **IDs de modelos por defecto** (sección 11): `claude-opus-5-5`, `claude-haiku-5-5`, `gpt-6.1-sol`,
    `gpt-6-luna`, `gemini-3.1-pro-preview`, `gemini-3.8-flash`. Son sugerencias editables en
    `/settings/developer`; la tabla de precios vive en `packages/ai/src/pricing.ts`.
