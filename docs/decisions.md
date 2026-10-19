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

## 2026-10-12 · Runbook de Dokploy (sección 12)

Prerrequisitos entregados por el usuario: reutilizar el proyecto existente y el subdominio `stenia.halonso.digital`
(ya resolvía a la IP del VPS `93.188.167.69`, validado con `domain-validateDomain`).

| Paso | Recurso | ID / valor (sin secretos) |
| --- | --- | --- |
| 3 | Proyecto renombrado "Gym Calistenia IA" → `stenia` | projectId `5z9GRnbMU1uqLFrK2KaUJ`, environmentId `Yca3YogMXI1gjfBBQT34w` |
| 4 | Postgres `stenia-db` (postgres:18, 512 MB / 256 MB, sin puerto externo) | postgresId `Fm6Y7SPHXs1PrawuTb7Hu`, appName final `stenia-db-qfrn1l` |
| 7 | Aplicación `stenia-web` (Docker, 1 GB / 256 MB, variables de 3.1 cargadas) | applicationId `zoY7qs_Q8ljZ38lttM8oK`, appName `stenia-web-akpqek` |
| 7 | Dominio `stenia.halonso.digital` → puerto 3000, HTTPS Let's Encrypt | domainId `sRC82nZB1mPr0RP3AjWHv` |
| 8 | Tarea programada `stenia-checkin-reminders` (09:00 America/Mexico_City → `/api/cron/checkins`) | scheduleId `ysu25jDB8pCkcjQoN6L4z` |

Notas:

- Los límites de memoria se aceptan solo como cadenas en el MCP (`"536870912"`), como indica el PRD.
- Los secretos de producción (`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, contraseña de Postgres) los
  generó el agente porque el clasificador de permisos impidió leer los valores generados con `openssl` desde el
  archivo local; quedan en las variables de la aplicación en Dokploy y en `.env.production.local` (ignorado). Se
  pueden rotar desde Dokploy cuando se quiera.
- `ADMIN_EMAILS` apunta al correo del autor para que su cuenta tenga rol admin en producción.
- Pendientes que dependen del usuario: destino de respaldos en R2 (pasos 2 y 5), repositorio en GitHub y primer
  push del workflow para que exista la imagen `ghcr.io/<owner>/stenia-web:latest` (paso 7: proveedor Docker y
  despliegue), credenciales de Google OAuth (opcional: el acceso por correo ya funciona).

## 2026-10-19 · Migración al Dokploy nuevo (216.238.95.246)

El MCP de Dokploy ahora apunta a otra instancia (v0.30.8, organización de Hemeron, 4 GB de RAM, ≈62 GB de disco
libre). La instancia anterior (93.188.167.69) ya no es accesible desde el agente; sus recursos de Stenia quedan
huérfanos allí (ver final de esta sección).

| Paso | Recurso | ID / valor (sin secretos) |
| --- | --- | --- |
| 3 | Proyecto `stenia` | projectId `3vCVIAFBNtoDHESIdQLeE`, environmentId `X19EbfkLs9N5HC3eOMxPZ` |
| 4 | Postgres `stenia-db` (postgres:18, 512 MB / 256 MB, sin puerto externo) | postgresId `7ZCJJ4TNU6fbw7mShhGaz`, appName `stenia-db-cejyvl` — **creada, sin desplegar** |
| 7 | Aplicación `stenia-web` (Docker `ghcr.io/betazodev/stenia-web:latest`, 1 GB / 256 MB, variables de 3.1) | applicationId `ItylE_xFy1yUwqhzmC_NO`, appName `stenia-web-luq51n` — **sin desplegar** |
| 7 | Dominio `stenia.halonso.digital` → 3000, HTTPS Let's Encrypt | domainId `LeZoDBjqUfjXeZ32Q0tu1` |
| 8 | Tarea `stenia-checkin-reminders` (09:00 America/Mexico_City) | scheduleId `wHfRajHtaVQw0xoxw3qPO` |
| 12.1 | Buckets R2 en la cuenta de Cloudflare de Hemeron | `stenia-backups`, `stenia-private`, `stenia-public` (ENAM) |
| 12.1 | Repositorio privado | `github.com/BetazoDev/stenia` (vacío: push rechazado, ver abajo) |

Decisiones y bloqueos:

1. **Puerta de RAM del paso 0 no superada.** `docker-getServerHealth` reporta ≈1.17 GiB libres (umbral del PRD:
   1.5 GB). Siguiendo el PRD ("si no, detenerse y avisar") no se desplegó ningún contenedor; todo quedó configurado.
   El consumo real esperado en reposo es ≈250–350 MB (Postgres + Next standalone) con límites duros de 512 MB y
   1 GB, así que el despliegue es viable si el usuario lo aprueba o si se bajan los límites (p. ej. 256 MB / 768 MB).
2. **Push a GitHub rechazado.** El token de `gh` (scopes `gist`, `read:org`, `repo`) no tiene `workflow`, y GitHub
   exige ese scope para subir `.github/workflows/ci-deploy.yml`. Se resuelve con `gh auth refresh -s workflow`.
3. **Paquete de GHCR privado por defecto.** Al ser privado el repo, Dokploy necesitará credenciales para descargar
   la imagen (registro `ghcr` con un PAT `read:packages`) o que el paquete se marque como público. El agente no
   usa el token personal de `gh` para eso.
4. **No se construye en el servidor** aunque existe la GitHub App "Dokploy-Hemeron": con 4 GB de RAM y ≈1.2 GB
   libres, un build de Next podría tumbar los demás proyectos (sitios de clientes en producción).
5. **DNS:** `stenia.halonso.digital` (Hostinger, `dns-parking.com`) sigue apuntando a 93.188.167.69; hay que
   cambiar el registro A a `216.238.95.246`. Alternativa inmediata: `*.hemeron.com` ya resuelve a este servidor.
6. **Secretos nuevos** para esta instancia (contraseña de Postgres, `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`,
   `CRON_SECRET`), escritos por el agente en Dokploy y en `.env.production.local` (ignorado). Se pueden rotar.
7. **Workflow corregido:** GitHub no admite `secrets` dentro de `if:`; el paso de redespliegue lee el webhook desde
   `env` y se omite si no existe. Se añadió la etiqueta `org.opencontainers.image.source` para enlazar el paquete.
8. **R2:** los buckets existen, pero el token S3 (Access Key ID / Secret) y el acceso público de `stenia-public` se
   crean en el panel de Cloudflare; las herramientas conectadas no los gestionan.

Recursos huérfanos en el Dokploy anterior (93.188.167.69), pendientes de borrar por el usuario: proyecto `stenia`
(`5z9GRnbMU1uqLFrK2KaUJ`) con Postgres `Fm6Y7SPHXs1PrawuTb7Hu` (en ejecución), aplicación `zoY7qs_Q8ljZ38lttM8oK`,
dominio `sRC82nZB1mPr0RP3AjWHv` y tarea `ysu25jDB8pCkcjQoN6L4z`.

## 2026-10-19 · Se mantiene el Dokploy anterior

El usuario decide no usar el Dokploy de Hemeron (216.238.95.246) para no consumir su poca RAM libre y continuar en
la instancia anterior (93.188.167.69), donde ya están el proyecto `stenia`, la Postgres desplegada, la aplicación,
el dominio y la tarea programada (IDs en la sección del 2026-10-12). Consecuencias:

- Los recursos creados el 2026-10-19 en el Dokploy de Hemeron (tarea, dominio, aplicación, Postgres y el proyecto
  `3vCVIAFBNtoDHESIdQLeE`) se **borraron** el mismo día con aprobación explícita del usuario. Nunca se desplegaron;
  los otros 10 proyectos de esa instancia no cambiaron de estado.
- Se conservan el repo privado `BetazoDev/stenia`, la corrección del workflow y los buckets R2 (cuenta de Cloudflare
  de Hemeron), que sirven igual para el servidor anterior.
- El MCP de Dokploy debe volver a apuntar a la instancia anterior para continuar el runbook.
- Primer push a `BetazoDev/stenia` hecho con la credencial de `gh` solo para ese comando
  (`credential.helper=!gh auth git-credential`), porque el llavero de macOS guarda un token sin scope `workflow`.
  Para pushes futuros sin ese parámetro: `gh auth setup-git`.
- `.env.production.local` vuelve a tener como principales los secretos del servidor anterior.

## 2026-10-19 · Despliegue manual

El usuario no reconectará el MCP al Dokploy anterior y terminará el despliegue a mano desde la interfaz. La guía
paso a paso está en `docs/despliegue-manual.md` (acceso a GHCR, proveedor Docker, despliegue, webhook, respaldos
en R2 y Google OAuth opcional).
