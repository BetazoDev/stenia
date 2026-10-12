# Stenia — PRD de la web app de gimnasio y calistenia con IA

Versión 1.0 · 12 oct 2026 · Autor: Manuel · Documento preparado para ejecución por un agente de IA de desarrollo.

---

## 0. Cómo debe usar este documento el agente

1. Lee completas las secciones 1, 2 y 3 antes de escribir código.
2. Trabaja por fases (sección 17). No empieces una fase sin cerrar los criterios de la anterior.
3. Cada tarea se considera terminada solo si cumple su **criterio de aceptación** y la **definición de terminado** (sección 1.3).
4. Si un dato falta o hay dos lecturas posibles con impacto alto (costos, datos de salud, infraestructura), detente y pregunta. En lo demás, elige la opción más simple que cumpla el PRD y anótala en `docs/decisions.md`.
5. La infraestructura se crea con el MCP de Dokploy siguiendo el runbook de la sección 12, paso por paso.

### 1. Reglas no negociables

#### 1.1 Herramientas y convenciones

- Gestor de paquetes: **pnpm** (workspaces). Nunca npm ni yarn.
- **Bun** para scripts (semillas, importadores, utilidades) y para correrlos en local. El servidor de producción de Next.js corre en Node (salida `standalone`).
- Archivo de convenciones para agentes: **`AGENTS.md`** en la raíz. **No crear `CLAUDE.md`.**
- TypeScript en modo `strict`. Validación de toda entrada externa y de toda salida del LLM con **zod**.
- Interfaz en español de México (`es-MX`), sistema métrico (kg, cm) por defecto.
- Commits con Conventional Commits (`feat:`, `fix:`, `chore:`…).
- Nada de secretos en el repositorio. `.env.example` lleva las claves sin valores.

#### 1.2 Límites de seguridad para el agente

- En Dokploy, **solo** crear y modificar recursos del proyecto `stenia`. No tocar ningún otro proyecto; en particular, **"Gym System" se conserva intacto**.
- Limpiezas del servidor (imágenes, caché de builds) y cualquier borrado requieren aprobación explícita del usuario en ese momento.
- Nunca imprimir contraseñas, API keys ni tokens en logs, commits o respuestas.
- Las credenciales de Cloudflare R2, GitHub (PAT) y Google OAuth las entrega el usuario; el agente no crea cuentas.

#### 1.3 Definición de terminado (para cada tarea)

- Lint, typecheck y pruebas en verde (`pnpm lint && pnpm typecheck && pnpm test`).
- Pruebas unitarias para toda lógica en `packages/core` (progresión, cálculos nutricionales, cronómetros).
- Pantallas nuevas probadas en viewport móvil (375 × 812) y escritorio.
- Textos visibles en español; sin `TODO` sin issue asociado.
- Si cambia el esquema: migración de Drizzle generada y aplicada en local.

---

## 2. Producto

**Nombre: Stenia.** Del griego σθένος, "fuerza", la misma raíz de *calistenia* (κάλλος "belleza" + σθένος "fuerza"); en medicina, *astenia* es la falta de fuerza y Stenia es su contrario. Lema de trabajo: "Fuerza que se construye". En código, dominios técnicos y recursos usar el slug `stenia`.

- Dominios a asegurar: `stenia.app` y `steniaapp.com` (sin dueño registrado al 12 oct 2026; `stenia.com` está en venta).
- Marca: en México ya existe STENIA en clases 32, 33 y 35 (2025). Registrar en clases 9, 42, 41 y 44 con revisión previa de un agente de propiedad industrial.
- Pendiente: nombres de usuario en redes.

Web app instalable (PWA) que genera rutinas de gimnasio, calistenia o híbridas con IA, registra cada sesión en tiempo real y suma nutrición y seguimiento corporal. El MVP se valida con un solo usuario (el autor) en un gimnasio convencional combinado con calistenia.

**Objetivos del MVP**

- Rutina personalizada desde el cuestionario inicial y el equipamiento real del gimnasio.
- Registro en vivo de series, pesos, repeticiones y tiempos, mostrando siempre la última vez.
- Ajustes por revisiones periódicas basadas en datos.
- Metas nutricionales y plan de comidas con alimentos de bases verificadas.
- Infraestructura en el VPS propio con Dokploy y servicios gratuitos; único costo variable: consumo del LLM con API key propia.

**Fuera de alcance**: gestión de gimnasios (socios, pagos, check-in), app nativa, multiusuario a escala. El modelo de datos queda listo para crecer.

**Métricas de éxito (8 semanas de uso personal)**: ≥ 90% de sesiones registradas completas; registrar una serie en ≤ 3 toques; progresión en ≥ 80% de los ejercicios principales; una revisión completada por ciclo.

**Perfiles soportados**: gimnasio, calistenia e híbrido (MVP). La diferencia la marcan el equipamiento disponible y la proporción gimnasio/calistenia.

---

## 3. Stack y estructura

| Capa | Elección |
| --- | --- |
| App | Next.js (App Router, Server Actions, Route Handlers), `output: "standalone"` |
| Base de datos | PostgreSQL 18 (servicio nativo de Dokploy) + Drizzle ORM |
| Auth | Better Auth (correo + Google) sobre la misma Postgres |
| UI | Tailwind CSS + shadcn/ui + Motion + Lucide |
| PWA / offline | Serwist + Dexie (IndexedDB) |
| Estado cliente | TanStack Query + Zustand |
| Gráficas | Recharts |
| Visión | MediaPipe Tasks Vision (WASM en el navegador) |
| IA | Vercel AI SDK con proveedor configurable (Anthropic, OpenAI, Google, OpenRouter, compatible con OpenAI) |
| Archivos | Cloudflare R2 (bucket privado para fotos/tickets, bucket público para medios de ejercicios) |
| Notificaciones | Web Push con VAPID |
| Pruebas | Vitest (unidad), Playwright (e2e) |
| CI/CD | GitHub Actions → imagen en GHCR → webhook de redeploy de Dokploy |

Usa la última versión estable de cada dependencia al iniciar y fíjala en `package.json`.

```
apps/web            Next.js (UI, Server Actions, API, PWA)
packages/core       motor de progresión, cálculos nutricionales, cronómetros, esquemas zod compartidos
packages/db         esquema Drizzle, migraciones (carpeta drizzle/), semillas, migrador de arranque
packages/ai         prompts versionados, cliente LLM, validación de salidas, contador de costo
scripts/            importadores Bun (free-exercise-db, calistenia, RepDB, USDA, INCMNSZ)
infra/              Dockerfile, docker-compose.dev.yml
.github/workflows/  ci-deploy.yml
docs/decisions.md   decisiones tomadas por el agente
AGENTS.md
```

**Scripts raíz esperados**: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm db:generate`, `pnpm db:migrate`, `bun run scripts/import-exercises.ts`, `bun run scripts/import-foods.ts`.

**Desarrollo local**: `infra/docker-compose.dev.yml` con Postgres 18; `.env.local` desde `.env.example`.

### 3.1 Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión a Postgres (en producción, host interno de Dokploy) |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sesiones de Better Auth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Inicio de sesión con Google |
| `ADMIN_EMAILS` | Correos con rol `admin` (acceso a configuración de desarrollador) |
| `ENCRYPTION_KEY` | 32 bytes en base64 para cifrar la API key del LLM (AES-256-GCM) |
| `AI_PROVIDER`, `AI_API_KEY` | Opcionales: sobrescriben lo guardado en la pantalla de desarrollador |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Acceso S3 a R2 |
| `R2_BUCKET_PRIVATE`, `R2_BUCKET_PUBLIC`, `R2_PUBLIC_BASE_URL` | Buckets y URL pública de medios |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `CRON_SECRET` | Autoriza las llamadas de las tareas programadas a `/api/cron/*` |
| `USDA_FDC_API_KEY` | Solo para el importador de alimentos |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app |

---

## 4. Registro y cuestionario inicial

Registro con correo o Google; después, cuestionario de 8 bloques. Solo los bloques 1, 2, 5 y 6 son obligatorios para generar la primera rutina.

| # | Bloque | Campos | Uso | Obligatorio |
| --- | --- | --- | --- | --- |
| 1 | Seguridad | PAR-Q+ (7 preguntas sí/no + seguimiento) y criterio ACSM | Recomendar valoración médica e intensidad inicial | Sí |
| 2 | Datos corporales | Fecha de nacimiento, sexo, estatura (cm), peso (kg) | Cálculo calórico, cargas iniciales | Sí |
| 3 | Datos conocidos | % grasa (InBody/BIA/DEXA), circunferencias, TMB medida | Katch-McArdle, línea base corporal | No |
| 4 | Nivel actual | Meses entrenando; máx. flexiones, dominadas, fondos; segundos de plancha; pesos de trabajo en press, sentadilla, remo | Ubicar al usuario en cada escalera de progresión | Recomendado |
| 5 | Objetivo | Hipertrofia, fuerza, pérdida de grasa, recomposición o skills; skills meta; proporción gym/calistenia (0–100) | Rangos de reps, volumen, selección | Sí |
| 6 | Logística | Días por semana (2–6), minutos por sesión, días preferidos | Split y número de ejercicios | Sí |
| 7 | Lesiones y dolor | Zonas, movimientos que duelen, cirugías | Excluir o sustituir ejercicios | Recomendado |
| 8 | Recuperación y preferencias | Sueño (h), estrés (1–5), actividad diaria, ejercicios favoritos y vetados | Volumen tolerable, factor de actividad | No |

**Regla de seguridad**: el PAR-Q+ empieza con siete preguntas generales; cualquier "sí" abre preguntas de seguimiento en lugar de aprobar automáticamente. El criterio ACSM decide con tres factores: si la persona ya entrena, si tiene enfermedad cardiovascular, metabólica o renal (o síntomas) y la intensidad deseada. Con bandera: mostrar recomendación de valoración médica, guardar la decisión del usuario y limitar la rutina a intensidad ligera–moderada.

**UX**: una pregunta por pantalla, barra de progreso, "saltar" en opcionales, resumen editable antes de generar.

**Aceptación**: no se puede generar rutina sin bloques obligatorios; una respuesta "sí" en PAR-Q+ siempre muestra seguimiento y deja registro en `screening`.

---

## 5. Perfil de equipamiento

Cada usuario tiene uno o más `gym_profile` (gimnasio, casa, parque). El generador solo propone ejercicios cuyo equipo requerido está en el perfil activo.

| Categoría | Opciones | Dato extra |
| --- | --- | --- |
| Máquinas | Prensa, hack, extensión y curl femoral, aductor/abductor, polea alta y baja, cruce de poleas, jalón, remo sentado, press de pecho, pec deck, Smith, pantorrilla | — |
| Peso libre | Mancuernas, barra olímpica, barra Z, discos, kettlebells, bancos, rack | Rango de mancuernas (mín–máx, incremento) |
| Estructuras | Barra de dominadas, paralelas, estación de fondos, anillas, TRX, espaldera, paralettes, bandas | Resistencia de bandas |
| Espacio | Pared para pino, suelo para L-sit/planche, espacio para saltos | Sí/no |
| Lastre | Cinturón con cadena, chaleco, mochila | Kg disponibles y paso mínimo |

**Reglas**: cada ejercicio declara equipo requerido y alternativas por patrón de movimiento; si falta equipo se sustituye por el mismo patrón; botón "Hoy no está disponible" durante la sesión ofrece sustitutos sin regenerar la rutina; el lastre habilita `weighted_bw`.

---

## 6. Generación de rutina con IA

El código decide estructura y límites; el LLM elige ejercicios del catálogo filtrado y explica; la salida se valida antes de guardarse.

1. **Contexto**: cuestionario, perfil de equipamiento activo, historial (si existe).
2. **Reglas deterministas** (editables en configuración):
   - Split: 2 días = cuerpo completo; 3 = cuerpo completo o push/pull/legs; 4 = torso/pierna; 5–6 = push/pull/legs o híbrido.
   - Volumen semanal por grupo muscular según nivel, conservador al inicio.
   - Rangos: fuerza 3–6 reps; hipertrofia 6–15; calistenia por umbral de reps o segundos.
   - Descanso: compuesto pesado 120–180 s; accesorio 60–90 s; isométrico de skill 120–180 s.
3. **Filtro**: equipo disponible, lesiones, vetados, prerrequisitos del grafo de progresiones.
4. **LLM**: recibe catálogo filtrado (IDs + metadatos compactos) y restricciones; devuelve JSON (esquema abajo).
5. **Validación**: IDs existentes, equipo disponible, volumen en rango, duración estimada ≤ minutos por sesión. Si falla: reintento con los errores (máx. 2) y luego plantilla determinista.
6. **Versión**: guardar como `routine_version` inmutable con autor (`ai`/`user`) y justificación.

```ts
// packages/core/src/schemas/routine.ts
export const RoutinePlan = z.object({
  rationale: z.string().max(600),
  days: z.array(z.object({
    name: z.string().max(40),
    exercises: z.array(z.object({
      exerciseId: z.string(),
      sets: z.number().int().min(1).max(6),
      repMin: z.number().int().min(1).max(30).nullable(),
      repMax: z.number().int().min(1).max(30).nullable(),
      targetSeconds: z.number().int().min(5).max(120).nullable(),
      rirTarget: z.number().int().min(0).max(4),
      restSeconds: z.number().int().min(30).max(300),
      notes: z.string().max(200).optional(),
    })).min(3).max(9),
  })).min(2).max(6),
});
```

### 6.1 Motor de progresión (determinista, `packages/core`)

| Tipo de carga | Subir | Bajar |
| --- | --- | --- |
| `external` (kg) | Doble progresión: todas las series en el tope del rango con RIR ≥ 1 → +1 incremento mínimo del equipo | 2 sesiones fallidas = mantener; 3 = descarga del 10% |
| `bodyweight` | Umbral de reps o segundos en 3 sesiones seguidas → siguiente variante del grafo | Fallo repetido → variante anterior |
| `assisted` | Umbral alcanzado → menos asistencia | Fallo repetido → más asistencia |
| `weighted_bw` | Umbral en la variante final → +lastre mínimo disponible | Igual que `external` |
| `isometric` | Tiempo objetivo en todas las series → +5 s o siguiente variante | Fallo repetido → variante anterior |

Semana de descarga cada 4–8 semanas o cuando una revisión detecta fatiga.

**Aceptación**: pruebas unitarias con casos de subida, mantenimiento, descarga y cambio de variante para los cinco tipos.

---

## 7. Tracking de rutina en tiempo real

Al abrir un ejercicio en sesión, primero se ve la última vez, la meta de hoy y filas precargadas: registrar una serie cuesta un toque.

**Flujo**: Empezar sesión (inicia cronómetro de sesión) → Abrir ejercicio (última vez + meta) → Registrar serie (kg × reps, RIR) → Descanso (cuenta regresiva) → ¿más series? sí: vuelve a registrar · no → ¿más ejercicios? sí: abre el siguiente · no → Terminar (resumen comparado).

**Vista de ejercicio**

1. Encabezado: nombre, miniatura animada (abre el detalle), músculos, tiempo del ejercicio.
2. "Última vez": fecha y cada serie como `kg × reps (RIR)` o `variante × segundos`, mejor serie histórica y 1RM estimado.
3. "Hoy": meta sugerida (p. ej., `62.5 kg × 8–12, RIR 1–2`) con la razón en una línea.
4. Filas precargadas con los valores de la última vez; +/− y ✓. Delta por fila: `--up` si sube, gris si iguala, `--down` si baja.
5. Acciones: añadir serie, nota, RIR (0–4), sustituir ejercicio, "equipo ocupado".

"Última vez" = sesión más reciente del mismo día de rutina; si no existe, la última vez que se hizo ese ejercicio.

| Cronómetro | Inicia | Termina | Se guarda |
| --- | --- | --- | --- |
| Sesión | "Empezar entrenamiento" | "Terminar" (pausa opcional) | Duración total y pausa acumulada |
| Ejercicio | Primera serie iniciada | Última serie marcada | Duración por ejercicio |
| Serie isométrica | "Iniciar" en la fila | Objetivo alcanzado o detener | Segundos logrados |
| Descanso | ✓ en una serie | Cuenta regresiva del descanso recomendado; ±15 s, saltar | Descanso real vs. recomendado |

**Requisitos técnicos**

- Calcular siempre desde marcas de tiempo (`startedAt` + pausas), nunca sumando ticks.
- Screen Wake Lock cuando el navegador lo permita.
- Fin de descanso: sonido, vibración donde exista y notificación si la PWA está en segundo plano.
- Estado de sesión en IndexedDB (Dexie); sincronización al reconectar sin duplicados (IDs generados en cliente).

**Resumen al terminar**: duración total y por ejercicio, volumen (kg), récords, comparación con la sesión anterior del mismo día, esfuerzo (1–10), notas.

**Aceptación**: los cronómetros siguen correctos tras bloquear la pantalla 5 minutos; una recarga a mitad de sesión no pierde series; registrar una serie precargada = 1 toque.

---

## 8. Detalle de ejercicio y catálogo

**Ficha**: animación de dos fases (inicio → fin, transición en bucle), video de YouTube opcional (`youtube-nocookie.com`), pasos, errores comunes, cues, músculos en mapa SVG, equipo y alternativas, escalera de progresión, recomendación personalizada del LLM (generada una vez y cacheada), historial del usuario y atribución visible.

| Fuente | Aporta | Licencia | Uso |
| --- | --- | --- | --- |
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 800+ ejercicios, JSON + 2 JPG por ejercicio | Unlicense (dominio público) | Base del catálogo y animación |
| [Martjn/calisthenics_exercises](https://huggingface.co/datasets/Martjn/calisthenics_exercises) | 170 ejercicios de calistenia × 3 progresiones | Apache-2.0 (imágenes enlazadas con su propia licencia) | Grafo de progresiones |
| [RepDB free](https://github.com/sergei-argutin/exercise-dataset) | 250 ejercicios con instrucciones en español | Gratis con atribución visible obligatoria | Textos en español e ilustraciones |
| [wger](https://github.com/wger-project/wger) | Imágenes y páginas | Imágenes CC-BY-SA | Respaldo con atribución |

**Reglas**: no usar GIFs de ExerciseDB sin licencia confirmada; cada medio guarda `source`, `license`, `attribution_url`; traducciones del LLM marcadas `reviewed: false` hasta revisión humana. Las imágenes se espejan en el bucket público de R2.

---

## 9. Progreso, escaneo corporal y revisiones

### 9.1 Comparaciones y récords

| Comparación | Dónde | Métricas |
| --- | --- | --- |
| Serie vs. última vez | Fila de la serie | Δ kg, Δ reps, Δ segundos, Δ variante |
| Sesión vs. anterior del mismo día | Resumen | Volumen, duración, descanso promedio |
| Semana vs. semana | Progreso | Series efectivas por grupo, adherencia |
| Bloque vs. bloque | Revisión | 1RM estimado, nivel de variante, medidas |

Récords automáticos: mayor peso, más reps con un peso, mayor 1RM estimado, mayor volumen, isométrico más largo, nueva variante. 1RM (Epley, solo ≤ 12 reps): `1RM = w × (1 + r / 30)`.

Gráficas por ejercicio (línea de mejor serie y 1RM, barras de volumen) y mapa muscular semanal.

### 9.2 Escaneo corporal

| Nivel | Captura | Resultado |
| --- | --- | --- |
| 1 (MVP) | Peso y circunferencias con guía | % grasa por fórmula de la Marina de EE.UU. |
| 2 | Foto del ticket InBody/BIA/DEXA → LLM con visión extrae → usuario confirma | % grasa, masa magra, TMB |
| 3 | Fotos frente/perfil/espalda con MediaPipe validando pose y encuadre | Comparación lado a lado |
| 4 (experimental) | % grasa por foto con LLM, etiquetado como aproximado | Solo referencia |

Fórmula de la Marina (cm):

- Hombre: `%G = 495 / (1.0324 − 0.19077·log10(cintura − cuello) + 0.15456·log10(estatura)) − 450`
- Mujer: `%G = 495 / (1.29579 − 0.35004·log10(cintura + cadera − cuello) + 0.22100·log10(estatura)) − 450`

Fotos: opt-in explícito, bucket privado, URLs firmadas de corta duración, borrado desde configuración, nunca al LLM sin acción explícita.

### 9.3 Revisiones periódicas

Modo fijo (semanal, quincenal, mensual) o automático.

| Tipo | Frecuencia automática | Pide |
| --- | --- | --- |
| Ligera | Semanal | Peso promedio, adherencia, energía, sueño, esfuerzo (1–5) |
| Completa | Mensual o fin de bloque | Lo anterior + medidas, fotos opcionales, valoración del plan |
| Adelantada | Por disparador | Preguntas del disparador |

Disparadores: estancamiento 2–3 semanas; peso fuera de tendencia 2 semanas; ≥ 2 sesiones perdidas en la semana; esfuerzo alto con rendimiento a la baja; dolor reportado.

Después: el código calcula tendencias (peso con media móvil exponencial, progreso, adherencia); el LLM resume y propone ajustes dentro de las reglas; el usuario acepta, edita o rechaza cada ajuste. Nunca decidir con un solo pesaje.

---

## 10. Nutrición

| Fuente | Cobertura | Condiciones | Uso |
| --- | --- | --- | --- |
| [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide) | Alimentos genéricos y de marca | Dominio público, citar fuente; API 1,000 peticiones/h por IP | Importar a Postgres |
| [Tabla INCMNSZ 2019 (CONABIO)](https://siagro.conabio.gob.mx/nutricion/download/Detalles_tecnicos.pdf) | 3,928 registros de alimentos consumidos en México | Licencia no localizada: **confirmar antes de uso público** | Alimentos mexicanos |
| [Open Food Facts](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api) | Productos por código de barras | ODbL: atribución y share-alike | Escáner; datos en filas `source = 'off'` sin mezclarse en exportaciones |

**Metas según datos disponibles**

| Datos | Método |
| --- | --- |
| Edad, sexo, estatura, peso | Mifflin-St Jeor × factor de actividad: `10·kg + 6.25·cm − 5·edad + (5 hombre / −161 mujer)` |
| % grasa conocido | Katch-McArdle: `370 + 21.6 · masa magra (kg)` |
| TMB medida | Usar directamente |
| ≥ 2–3 semanas de registro | Gasto adaptativo: ingesta promedio − energía del cambio de peso suavizado |

Proteína (ISSN): 1.4–2.0 g/kg/día; en déficit con entrenamiento de fuerza, 2.3–3.1 g/kg; 20–40 g por toma cada 3–4 h.

**Plan de comidas**: el LLM propone menú con `food_id` y gramos; el servidor recalcula macros y ajusta porciones a ±5% de kcal con la proteína cubierta; vista en gramos o equivalentes; lista de compras; sustituciones.

**Salvaguardas**: sin planes para embarazo, lactancia, diabetes, enfermedad renal o historial de trastornos alimentarios (derivar a profesional); piso de calorías y ritmo máximo de pérdida configurables, conservadores por defecto.

---

## 11. Configuración de desarrollador e IA

Pantalla `/settings/developer`, solo rol `admin`.

| Campo | Detalle |
| --- | --- |
| Proveedor | Anthropic, OpenAI, Google, OpenRouter, compatible con OpenAI (URL base) |
| API key | Enmascarada; tras guardar solo últimos 4 caracteres; "Reemplazar" |
| Probar conexión | Llamada mínima; muestra latencia y error legible |
| Modelos por tarea | Planificación, rápido, visión, respaldo |
| Temperatura / máx. tokens | Por tarea; bajos en planificación |
| Presupuesto mensual (USD) | 80% avisa; 100% bloquea llamadas no esenciales |
| Enviar fotos al LLM | Apagado por defecto |
| Registro de prompts | Sin datos personales |

**Reglas**: key cifrada con AES-256-GCM (`ENCRYPTION_KEY`); `AI_API_KEY` en entorno sobrescribe; todas las llamadas desde el servidor; tabla `ai_usage` con tokens y costo por llamada; prompts versionados en `packages/ai`; las notas del usuario van marcadas como datos, nunca como instrucciones.

**Modelos de referencia** (USD por millón de tokens, entrada/salida, 12 oct 2026):

| Proveedor | Planificación | Rápido |
| --- | --- | --- |
| Anthropic | `claude-opus-5-5` $4/$20 (punto medio `claude-sonnet-5-5` $2/$10) | `claude-haiku-5-5` desde $0.10/$0.50 |
| OpenAI | `gpt-6.1-sol` $2/$10 | `gpt-6-luna` $0.10/$0.50 |
| Google | Gemini 3.1 Pro Preview $2/$12 | Gemini 3.8 Flash $0.75/$3.75 (hasta 31 dic 2026) |

El nivel gratuito de Gemini usa el contenido para mejorar sus productos: solo para desarrollo con datos ficticios.

---

## 12. Infraestructura: runbook con el MCP de Dokploy

**Estado del VPS al 12 oct 2026**: Dokploy v0.30.2; 2 vCPU; 8 GB RAM (~3 GB libres); disco 103 GB (~26 GB libres, 75% usado); 47 servicios activos; **sin destinos de respaldo**. Por eso: no se instala Supabase, no se compila en el VPS y se limitan recursos.

Nombres por defecto (cambiar si el usuario indica otros): proyecto `stenia`, Postgres `stenia-db`, app `stenia-web`, base `stenia`, imagen `ghcr.io/<owner>/stenia-web`.

### 12.1 Prerrequisitos que entrega el usuario

- [ ] Bucket de R2 para respaldos (`stenia-backups`) y token S3 con lectura/escritura: Access Key ID, Secret Access Key, Account ID.
- [ ] Buckets de R2 para la app: `stenia-private` y `stenia-public` (con dominio público).
- [ ] Repositorio en GitHub y PAT con `read:packages` (si la imagen de GHCR es privada).
- [ ] Subdominio para la app con registro DNS A apuntando a la IP del VPS.
- [ ] Credenciales OAuth de Google.

### 12.2 Pasos (ejecutar en orden, verificar cada uno)

Las herramientas se llaman `mcp__remote-devices__dokploy-mcp__<nombre>` (o `dokploy-mcp__<nombre>` según el cliente).

**Paso 0 — Verificar estado (solo lectura)**

- `project-all` → confirmar que no existe un proyecto `stenia`. Si existe, reutilizarlo; no duplicar.
- `docker-getServerHealth` `{ "sinceHours": 24 }` → continuar solo si hay ≥ 1.5 GB de RAM libre y ≥ 10 GB de disco libre. Si no, detenerse y avisar.

**Paso 1 — Liberar disco (requiere aprobación explícita del usuario)**

- `settings-cleanUnusedImages` `{}` y `settings-cleanDockerBuilder` `{}`.
- Advertir antes: las apps detenidas de otros proyectos tendrán que volver a descargar o construir su imagen.

**Paso 2 — Destino de respaldos en R2**

- `destination-testConnection` y, si pasa, `destination-create` con:

```json
{
  "name": "r2-stenia-backups",
  "provider": "Cloudflare",
  "accessKey": "<R2_ACCESS_KEY_ID>",
  "secretAccessKey": "<R2_SECRET_ACCESS_KEY>",
  "bucket": "stenia-backups",
  "region": "auto",
  "endpoint": "https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
}
```

- Guardar `destinationId`. Si `provider` es rechazado, consultar los valores que acepta la UI de Dokploy para R2.

**Paso 3 — Proyecto**

- `project-create` `{ "name": "stenia", "description": "Web app de gimnasio y calistenia con IA (MVP personal)" }`
- Obtener `projectId` y el `environmentId` del entorno `production` (si no vienen en la respuesta, `project-all` y buscar por nombre).

**Paso 4 — Postgres**

- Generar contraseña aleatoria de 32+ caracteres (sin imprimirla).
- `postgres-create`:

```json
{
  "name": "stenia-db",
  "appName": "stenia-db",
  "databaseName": "stenia",
  "databaseUser": "stenia",
  "databasePassword": "<GENERADA>",
  "dockerImage": "postgres:18",
  "environmentId": "<environmentId>"
}
```

- `postgres-update` `{ "postgresId": "<id>", "memoryLimit": "536870912", "memoryReservation": "268435456" }` (512 MB / 256 MB en bytes). No asignar `externalPort`: la base no se expone.
- `postgres-deploy` `{ "postgresId": "<id>" }`
- `postgres-one` → confirmar estado `done` y leer el `appName` final (Dokploy puede añadir sufijo). `DATABASE_URL=postgresql://stenia:<GENERADA>@<appName>:5432/stenia`.

**Paso 5 — Respaldos**

- `backup-create`:

```json
{
  "backupType": "database",
  "databaseType": "postgres",
  "postgresId": "<postgresId>",
  "database": "stenia",
  "destinationId": "<destinationId>",
  "schedule": "0 9 * * *",
  "prefix": "stenia/postgres",
  "keepLatestCount": 14,
  "enabled": true
}
```

- `0 9 * * *` = 03:00 en Ciudad de México si el servidor usa UTC; confirmar la zona horaria del servidor.
- Ejecutar un respaldo manual (`backup-manualBackupPostgres` con el `backupId`) y verificar el archivo con `backup-listBackupFiles`.

**Paso 6 — Registro de GHCR (solo si la imagen es privada)**

- `registry-create` `{ "registryName": "ghcr", "registryType": "cloud", "registryUrl": "ghcr.io", "username": "<github_user>", "password": "<PAT>", "imagePrefix": "ghcr.io/<owner>" }`

**Paso 7 — Aplicación**

- Requisito: la imagen `ghcr.io/<owner>/stenia-web:latest` ya existe (primer push del workflow de la sección 13).
- `application-create` `{ "name": "stenia-web", "appName": "stenia-web", "environmentId": "<environmentId>", "sourceType": "docker" }`
- `application-saveDockerProvider` `{ "applicationId": "<id>", "dockerImage": "ghcr.io/<owner>/stenia-web:latest", "registryUrl": "ghcr.io", "username": "<github_user o null>", "password": "<PAT o null>" }`
- `application-saveEnvironment` `{ "applicationId": "<id>", "env": "<variables de 3.1 en formato KEY=VALUE>", "buildArgs": null, "buildSecrets": null, "createEnvFile": false }`
- `application-update` `{ "applicationId": "<id>", "memoryLimit": "1073741824", "memoryReservation": "268435456" }` (1 GB / 256 MB).
- `domain-create` `{ "applicationId": "<id>", "host": "<subdominio>", "port": 3000, "https": true, "certificateType": "letsencrypt", "domainType": "application", "path": "/" }`
- `application-deploy` `{ "applicationId": "<id>", "title": "Primer despliegue" }`
- `application-one` → confirmar estado `done`; leer `refreshToken` para armar la URL del webhook de despliegue y guardarla como secreto `DOKPLOY_DEPLOY_WEBHOOK` en GitHub.

**Paso 8 — Tareas programadas**

- `schedule-create`:

```json
{
  "name": "stenia-checkin-reminders",
  "scheduleType": "application",
  "applicationId": "<id>",
  "cronExpression": "0 9 * * *",
  "timezone": "America/Mexico_City",
  "shellType": "sh",
  "command": "wget -qO- --header \"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/checkins",
  "enabled": true
}
```

**Paso 9 — Verificación final**

- [ ] La app responde por HTTPS en el subdominio.
- [ ] Migraciones aplicadas al arrancar (ver logs).
- [ ] Existe al menos un respaldo en R2.
- [ ] `docker-getServerHealth` muestra RAM libre ≥ 1 GB tras el despliegue.
- [ ] Ningún otro proyecto de Dokploy cambió de estado.

Registrar todos los IDs creados (sin secretos) en `docs/decisions.md`.

---

## 13. Build y despliegue

**`infra/Dockerfile`** (monorepo; en `next.config.ts` fijar `output: "standalone"` y `outputFileTracingRoot` a la raíz del repo):

```dockerfile
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
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter web build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/packages/db/drizzle ./drizzle
USER app
EXPOSE 3000
CMD ["sh", "-c", "node apps/web/migrate.mjs && node apps/web/server.js"]
```

`migrate.mjs` usa el migrador de `drizzle-orm` (no `drizzle-kit`) contra `./drizzle`. Verificar rutas reales tras el primer build.

**`.github/workflows/ci-deploy.yml`** (usar la última versión mayor de cada action):

```yaml
name: ci-deploy
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - uses: oven-sh/setup-bun@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test
  image:
    if: github.ref == 'refs/heads/main'
    needs: check
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          file: infra/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/stenia-web:latest
            ghcr.io/${{ github.repository_owner }}/stenia-web:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - run: curl -fsS -X POST "${{ secrets.DOKPLOY_DEPLOY_WEBHOOK }}"
```

GHCR exige nombres en minúsculas: si el owner tiene mayúsculas, normalizarlo en un paso previo.

---

## 14. Modelo de datos (Postgres + Drizzle)

| Dominio | Tabla | Campos clave |
| --- | --- | --- |
| Usuario | `user` | email, nombre, rol (`user`/`admin`), unidades, idioma |
| Usuario | `profile` | nacimiento, sexo, estatura, objetivo, proporción gym/calistenia, días/semana, minutos/sesión, meses entrenando, sueño, estrés, actividad |
| Usuario | `screening` | respuestas PAR-Q+ (jsonb), banderas ACSM, valoración recomendada, aceptación |
| Usuario | `injury` | zona, movimientos a evitar, activa |
| Equipamiento | `gym_profile`, `gym_profile_equipment` | nombre, activo; equipo con metadatos (jsonb) |
| Catálogo | `equipment` | slug, categoría, nombre |
| Catálogo | `exercise` | slug, nombre es/en, patrón, músculos, `load_type` (`external`, `bodyweight`, `assisted`, `weighted_bw`, `isometric`), nivel, instrucciones, cues, errores, fuente, licencia, `reviewed` |
| Catálogo | `exercise_equipment` | ejercicio ↔ equipo |
| Catálogo | `exercise_progression` | de → a, umbral (jsonb) |
| Catálogo | `exercise_media` | tipo, url, orden, fuente, licencia, url de atribución |
| Plan | `routine`, `routine_version` | perfil, estado; versión inmutable, autor, justificación |
| Plan | `routine_day`, `routine_exercise` | orden, series, reps mín/máx, segundos, RIR, descanso (s), notas |
| Ejecución | `session` | día, `started_at`, `ended_at`, pausa (ms), esfuerzo, notas |
| Ejecución | `session_exercise` | orden, inicio, fin, sustituido de |
| Ejecución | `set_log` | número, kg, asistencia, lastre, reps, segundos, RIR, `completed_at`, descanso real/objetivo, es récord |
| Ejecución | `personal_record` | ejercicio, tipo, valor, serie origen, fecha |
| Seguimiento | `body_measurement` | fecha, peso, circunferencias, % grasa y método, masa magra, TMB, fuente |
| Seguimiento | `body_photo` | fecha, pose, llave en R2, landmarks (jsonb) |
| Seguimiento | `checkin`, `checkin_settings` | tipo, programada, completada, respuestas, resumen IA, cambios, decisión; modo, intervalo, próxima |
| Nutrición | `food` | fuente (`usda`/`incmnsz`/`off`/`custom`), id origen, nombre, macros por 100 g, porciones, licencia |
| Nutrición | `nutrition_target` | vigente desde, kcal, proteína, carbohidratos, grasa, método |
| Nutrición | `meal_plan`, `meal_log` | semana, plan (jsonb), versión; fecha, comida, alimento, gramos |
| IA | `ai_settings`, `ai_usage` | proveedor, key cifrada, modelos, presupuesto, interruptores; función, modelo, tokens, costo |

Todas las tablas de usuario llevan `user_id` y toda consulta verifica propietario en el servidor.

---

## 15. Diseño visual

Inspirado en el lenguaje visual de hemeron.com, sin su logo ni su nombre.

```css
:root {
  --bg: #0E0E0E;
  --surface: #141414;
  --surface-2: #161616;
  --card: rgba(255, 255, 255, 0.03);
  --border: rgba(255, 255, 255, 0.08);
  --text: #FFFFFF;
  --text-2: rgba(255, 255, 255, 0.72);
  --text-3: rgba(255, 255, 255, 0.5);
  --accent: #CE0037;
  --light-bg: #F6F6F5;
  --light-text: #111111;
  --up: /* verde a definir, contraste AA */;
  --down: /* ámbar a definir */;
  --protein: /* tono apagado */;
  --carbs: /* tono apagado */;
  --fat: /* tono apagado */;
  --radius-card: 14px;
  --radius-input: 10px;
  --radius-chip: 8px;
  --radius-pill: 999px;
}
```

- **Tipografía** (Fontshare, gratuitas): Clash Grotesk 500 para títulos, cronómetros y cifras (tracking −0.04em; títulos 36–56 px; cronómetro hasta 72 px); Switzer 400/500/600 para cuerpo (16–17.6 px); etiquetas Switzer 500, 12–13 px, mayúsculas, tracking 0.07em, `--text-3`. Cifras con `tabular-nums`.
- **Acento**: una sola cosa por pantalla (acción principal, cronómetro activo, serie en curso, récord).
- **Componentes**: botones píldora en mayúsculas 13 px; bordes de 1 px; sin sombras ni degradados; iconos Lucide trazo 1.5.
- **Motivos**: barra "Semana 6 de 12" con días entrenados; titulares que aparecen palabra por palabra; tarjeta de generación con estados ("Leyendo tu perfil → Eligiendo ejercicios → Validando"); ejercicios numerados 01–06; métricas grandes con etiqueta pequeña; View Transitions entre lista y ficha.
- **Pantallas**: Hoy, Sesión en vivo, Ficha de ejercicio, Progreso, Nutrición, Revisión, Perfil, Configuración. Navegación inferior de 4 pestañas en móvil, barra lateral en escritorio.
- **Accesibilidad**: contraste AA verificado; objetivos táctiles ≥ 44 px; `prefers-reduced-motion` desactiva animaciones.

---

## 16. Seguridad, privacidad y salvaguardas

- Aviso de privacidad y consentimiento expreso (datos de salud son sensibles), separado para fotos.
- Exportar todos los datos (JSON + CSV) y borrar la cuenta desde Configuración.
- TLS, cifrado en reposo, consultas solo desde el servidor con verificación de propietario.
- Respaldo diario a R2 con 14 copias y una restauración de prueba al mes.
- LLM: minimización (sin nombre ni correo), fotos apagadas por defecto, salidas validadas, presupuesto con corte.
- Salud: banderas PAR-Q+/ACSM limitan intensidad; dolor reportado → detener, sustituto y revisión adelantada; sin diagnósticos; leyenda "no es un dispositivo médico".
- Cuenta: Better Auth con cookies seguras, límite de intentos, `/settings/developer` protegido por rol.

---

## 17. Fases y tareas

**Fase 0 — Fundaciones**

- [ ] Monorepo pnpm, `AGENTS.md`, `docs/decisions.md`, lint, typecheck, Vitest, Playwright
- [ ] `infra/docker-compose.dev.yml` con Postgres 18; Drizzle con primera migración
- [ ] Better Auth (correo + Google) y rol `admin` por `ADMIN_EMAILS`
- [ ] Tokens de diseño, fuentes, componentes base, layout con navegación
- [ ] Importadores Bun de free-exercise-db, calistenia y RepDB; espejo de imágenes en R2 con atribución
- [ ] Pantalla `/settings/developer` con prueba de conexión
- [ ] Dockerfile + workflow; runbook de Dokploy (sección 12) completado
- **Puerta**: la app vacía corre en el subdominio con login y respaldo verificado

**Fase 1 — Rutina y tracking en vivo**

- [ ] Cuestionario con regla PAR-Q+/ACSM
- [ ] Perfiles de equipamiento y filtro de catálogo
- [ ] Generación con validación, reintentos y plantilla de respaldo
- [ ] Sesión en vivo completa (sección 7) y ficha de ejercicio (sección 8)
- [ ] Offline + sincronización
- **Puerta**: 8 sesiones reales sin pérdida de datos

**Fase 2 — Progreso y revisiones**

- [ ] Comparaciones, récords, gráficas, mapa muscular
- [ ] Medidas (fórmula de la Marina) y fotos guiadas con MediaPipe
- [ ] Revisiones fijas y automáticas con disparadores; motor de progresión aplicado
- **Puerta**: una revisión genera una nueva versión de rutina aceptada

**Fase 3 — Nutrición**

- [ ] Importación USDA (+ INCMNSZ tras confirmar términos)
- [ ] Metas, plan semanal con ajuste de porciones, lista de compras
- [ ] Registro diario con búsqueda, favoritos y escáner de código de barras
- [ ] Salvaguardas activas
- **Puerta**: 14 días de registro con plan usado

**Fase 4 — IA avanzada y visión**

- [ ] Lectura de ticket InBody con confirmación
- [ ] Gasto calórico adaptativo
- [ ] Conteo de reps por cámara (sentadilla, lagartija, dominada)
- [ ] % grasa por foto, experimental y etiquetado
- **Puerta**: decidir apertura a otros usuarios y recursos del VPS

---

## 18. Fuentes

- PAR-Q+ y cribado previo: https://open-exam-prep.com/study-guides/crossfit-l3/screening-assessment/screening-health-medical
- Algoritmo ACSM: https://open-exam-prep.com/study-guides/acsm-cep/patient-assessment/preparticipation-screening
- Regla de progresión en calistenia: https://github.com/code-knayam/saiyan-protocol
- free-exercise-db: https://github.com/yuhonas/free-exercise-db
- Calisthenics dataset: https://huggingface.co/datasets/Martjn/calisthenics_exercises
- RepDB free: https://github.com/sergei-argutin/exercise-dataset
- wger: https://github.com/wger-project/wger
- USDA FoodData Central API: https://fdc.nal.usda.gov/api-guide
- Tabla INCMNSZ 2019: https://siagro.conabio.gob.mx/nutricion/download/Detalles_tecnicos.pdf
- Open Food Facts (condiciones): https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api
- ISSN protein position stand: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/
- Grasa por foto (validación): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9243018/
- Google PhotoScan: https://research.google/blog/seeing-beyond-bmi-estimating-cardiometabolic-risk-with-smartphone-imagery/
- Digital Scale (IMC por foto): https://arxiv.org/abs/2508.20534v1
- Cloudflare R2 precios: https://developers.cloudflare.com/r2/pricing/
- Anthropic modelos: https://platform.claude.com/docs/en/models/overview
- OpenAI precios: https://developers.openai.com/api/docs/pricing
- Gemini precios: https://ai.google.dev/gemini-api/docs/pricing
- Diseño de referencia: https://hemeron.com
