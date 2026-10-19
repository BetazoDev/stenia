# Stenia

Web app instalable (PWA) de gimnasio y calistenia con IA: genera rutinas a partir del cuestionario y del
equipamiento real, registra cada sesión en vivo y suma nutrición y seguimiento corporal. *Fuerza que se construye.*

- Producto y plan por fases: [`stenia-PRD.md`](./stenia-PRD.md)
- Convenciones para agentes y personas: [`AGENTS.md`](./AGENTS.md)
- Decisiones tomadas durante el desarrollo: [`docs/decisions.md`](./docs/decisions.md)

## Arranque rápido

```bash
pnpm install
cp .env.example .env.local   # rellena DATABASE_URL, BETTER_AUTH_SECRET, ADMIN_EMAILS, ENCRYPTION_KEY
docker compose -f infra/docker-compose.dev.yml up -d   # o: pnpm db:dev (sin Docker)
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Puerta de calidad: `pnpm lint && pnpm typecheck && pnpm test`. Pruebas de punta a punta: `pnpm test:e2e`.

## Qué incluye

| Fase | Funciones |
| --- | --- |
| 0 · Fundaciones | Monorepo, auth con rol admin, configuración de IA (BYOK), catálogos de ejercicios, despliegue |
| 1 · Rutina y sesión | Cuestionario PAR-Q+/ACSM, equipamiento, generación con validación y plantilla, sesión en vivo offline |
| 2 · Progreso | Récords, gráficas, mapa muscular, medidas (Marina), fotos guiadas con MediaPipe, revisiones con ajustes |
| 3 · Nutrición | Alimentos USDA en español, metas, plan semanal con porciones ajustadas, registro diario, código de barras |
| 4 · IA y visión | Lectura de tickets InBody/BIA/DEXA, gasto adaptativo, conteo de repeticiones por cámara, % grasa por foto (experimental) |

## Créditos de datos

Exercise data by [RepDB](https://repdb.co) · [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(Unlicense) · [Martjn/calisthenics_exercises](https://huggingface.co/datasets/Martjn/calisthenics_exercises)
(Apache-2.0) · [USDA FoodData Central](https://fdc.nal.usda.gov) (dominio público) ·
[Open Food Facts](https://world.openfoodfacts.org) (ODbL).
