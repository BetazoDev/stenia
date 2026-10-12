# Stenia — PRD de la web app de gimnasio y calistenia con IA

Oct 12, 2026 · @Manuel

## Resumen y objetivos

Web app instalable (PWA) que genera rutinas de gimnasio, calistenia o híbridas con IA, registra cada sesión en tiempo real y suma nutrición y seguimiento corporal. El MVP se valida primero con un solo usuario (el autor) en un gimnasio convencional combinado con calistenia.

**Nombre: Stenia.** Del griego σθένος, “fuerza”, la misma raíz de *calistenia* (κάλλος “belleza” + σθένος “fuerza”); en medicina, *astenia* es la falta de fuerza y Stenia es su contrario. Lema de trabajo: “Fuerza que se construye”. Dominios a asegurar: stenia.app y steniaapp.com (sin dueño registrado al 12 oct 2026). Marca: en México ya existe STENIA en clases 32, 33 y 35 (2025); registrar en clases 9, 42, 41 y 44 con revisión previa de un agente de propiedad industrial. Pendiente: nombres de usuario en redes.

**Objetivos del MVP**

- Generar una rutina personalizada desde el cuestionario inicial y el equipamiento real del gimnasio.
- Registrar series, pesos, repeticiones y tiempos durante la sesión, mostrando siempre lo que se hizo la última vez.
- Ajustar la rutina con revisiones periódicas basadas en datos: rendimiento, peso, medidas y fotos.
- Dar metas nutricionales y un plan de comidas construido con alimentos de bases de datos verificadas.
- Infraestructura en el VPS existente con Dokploy y servicios gratuitos (Cloudflare R2, GitHub Actions); el único costo variable es el consumo del LLM con API key propia.

**Fuera de alcance del MVP**: gestión de gimnasios (socios, pagos, check-in), app nativa y operación multiusuario a escala. El modelo de datos sí queda listo para crecer a eso.

**Métricas de éxito tras 8 semanas de uso personal**

- 90% o más de las sesiones registradas completas en la app.
- Registrar una serie en 3 toques o menos.
- Progresión (más carga, reps o una variante más difícil) en al menos 80% de los ejercicios principales.
- Una revisión completada en cada ciclo configurado.

## Usuarios y casos de uso

Un mismo modelo sirve a tres perfiles; la diferencia está en el equipamiento disponible y en la proporción gimnasio/calistenia elegida.

| Perfil | Necesidad principal | Ejemplo de rutina |
| --- | --- | --- |
| Gimnasio | Hipertrofia o fuerza con máquinas y peso libre | Upper/Lower 4 días con doble progresión |
| Calistenia | Fuerza relativa y skills (muscle-up, pino, front lever) | Push/Pull/Legs con escaleras de progresión y trabajo de skill |
| Híbrido (MVP) | Gimnasio convencional más básicos de calistenia | Dominadas lastradas y fondos + máquinas de pierna y aislamiento |

**Casos de uso principales**

1. Registrarse, contestar el cuestionario y recibir la primera rutina.
2. Declarar el equipamiento del gimnasio y regenerar la rutina si cambia.
3. Entrenar con la app abierta: ver la última vez, registrar series y seguir los cronómetros.
4. Consultar técnica, recomendaciones y animación de un ejercicio.
5. Revisar progreso (récords, volumen, gráficas) y completar revisiones periódicas.
6. Recibir metas nutricionales y un plan de comidas, y registrar lo que se come.

## Registro y cuestionario inicial

El registro pide correo o Google y después un cuestionario de 8 bloques; solo los bloques 1 y 2 son obligatorios para generar la primera rutina, el resto la afina.

| # | Bloque | Campos | Para qué se usa | Obligatorio |
| --- | --- | --- | --- | --- |
| 1 | Seguridad | PAR-Q+ (7 preguntas sí/no y seguimiento) + criterio ACSM | Decidir si se recomienda valoración médica y la intensidad inicial | Sí |
| 2 | Datos corporales | Edad, sexo, estatura (cm), peso (kg) | Cálculo calórico, cargas iniciales | Sí |
| 3 | Datos conocidos (opcional) | % grasa (InBody/BIA/DEXA), circunferencias, TMB medida | Katch-McArdle y punto de partida del seguimiento corporal | No |
| 4 | Nivel actual | Meses entrenando; máx. flexiones, dominadas, fondos; segundos de plancha; pesos de trabajo en press, sentadilla, remo | Ubicar al usuario en cada escalera de progresión | Recomendado |
| 5 | Objetivo | Hipertrofia, fuerza, pérdida de grasa, recomposición o skills; skills meta; proporción gym/calistenia (slider 0–100) | Rangos de reps, volumen, selección de ejercicios | Sí |
| 6 | Logística | Días por semana (2–6), minutos por sesión, días preferidos | Split y número de ejercicios por sesión | Sí |
| 7 | Lesiones y dolor | Zonas, movimientos que duelen, cirugías | Excluir o sustituir ejercicios | Recomendado |
| 8 | Recuperación y preferencias | Horas de sueño, estrés (1–5), actividad diaria, ejercicios favoritos y vetados | Volumen tolerable, factor de actividad, adherencia | No |

**Regla de seguridad.** El PAR-Q+ empieza con siete preguntas generales y cualquier “sí” lleva a preguntas de seguimiento en vez de aprobar automáticamente ([fuente](https://open-exam-prep.com/study-guides/crossfit-l3/screening-assessment/screening-health-medical)). El algoritmo del ACSM decide si hace falta autorización médica con tres factores: si la persona ya entrena, si tiene enfermedad cardiovascular, metabólica o renal o síntomas, y la intensidad deseada ([fuente](https://open-exam-prep.com/study-guides/acsm-cep/patient-assessment/preparticipation-screening)). Si hay bandera, la app muestra la recomendación de valoración médica, guarda la decisión del usuario y limita la rutina a intensidad ligera–moderada.

**UX del cuestionario**: una pregunta por pantalla, barra de progreso, “saltar” en los opcionales y resumen final editable antes de generar.

## Perfil de equipamiento

Cada usuario declara uno o más perfiles de lugar (`GymProfile`: gimnasio, casa, parque) y el generador solo propone ejercicios cuyo equipo requerido está disponible en el perfil activo.

| Categoría | Opciones del checklist | Dato extra |
| --- | --- | --- |
| Máquinas | Prensa, hack, extensión y curl femoral, aductor/abductor, polea alta y baja, cruce de poleas, jalón, remo sentado, press de pecho, pec deck, Smith, pantorrilla | — |
| Peso libre | Mancuernas, barra olímpica, barra Z, discos, kettlebells, bancos (plano, inclinable), rack | Rango de mancuernas (kg mín–máx, incremento) |
| Estructuras | Barra de dominadas, paralelas, estación de fondos, anillas, TRX, espaldera, paralettes, bandas | Resistencia de bandas |
| Espacio | Pared libre para pino, suelo para L-sit y planche, espacio para saltos | Sí/no por tipo |
| Lastre | Cinturón con cadena, chaleco, mochila | Kg disponibles y paso mínimo |

**Reglas**

- Cada ejercicio del catálogo declara `requires: equipment[]` y `alternatives: exercise_id[]` por patrón de movimiento.
- Si falta un equipo, se sustituye por otro ejercicio del mismo patrón (p. ej., jalón al pecho ↔ dominada asistida con banda).
- Botón “Hoy no está disponible” en plena sesión: marca el equipo como ocupado y ofrece sustitutos sin regenerar la rutina.
- El lastre habilita la progresión `weighted_bw` en dominadas y fondos cuando el usuario supera el umbral de reps.

## Generación de rutina con IA

El código decide la estructura y los límites de seguridad; el LLM solo elige ejercicios del catálogo filtrado y explica sus decisiones, y su salida se valida antes de guardarse.

**Flujo de generación**

1. **Contexto**: cuestionario, perfil de equipamiento activo e historial de sesiones (si existe).
2. **Reglas deterministas** (valores iniciales editables en configuración):
   - Split por días: 2 = cuerpo completo, 3 = cuerpo completo o push/pull/legs, 4 = torso/pierna, 5–6 = push/pull/legs o híbrido.
   - Volumen semanal por grupo muscular según nivel, empezando conservador y subiendo solo si la recuperación lo permite.
   - Rangos por objetivo: fuerza 3–6 reps, hipertrofia 6–15 reps, calistenia por umbral de reps o segundos.
   - Descanso recomendado por tipo: compuesto pesado 2–3 min, accesorio 60–90 s, isométrico de skill 2–3 min.
3. **Filtro de catálogo**: equipo disponible, lesiones, ejercicios vetados y prerrequisitos del grafo de progresiones.
4. **LLM**: recibe el catálogo filtrado (IDs y metadatos) y las restricciones; devuelve JSON validado con zod: días → ejercicios con `exercise_id`, series, rango de reps o segundos, RIR objetivo, descanso, notas y una explicación breve.
5. **Validación**: los IDs existen, el equipo está disponible, el volumen cae en rango y la duración estimada no supera los minutos por sesión. Si falla, se reintenta con los errores (máximo 2) y después se usa una plantilla determinista.
6. **Versión**: cada rutina se guarda como `routine_version` inmutable para comparar antes y después de cada ajuste.

**Motor de progresión (determinista)**

| Tipo de carga | Regla para subir | Regla para bajar |
| --- | --- | --- |
| Externa (kg) | Doble progresión: todas las series en el tope del rango con RIR ≥ 1 → +1 incremento mínimo del equipo | 2 sesiones fallidas = mantener; 3 = descarga del 10% |
| Peso corporal | Umbral de reps o segundos en 3 sesiones seguidas → siguiente variante del grafo | Fallo repetido → variante anterior |
| Asistida (banda o contrapeso) | Umbral alcanzado → menos asistencia | Fallo repetido → más asistencia |
| Lastrada | Umbral en la variante final → +lastre mínimo disponible | Igual que carga externa |
| Isométrica | Tiempo objetivo en todas las series → +5 s o siguiente variante | Fallo repetido → variante anterior |

La regla de avanzar de variante tras 3 sesiones exitosas seguidas viene de un proyecto similar que la aplica a calistenia ([fuente](https://github.com/code-knayam/saiyan-protocol)). Se programa una semana de descarga cada 4–8 semanas o cuando una revisión detecta fatiga acumulada.

## Tracking de rutina en tiempo real

Al abrir un ejercicio dentro de una sesión, el usuario ve primero qué hizo la última vez, la meta de hoy calculada por el motor de progresión y filas de series ya precargadas, de modo que registrar una serie cuesta un toque.

&#91;embedded content: flujo de la sesión en vivo · 5 pasos, 2 decisiones\]

El cronómetro de sesión corre desde “Empezar” hasta “Terminar”; cada serie marcada inicia el descanso y el siguiente ciclo vuelve a la misma fila o al siguiente ejercicio.

**Vista de ejercicio en sesión**

1. **Encabezado**: nombre, miniatura animada (abre el detalle), músculos y tiempo del ejercicio en curso.
2. **“Última vez”**: fecha y cada serie como `kg × reps (RIR)` o `variante × segundos`, más la mejor serie histórica y el 1RM estimado.
3. **“Hoy”**: meta sugerida (p. ej., `62.5 kg × 8–12, RIR 1–2`) con la razón en una línea (“subes 2.5 kg: completaste 3×12 la vez pasada”).
4. **Filas de series**: precargadas con los valores de la última vez; el usuario ajusta con +/− y marca ✓. Cada fila muestra el delta frente a la última vez: verde si sube, gris si iguala, ámbar si baja.
5. **Acciones**: añadir serie, nota rápida, RIR opcional (0–4), sustituir ejercicio y “equipo ocupado”.

“Última vez” se toma de la sesión más reciente del mismo día de rutina; si no existe, de la última vez que se hizo el ejercicio en cualquier rutina.

**Cronómetros**

| Cronómetro | Inicia | Termina | Se guarda |
| --- | --- | --- | --- |
| Sesión | “Empezar entrenamiento” | “Terminar” (con pausa opcional) | Duración total y tiempo en pausa |
| Ejercicio | Primera serie iniciada | Última serie marcada | Duración por ejercicio |
| Serie isométrica | “Iniciar” en la fila | Tiempo objetivo o detener | Segundos logrados |
| Descanso | Al marcar ✓ una serie | Cuenta regresiva del descanso recomendado; ±15 s y saltar | Descanso real frente al recomendado |

**Requisitos técnicos de los cronómetros**

- Calcular siempre desde marcas de tiempo (`startedAt`, pausas acumuladas), nunca sumando ticks: así el tiempo es correcto aunque el navegador duerma la pestaña o se bloquee la pantalla.
- Mantener la pantalla encendida con Screen Wake Lock cuando el navegador lo permita.
- Aviso de fin de descanso con sonido, vibración donde exista y notificación si la PWA está en segundo plano.
- Estado de la sesión en IndexedDB: una recarga o un corte de red no pierde nada y se sincroniza al volver la conexión.

**Resumen al terminar**: duración total y por ejercicio, volumen total (kg), récords logrados, comparación con la sesión anterior del mismo día (volumen, duración, descanso promedio), esfuerzo de la sesión (1–10) y notas. Estos datos alimentan las revisiones periódicas.

## Detalle de ejercicio

La ficha de cada ejercicio combina datos de catálogos gratuitos con licencia clara: animación de dos fases como base, video de YouTube opcional y texto en español.

**Contenido de la ficha**

- Animación de inicio → fin (dos imágenes con transición en bucle, sin GIF pesado) y botón de video si hay uno curado.
- Pasos de ejecución, errores comunes y cues de técnica.
- Músculos principales y secundarios en un mapa corporal SVG.
- Equipo requerido y alternativas del mismo patrón de movimiento.
- Escalera de progresión (calistenia): variante anterior, actual y siguiente con su umbral.
- Recomendación personalizada del LLM, generada una vez y guardada en caché (“para ti: baja controlando 3 s; tu codo izquierdo se abre según tu nota del martes”).
- Historial del usuario: mejor serie, 1RM estimado y última sesión.
- Atribución visible de la fuente de la imagen y del texto.

**Fuentes del catálogo (todas gratuitas)**

| Fuente | Aporta | Formato | Licencia | Uso |
| --- | --- | --- | --- | --- |
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 800+ ejercicios de gimnasio con instrucciones, músculos, equipo y nivel | JSON + 2 JPG por ejercicio (`0.jpg`, `1.jpg`) | Unlicense (dominio público) | Base del catálogo y de la animación de dos fases |
| [Martjn/calisthenics\_exercises](https://huggingface.co/datasets/Martjn/calisthenics_exercises) | 170 ejercicios de calistenia con 3 progresiones cada uno | JSONL con enlaces a imágenes externas | Apache-2.0 (las imágenes enlazadas conservan su licencia) | Grafo de progresiones de calistenia |
| [RepDB free](https://github.com/sergei-argutin/exercise-dataset) | 250 ejercicios con instrucciones en inglés, alemán y español | JSON + WebP 512 px, poses inicio/pico | Gratis con atribución obligatoria y enlace visible | Textos en español e ilustraciones uniformes |
| [wger](https://github.com/wger-project/wger) | Imágenes y páginas de ejercicios | API REST | Imágenes CC-BY-SA | Respaldo de imágenes con atribución |
| YouTube (embed) | Videos de técnica curados a mano | iframe `youtube-nocookie.com` | Según los términos de YouTube; no se descarga ni se aloja | Botón “Ver video” |

**Reglas de licencias**

- No usar GIFs de ExerciseDB mientras su licencia no esté confirmada por escrito.
- Guardar en cada imagen `source`, `license` y `attribution_url`, y mostrar la atribución en la ficha.
- Traducir al español con el LLM y revisión humana; marcar `reviewed: true` antes de mostrarse como texto definitivo.

## Progreso y comparaciones

Cada serie registrada alimenta comparaciones de pesos y repeticiones en cuatro niveles: serie contra la última vez, sesión contra la anterior del mismo día, semana contra semana y bloque contra bloque.

| Comparación | Dónde se ve | Métricas |
| --- | --- | --- |
| Serie vs. última vez | En la fila de la serie, durante la sesión | Δ kg, Δ reps, Δ segundos, Δ variante |
| Sesión vs. anterior del mismo día | Resumen al terminar | Volumen total, duración, descanso promedio, ejercicios con progreso |
| Semana vs. semana | Pantalla Progreso | Series efectivas por grupo muscular, sesiones completadas, adherencia |
| Bloque vs. bloque (4–8 semanas) | Revisión periódica | 1RM estimado por ejercicio principal, nivel de variante, medidas corporales |

**Récords personales detectados automáticamente**: mayor peso, más reps con un peso dado, mayor 1RM estimado, mayor volumen en una sesión, isométrico más largo y nueva variante desbloqueada. Se celebran con una animación breve al marcar la serie.

**1RM estimado (Epley)**, solo para series de hasta 10–12 reps:

```latex
1RM = w \left(1 + \frac{r}{30}\right)
```

donde w es el peso levantado (kg) y r las repeticiones completadas.

**Gráficas por ejercicio**: mejor serie y 1RM estimado en el tiempo (línea), volumen por sesión (barras) y reps con el peso de trabajo actual. En calistenia, el eje es el nivel de variante y las reps o segundos dentro de cada nivel.

**Mapa muscular semanal**: intensidad por grupo según series efectivas, con `react-body-highlighter` o `body-highlighter` (mapas SVG de código abierto; confirmar licencia al integrar).

## Escaneo corporal por niveles

El escaneo es opcional y escalonado: el MVP usa medidas con cinta y datos que el usuario ya tenga; la estimación de grasa por foto queda como experimento etiquetado, porque los modelos validados no son abiertos.

| Nivel | Qué captura | Cómo | Resultado |
| --- | --- | --- | --- |
| 1 — Medidas (MVP) | Peso, cuello, cintura, cadera, brazo, muslo | Formulario con guía ilustrada de dónde medir | % grasa por fórmula de la Marina de EE.UU. y tendencia de medidas |
| 2 — Datos conocidos | Resultado de InBody, BIA o DEXA | Foto del ticket → el LLM con visión extrae los campos → el usuario confirma | % grasa, masa magra y TMB medidos |
| 3 — Fotos guiadas | Frente, perfil y espalda | Cámara con MediaPipe Pose Landmarker que valida pose, distancia y encuadre antes de disparar | Comparación lado a lado y observaciones de postura |
| 4 — Experimental | % grasa estimado desde fotos | LLM con visión, siempre etiquetado como aproximado | Estimación de referencia, nunca para decisiones automáticas |

**% grasa, fórmula de la Marina (cm)**:

```latex
\%G_{hombre} = \frac{495}{1.0324 - 0.19077\log_{10}(cintura - cuello) + 0.15456\log_{10}(estatura)} - 450
```

```latex
\%G_{mujer} = \frac{495}{1.29579 - 0.35004\log_{10}(cintura + cadera - cuello) + 0.22100\log_{10}(estatura)} - 450
```

**Por qué la foto no es el MVP**: un estudio de validación encontró que estimar grasa con dos fotos de smartphone fue preciso y sin sesgo significativo frente a DXA ([fuente](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9243018/)), y Google presenta PhotoScan como un marco todavía investigacional ([fuente](https://research.google/blog/seeing-beyond-bmi-estimating-cardiometabolic-risk-with-smartphone-imagery/)); ninguno está disponible como modelo abierto. Lo abierto que se encontró estima IMC, no grasa, con un error porcentual medio de 7.9% ([fuente](https://arxiv.org/abs/2508.20534v1)).

**Privacidad de fotos**: opt-in explícito, bucket privado con URLs firmadas de corta duración, borrado individual o total desde configuración y nunca se envían al LLM sin que el usuario lo pida en esa acción.

## Revisiones periódicas

El usuario elige cada cuánto revisar (semanal, quincenal o mensual) o deja que la app lo gestione; en modo automático hay una revisión ligera semanal, una completa mensual y revisiones adelantadas por disparadores.

| Tipo | Frecuencia en modo automático | Qué pide | Duración |
| --- | --- | --- | --- |
| Ligera | Semanal | Peso promedio de la semana, adherencia, energía, sueño y esfuerzo percibido (1–5) | 1 min |
| Completa | Mensual o al cerrar un bloque | Lo anterior + medidas, fotos guiadas (opcional) y valoración del plan | 5 min |
| Adelantada | Cuando salta un disparador | Preguntas específicas del disparador | 1–2 min |

**Disparadores de revisión adelantada**

- Estancamiento: sin progreso en un ejercicio principal durante 2–3 semanas.
- Peso fuera de la tendencia objetivo dos semanas seguidas.
- Dos o más sesiones perdidas en la semana.
- Esfuerzo percibido alto y rendimiento a la baja en la misma semana (posible fatiga).
- Nueva lesión o dolor reportado en una nota de sesión.

**Qué pasa después de cada revisión**

1. El código calcula tendencias: peso suavizado (media móvil exponencial), progreso por ejercicio, adherencia y volumen tolerado.
2. El LLM redacta un resumen en lenguaje claro y propone ajustes (volumen, ejercicios, descarga, calorías) dentro de los límites de las reglas.
3. El usuario acepta, edita o rechaza cada ajuste; si acepta, se crea una nueva `routine_version` o un nuevo objetivo nutricional.

Los recordatorios llegan como notificación de la PWA y como tarjeta en la pantalla de inicio; nunca se decide con un solo pesaje.

## Nutrición

Las metas se calculan con fórmulas deterministas que mejoran según los datos que el usuario conozca, y el plan de comidas usa solo alimentos de bases verificadas: el LLM elige alimentos y el servidor calcula los macros.

**Fuentes de datos (gratuitas)**

| Fuente | Cobertura | Licencia / condiciones | Uso |
| --- | --- | --- | --- |
| [USDA FoodData Central](https://fdc.nal.usda.gov/api-guide) | Alimentos genéricos y de marca (EE.UU.) | Dominio público; piden citarla como fuente. API limitada a 1,000 peticiones/hora por IP | Base principal; importar a Postgres en vez de consultar en vivo |
| [Tabla de composición de alimentos extendida 2019 (INCMNSZ, vía CONABIO)](https://siagro.conabio.gob.mx/nutricion/download/Detalles_tecnicos.pdf) | 3,928 registros de alimentos consumidos en México | Licencia no localizada: confirmar términos antes de uso público | Alimentos y platillos mexicanos |
| [Open Food Facts](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api) | Productos empacados por código de barras | ODbL: atribución y share-alike; una base combinada con sus datos también debe publicarse abierta | Escáner de código de barras; tabla separada del catálogo propio |

Referencias de implementación: [OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker) (GPL-3.0) consulta Open Food Facts, USDA y la base alemana BLS desde un backend en Supabase con su pipeline de importación en un repo aparte ([fuente](https://www.blog.brightcoding.dev/2026/09/29/simonoppowaopennutritracker-open-source-calorie-tracker-with-barcode-scanning)); [NutriTrace](https://github.com/traceapps/nutritrace/) (AGPL-3.0) calcula un gasto adaptativo a partir de la tendencia de peso y diario de 35 días. Se usan como referencia de diseño, sin copiar su código.

**Cálculo de metas según los datos disponibles**

| Datos que conoce el usuario | Método |
| --- | --- |
| Solo edad, sexo, estatura y peso | Mifflin-St Jeor × factor de actividad |
| % de grasa (InBody, DEXA o fórmula de la Marina) | Katch-McArdle con masa magra |
| TMB medida (InBody o calorimetría) | Se usa directamente |
| 2–3 semanas de registro de comida y peso | Gasto adaptativo: ingesta promedio menos la energía equivalente al cambio de peso suavizado |

```latex
TMB_{Mifflin} = 10\,peso_{kg} + 6.25\,estatura_{cm} - 5\,edad + s, \quad s = +5\ (hombre),\ -161\ (mujer)
```

```latex
TMB_{Katch} = 370 + 21.6\,masa\ magra_{kg}
```

**Proteína** (ISSN): 1.4–2.0 g/kg/día bastan para la mayoría de quienes entrenan; en déficit, quienes entrenan fuerza pueden necesitar 2.3–3.1 g/kg; por toma, unos 20–40 g repartidos cada 3–4 h ([fuente](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/)). Grasas y carbohidratos reparten el resto según preferencia y días de entrenamiento.

**Plan de comidas**

1. El usuario indica comidas por día, alimentos que no come, presupuesto y si cocina.
2. El LLM arma el menú con `food_id` de la base y gramos aproximados.
3. El servidor recalcula macros con la base y ajusta porciones hasta quedar a ±5% de calorías y con la proteína objetivo cubierta.
4. Vista en gramos o por equivalentes, lista de compras semanal y sustituciones con un toque.

**Registro diario**: búsqueda en las tres fuentes, escáner de código de barras, recientes y favoritos, y comidas guardadas.

**Salvaguardas**: OpenNutriTracker advierte que no está validado y desaconseja su uso durante enfermedad, embarazo o lactancia ([fuente](https://github.com/simonoppowa/OpenNutriTracker/wiki)); esta app hace lo mismo y deriva a un profesional ante diabetes, enfermedad renal o historial de trastornos alimentarios. Tiene un piso de calorías y un ritmo máximo de pérdida configurables, ambos conservadores por defecto.

## Diseño visual y UX

La app toma el lenguaje visual de hemeron.com (fondo casi negro, un solo acento carmesí, tipografía grotesca grande y etiquetas en mayúsculas espaciadas) sin usar su logo ni su nombre, y lo aplica a fuerza, salud y nutrición. Los valores salen de los estilos calculados del sitio el 12 de octubre de 2026.

**Tokens de color**

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0E0E0E` | Fondo base (modo oscuro por defecto) |
| `--surface` | `#141414` / `#161616` | Paneles, hojas inferiores |
| `--card` | `rgba(255,255,255,0.03)` + borde `rgba(255,255,255,0.08)` | Tarjetas de ejercicio, comida, métrica |
| `--text` | `#FFFFFF` | Texto principal y números grandes |
| `--text-2` | `rgba(255,255,255,0.72)` | Texto secundario |
| `--text-3` | `rgba(255,255,255,0.5)` | Etiquetas, metadatos |
| `--accent` | `#CE0037` | Fuerza: botón principal, cronómetro activo, serie en curso, récord |
| `--light-bg` / `--light-text` | `#F6F6F5` / `#111111` | Modo claro y secciones de contraste |
| `--up` | verde a definir | Delta positivo frente a la última vez |
| `--down` | ámbar a definir | Delta negativo o descanso excedido |
| `--protein` / `--carbs` / `--fat` | tres tonos apagados a definir | Anillos y barras de macros |

El acento carmesí se reserva para una sola cosa por pantalla: la acción o el dato que importa ahora.

**Tipografía** (ambas de Fontshare, gratuitas)

- **Clash Grotesk 500** para títulos, cronómetros y cifras grandes (peso, reps, kcal): tracking −0.04em, tamaños de 36–56 px en títulos y hasta 72 px en el cronómetro.
- **Switzer 400/500/600** para cuerpo e interfaz, 16–17.6 px.
- **Etiquetas**: Switzer 500, 12–13 px, mayúsculas, tracking 0.07em, al 50% de opacidad (“SERIE 3 DE 4”, “DESCANSO”).
- Cifras con `font-variant-numeric: tabular-nums` para que el cronómetro no “baile”; si la fuente no tiene cifras tabulares, usar una monoespaciada gratuita solo en cronómetros.

**Formas y componentes**

- Botones en píldora (`radius 999px`), mayúsculas, 13 px; el principal en `--accent`.
- Tarjetas con radio de 14 px, inputs de 10 px, chips de 8 px; bordes de 1 px al 8–10% de blanco; sin sombras ni degradados.
- Iconos Lucide (licencia ISC), trazo de 1.5 px.

**Motivos tomados del sitio y adaptados**

| En hemeron.com | En la app |
| --- | --- |
| Barra “un año en días” con los meses y el día actual | Barra del bloque: “Semana 6 de 12” con cada día entrenado marcado |
| Titular enorme que aparece palabra por palabra | Saludo y resumen del día con la misma animación de entrada |
| Tarjeta de agente con estados (“Revisando” → “Listo”) | Generación de rutina en vivo: “Leyendo tu perfil → Eligiendo ejercicios → Validando” |
| Listas numeradas 01–04 | Ejercicios de la sesión numerados 01–06 |
| Métricas grandes con etiqueta pequeña (“10 días hábiles”) | Volumen, duración y récords al terminar la sesión |
| Transiciones entre páginas | View Transitions API entre lista de ejercicios y ficha |

**Pantallas principales**: Hoy, Sesión en vivo, Ficha de ejercicio, Progreso, Nutrición, Revisión, Perfil y Configuración. Navegación inferior de 4 pestañas en móvil y barra lateral en escritorio.

**Fotografía**: blanco y negro de alto contraste, entrenamiento real (barras, anillas, comida sin aderezar), de Unsplash o propia; nunca fotos de stock con sonrisas posadas.

**Accesibilidad**: contraste AA verificado para `--accent` con texto blanco y para `--text-3`, objetivos táctiles de 44 px mínimo (se usa con manos sudadas) y `prefers-reduced-motion` desactiva las animaciones de entrada.

## Arquitectura y stack gratuito

El MVP corre en el VPS propio con Dokploy: la app Next.js y una Postgres nativa viven en el servidor, mientras el build, los archivos, los respaldos y el LLM quedan fuera. Con los recursos medidos el 12 oct 2026 (2 vCPU, 8 GB de RAM con unos 3 GB libres, 47 servicios activos y unos 26 GB de disco libres), no conviene levantar Supabase completo ni compilar en el servidor.

&#91;embedded content: arquitectura · 3 capas, 9 componentes\]

El navegador habla solo con la app; la app consulta Postgres en la red interna del VPS y es la única que llama al LLM, así la API key nunca sale del servidor. GitHub Actions entrega la imagen ya construida y Dokploy envía los respaldos a R2.

| Capa | Elección | Costo | Nota |
| --- | --- | --- | --- |
| Web app + API | Next.js (`output: "standalone"`) como aplicación de Dokploy con proveedor Docker | Incluido en el VPS | La imagen se construye en GitHub Actions y se publica en GitHub Container Registry; Dokploy solo la descarga y la levanta |
| Base de datos | Postgres nativo de Dokploy + Drizzle ORM | Incluido | Base dedicada al proyecto, sin puerto expuesto, solo red interna |
| Respaldos | Backups programados de Dokploy hacia Cloudflare R2 (S3) | R2: 10 GB-mes gratis | Hoy el Dokploy no tiene destinos de respaldo: es lo primero a configurar |
| Archivos privados | [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/), bucket privado | 10 GB-mes, 1 M operaciones clase A, 10 M clase B, egress sin costo | Fotos corporales y tickets con URLs firmadas |
| Medios de ejercicios | R2, bucket público con dominio propio | Mismo plan gratuito | Espejo de free-exercise-db y RepDB |
| Autenticación | Better Auth sobre la misma Postgres | Sin costo | Correo + Google |
| Dominio y TLS | Traefik de Dokploy con Let's Encrypt | Incluido | Subdominio propio |
| Límites de recursos | App con límite de 1 GB de RAM, Postgres con 512 MB | — | Un pico de la app no afecta a los demás proyectos del VPS |
| UI | Tailwind CSS + shadcn/ui + Motion + Lucide | Sin costo | Tokens de la sección de diseño |
| PWA y offline | Serwist (service worker) + Dexie (IndexedDB) | Sin costo | Sesión en vivo sin conexión |
| Datos del cliente | TanStack Query + Zustand | Sin costo | Caché y estado del cronómetro |
| Gráficas | Recharts | Sin costo | Progreso y nutrición |
| Visión | MediaPipe Tasks Vision (WASM en el navegador) | Sin costo | No consume CPU del VPS |
| IA | Vercel AI SDK + proveedor elegido por el desarrollador | Se paga el consumo del proveedor | Ver Configuración de desarrollador |
| Notificaciones | Web Push con claves VAPID | Sin costo | Descanso terminado, revisiones pendientes |
| Tareas programadas | Schedules de Dokploy sobre la app | Incluido | Recordatorios de revisión, importaciones nocturnas |
| CI/CD | GitHub Actions + webhook de redeploy de Dokploy | Dentro de la cuota gratuita de Actions | Lint, tipos y pruebas antes de cada imagen |

**Herramientas de desarrollo**: pnpm para dependencias, Bun para scripts (semillas, importadores de USDA y catálogos, pruebas) y desarrollo local, Vitest y Playwright para pruebas, y un `AGENTS.md` en la raíz con las convenciones del proyecto para agentes de código.

**Estructura del repositorio**

```
apps/web            Next.js (UI, Server Actions, API)
packages/core       motor de progresión, cálculos nutricionales, esquemas zod
packages/db         esquema Drizzle, migraciones, semillas
packages/ai         prompts, llamadas al LLM, validación de salidas
scripts/            importadores (free-exercise-db, calistenia, USDA, INCMNSZ)
AGENTS.md
```

**Por qué no el template de Supabase**: el proyecto solo necesita Postgres y archivos, y la autenticación es Better Auth. Supabase autoalojado agrega alrededor de una docena de contenedores (en este VPS ya corre uno con 12) que consumirían buena parte de la RAM libre sin aportar nada a esta arquitectura.

**Pasos de puesta en marcha en Dokploy**

1. Crear un destino S3 apuntando a un bucket de R2 para respaldos.
2. Crear un proyecto nuevo \`stenia\`; “Gym System” se conserva intacto para otro momento.
3. Crear la Postgres con respaldo diario hacia R2 y retención de 14 copias.
4. Crear la aplicación con proveedor Docker (imagen de GHCR), variables de entorno, dominio y límites de RAM.
5. Workflow de GitHub Actions: lint, tipos y pruebas → build de la imagen → push a GHCR → webhook de redeploy.
6. Liberar disco antes de empezar (el VPS está al 75%): limpiar imágenes sin uso y caché de builds.

**Desarrollo local**: Postgres en Docker Compose, `pnpm dev` para la app y Bun para semillas e importadores; producción y local comparten las mismas migraciones de Drizzle.

## Configuración de desarrollador

Una pantalla `/settings/developer`, visible solo para el rol `admin`, permite elegir proveedor y modelo por tarea y pegar la API key propia (BYOK). La key se cifra en el servidor y nunca vuelve al navegador.

**Campos de la pantalla**

| Campo | Tipo | Detalle |
| --- | --- | --- |
| Proveedor | Selección | Anthropic, OpenAI, Google, OpenRouter o “compatible con OpenAI” (URL base propia) |
| API key | Campo enmascarado | Tras guardar solo muestra los últimos 4 caracteres; botón “Reemplazar” |
| Probar conexión | Botón | Llamada mínima al modelo; muestra latencia y error legible |
| Modelo para planificación | Selección | Rutina, plan de comidas, análisis de revisiones |
| Modelo rápido | Selección | Explicación de la meta de hoy, resumen de sesión, sustituciones |
| Modelo con visión | Selección | Lectura del ticket de InBody y fotos (si se habilita) |
| Modelo de respaldo | Selección opcional | Se usa si el principal falla o excede el tiempo |
| Temperatura y máx. tokens | Números por tarea | Valores bajos por defecto para planificación |
| Presupuesto mensual | USD | Al llegar al 80% avisa; al 100% bloquea llamadas no esenciales |
| Enviar fotos al LLM | Interruptor | Apagado por defecto |
| Registro de prompts | Interruptor | Guarda prompts y respuestas sin datos personales para depurar |

**Reglas técnicas**

- Key cifrada en reposo con AES-256-GCM usando un secreto `ENCRYPTION_KEY` de las variables de entorno; como alternativa, una variable `AI_API_KEY` sobrescribe lo guardado.
- Todas las llamadas salen del servidor (Route Handlers o Server Actions) a través del Vercel AI SDK; el cliente nunca ve la key.
- Panel de uso: tokens y costo estimado por función y por mes.
- Prompts versionados en `packages/ai`, con salida estructurada validada por zod en cada tarea.

**Modelos de referencia** (precios por millón de tokens, entrada / salida, consultados el 12 oct 2026)

| Proveedor | Planificación (alta calidad) | Rápido (bajo costo) | Notas |
| --- | --- | --- | --- |
| [Anthropic](https://platform.claude.com/docs/en/models/overview) | Claude Opus 5.5 — $4 / $20 | Claude Haiku 5.5 — desde $0.10 / $0.50 | Claude Sonnet 5.5 ($2 / $10) como punto medio; todos aceptan imágenes |
| [OpenAI](https://developers.openai.com/api/docs/pricing) | gpt-6.1-sol — $2 / $10 | gpt-6-luna — $0.10 / $0.50 | gpt-6-astra ($10 / $50) para la máxima calidad |
| [Google](https://ai.google.dev/gemini-api/docs/pricing) | Gemini 3.1 Pro Preview — $2 / $12 | Gemini 3.8 Flash — $0.75 / $3.75 hasta el 31 dic 2026 | Tiene nivel gratuito, pero ahí el contenido se usa para mejorar sus productos |

Para planificación conviene un modelo de gama alta, porque de ahí sale la calidad de la rutina y del plan; para tareas en sesión basta uno rápido. El nivel gratuito de Gemini sirve para desarrollar con datos ficticios, no para datos reales de salud del usuario.

**Costo estimado** (supuesto: generar una rutina usa unos 15,000 tokens de entrada y 4,000 de salida): con un modelo de $4 / $20 son unos $0.14 por generación. Con revisiones semanales y sugerencias diarias en un modelo rápido, el uso personal debería quedar en pocos dólares al mes; el panel de uso lo confirma con datos reales.

## Modelo de datos

El esquema (Postgres + Drizzle) separa catálogo, plan, ejecución y seguimiento; cada serie registrada guarda carga, reps, tiempos y descanso real para que todas las comparaciones salgan de una sola tabla (`set_log`).

| Dominio | Tabla | Campos clave |
| --- | --- | --- |
| Usuario | `user` | email, nombre, rol (`user` / `admin`), unidades, idioma |
| Usuario | `profile` | nacimiento, sexo, estatura, objetivo, proporción gym/calistenia, días/semana, minutos/sesión, meses entrenando, sueño, estrés, actividad |
| Usuario | `screening` | respuestas PAR-Q+ (jsonb), banderas ACSM, valoración recomendada, fecha de aceptación |
| Usuario | `injury` | zona, movimientos a evitar, activa |
| Equipamiento | `gym_profile`, `gym_profile_equipment` | nombre, activo; equipo con metadatos (rango de mancuernas, bandas, kg de lastre) |
| Catálogo | `equipment` | slug, categoría, nombre |
| Catálogo | `exercise` | slug, nombre es/en, patrón de movimiento, músculos, `load_type` (external, bodyweight, assisted, weighted\_bw, isometric), nivel, instrucciones, cues, errores comunes, fuente, licencia, `reviewed` |
| Catálogo | `exercise_equipment` | ejercicio ↔ equipo requerido |
| Catálogo | `exercise_progression` | de → a, umbral (reps, segundos, sesiones) |
| Catálogo | `exercise_media` | tipo (imagen, video), url, orden, fuente, licencia, url de atribución |
| Plan | `routine`, `routine_version` | perfil de equipamiento, estado; versión inmutable con autor (`ai` / `user`) y justificación |
| Plan | `routine_day`, `routine_exercise` | orden, series, reps mín/máx, segundos objetivo, RIR objetivo, descanso recomendado (s), notas |
| Ejecución | `session` | día de rutina, `started_at`, `ended_at`, pausa acumulada (ms), esfuerzo 1–10, notas |
| Ejecución | `session_exercise` | orden, inicio, fin, sustituido de |
| Ejecución | `set_log` | número, kg, kg de asistencia, kg de lastre, reps, segundos, RIR, `completed_at`, descanso real y objetivo (s), es récord |
| Ejecución | `personal_record` | ejercicio, tipo de récord, valor, serie de origen, fecha |
| Seguimiento | `body_measurement` | fecha, peso, cuello, cintura, cadera, brazo, muslo, % grasa y método, masa magra, TMB medida, fuente |
| Seguimiento | `body_photo` | fecha, pose, llave de almacenamiento, landmarks (jsonb) |
| Seguimiento | `checkin`, `checkin_settings` | tipo, programada, completada, respuestas, resumen IA, cambios propuestos, decisión; modo (`auto` / fijo), intervalo, próxima |
| Nutrición | `food` | fuente (`usda`, `incmnsz`, `off`, `custom`), id de origen, nombre, macros por 100 g, porciones, licencia |
| Nutrición | `nutrition_target` | vigente desde, kcal, proteína, carbohidratos, grasa, método de cálculo |
| Nutrición | `meal_plan`, `meal_log` | semana, plan (jsonb), versión; fecha, comida, alimento, gramos |
| IA | `ai_settings`, `ai_usage` | proveedor, key cifrada, modelos por tarea, presupuesto, interruptores; función, modelo, tokens, costo, fecha |

Los productos de Open Food Facts viven en `food` con `source = 'off'` y no se exportan mezclados con el resto, para respetar su licencia ODbL.

## Seguridad, privacidad y salvaguardas

La app maneja datos de salud, fotos corporales y una API key con costo, así que cada uno tiene su control explícito; la legislación mexicana de datos personales trata la información de salud como dato sensible y exige consentimiento expreso.

**Datos personales**

- Aviso de privacidad y consentimiento expreso al registrarse, separado para fotos corporales.
- Exportar todos los datos (JSON + CSV) y borrar la cuenta con todo su contenido desde Configuración.
- TLS en todo el tráfico, cifrado en reposo de la base de datos y de los archivos, y consultas solo desde el servidor con verificación de propietario en cada fila.
- Respaldo diario de Postgres con los backups programados de Dokploy hacia R2, con retención de 14 copias y una restauración de prueba al mes.

**Uso del LLM**

- Minimización: nunca se envían nombre ni correo; solo los campos que la tarea necesita.
- Fotos al LLM apagadas por defecto y solo bajo acción explícita del usuario.
- Las notas del usuario dentro de un prompt se marcan como datos, no como instrucciones, y toda salida se valida contra su esquema antes de guardarse.
- Presupuesto mensual con corte automático y registro de uso por función.

**Salvaguardas de salud**

- Banderas del PAR-Q+ o del criterio ACSM: recomendación de valoración médica e intensidad limitada hasta que el usuario confirme.
- Dolor reportado durante una serie: la app sugiere detener, ofrece sustituto y abre una revisión adelantada.
- Sin diagnósticos: la IA describe tendencias y opciones, no condiciones médicas.
- Nutrición: no genera planes para embarazo, lactancia, diabetes, enfermedad renal ni historial de trastornos alimentarios; deriva a un profesional.
- Leyenda visible: la app no es un dispositivo médico ni sustituye a un profesional de la salud.

**Cuenta y acceso**

- Sesiones de Better Auth con cookies seguras, límite de intentos de inicio de sesión y rutas `/settings/developer` protegidas por rol.
- Variables secretas (`ENCRYPTION_KEY`, claves VAPID, credenciales de base de datos) solo en el entorno del servidor.

## Roadmap por fases y criterios de aceptación

Cinco fases de entre 1 y 3 semanas cada una (estimación a validar); cada fase termina con una puerta que se comprueba usando la app en entrenamientos reales.

**Fase 0 — Fundaciones (1 semana)**

- [ ] Monorepo con pnpm, `AGENTS.md`, CI en GitHub Actions (lint, tipos, pruebas, imagen Docker en GHCR) y despliegue en Dokploy
- [ ] Postgres en Dokploy con destino de respaldos en R2, Drizzle con migraciones y Better Auth (correo + Google)
- [ ] Tokens de diseño, fuentes Clash Grotesk y Switzer, componentes base
- [ ] Importadores con Bun: free-exercise-db, dataset de calistenia y RepDB; imágenes espejadas en R2 con atribución
- [ ] Pantalla de configuración de desarrollador con prueba de conexión al LLM

**Fase 1 — Rutina y tracking en vivo (2–3 semanas)**

- [ ] Cuestionario completo con regla de seguridad PAR-Q+/ACSM
- [ ] Perfil de equipamiento y filtro del catálogo
- [ ] Generación de rutina con validación y plantilla de respaldo
- [ ] Sesión en vivo: “Última vez”, meta de hoy, filas precargadas, deltas por serie
- [ ] Cronómetros de sesión, ejercicio, isométrico y descanso, correctos tras bloquear la pantalla 5 minutos
- [ ] Funciona sin conexión y sincroniza al reconectar
- [ ] Ficha de ejercicio con animación, pasos y atribución
- [ ] Puerta: 8 sesiones reales registradas sin pérdida de datos

**Fase 2 — Progreso y revisiones (2 semanas)**

- [ ] Comparaciones de las cuatro escalas y récords automáticos
- [ ] Gráficas por ejercicio y mapa muscular semanal
- [ ] Medidas con fórmula de la Marina y fotos guiadas con MediaPipe
- [ ] Revisiones en modo fijo y automático con disparadores
- [ ] Motor de progresión aplicando subidas y descargas
- [ ] Puerta: un ciclo completo de revisión que genera una nueva versión de rutina aceptada

**Fase 3 — Nutrición (2 semanas)**

- [ ] Importación de USDA FoodData Central y de la tabla del INCMNSZ (tras confirmar términos)
- [ ] Cálculo de metas según datos disponibles
- [ ] Plan semanal con porciones ajustadas por el servidor y lista de compras
- [ ] Registro diario con búsqueda, favoritos y escáner de código de barras
- [ ] Salvaguardas de nutrición activas
- [ ] Puerta: 14 días de registro con metas visibles y plan usado

**Fase 4 — IA avanzada y visión (2 semanas o más)**

- [ ] Lectura del ticket de InBody con confirmación del usuario
- [ ] Gasto calórico adaptativo
- [ ] Conteo de reps por cámara en 3 ejercicios (sentadilla, lagartija, dominada)
- [ ] % de grasa por foto como experimento etiquetado
- [ ] Puerta: decidir si se abre a otros usuarios y si el VPS necesita más RAM o un servidor dedicado para el proyecto

## Instrucciones para el agente de desarrollo

El archivo `stenia-PRD.md` es la versión de este PRD para un agente de IA: reglas, definición de terminado, variables de entorno, Dockerfile, workflow de CI/CD y el runbook de Dokploy paso a paso. Este documento y el archivo deben mantenerse sincronizados.

**Reglas para el agente**

- pnpm para dependencias, Bun para scripts, `AGENTS.md` como archivo de convenciones (nunca `CLAUDE.md`).
- TypeScript estricto y zod en toda entrada externa y salida del LLM.
- Una tarea está terminada solo con lint, tipos y pruebas en verde, y probada en móvil y escritorio.
- En Dokploy solo toca el proyecto `stenia`; limpiezas o borrados requieren aprobación explícita; nunca imprime secretos.
- Decisiones no cubiertas por el PRD se anotan en `docs/decisions.md`.

**Runbook con el MCP de Dokploy** (estado del VPS al 12 oct 2026: Dokploy v0.30.2, 2 vCPU, 8 GB de RAM con \~3 GB libres, disco al 75%, sin destinos de respaldo)

| Paso | Herramienta del MCP | Parámetros clave | Verificación |
| --- | --- | --- | --- |
| 0 | `project-all`, `docker-getServerHealth` | `sinceHours: 24` | No existe `stenia`; RAM libre ≥ 1.5 GB y disco libre ≥ 10 GB |
| 1 | `settings-cleanUnusedImages`, `settings-cleanDockerBuilder` | — | Solo con aprobación del usuario |
| 2 | `destination-testConnection`, `destination-create` | Proveedor Cloudflare, bucket `stenia-backups`, región `auto`, endpoint `https://<account>.r2.cloudflarestorage.com` | Prueba de conexión correcta; guardar `destinationId` |
| 3 | `project-create` | `name: stenia` | Obtener `environmentId` de `production` |
| 4 | `postgres-create`, `postgres-update`, `postgres-deploy`, `postgres-one` | `postgres:18`, base y usuario `gym_ia`, contraseña generada, límite 512 MB, sin puerto externo | Estado `done`; armar `DATABASE_URL` con el `appName` final |
| 5 | `backup-create`, respaldo manual | Diario `0 9 * * *` (03:00 CDMX si el servidor usa UTC), prefijo `stenia/postgres`, 14 copias | Archivo visible en R2 |
| 6 | `registry-create` | `ghcr.io` con PAT de lectura | Solo si la imagen es privada |
| 7 | `application-create`, `application-saveDockerProvider`, `application-saveEnvironment`, `application-update`, `domain-create`, `application-deploy` | Fuente Docker, imagen `ghcr.io/<owner>/stenia-web:latest`, límite 1 GB, puerto 3000, HTTPS con Let's Encrypt | App responde por HTTPS; webhook de despliegue guardado en GitHub |
| 8 | `schedule-create` | Recordatorio diario a `/api/cron/checkins` con `CRON_SECRET`, zona `America/Mexico_City` | Ejecución manual correcta |
| 9 | `docker-getServerHealth`, `project-all` | — | RAM libre ≥ 1 GB y ningún otro proyecto cambió |

**Lo que entrega el usuario antes del paso 2**: credenciales S3 de R2 y sus tres buckets (`stenia-backups`, `stenia-private`, `stenia-public`), repositorio en GitHub (y PAT si la imagen es privada), subdominio con registro DNS al VPS y credenciales OAuth de Google.

## Fuentes y referencias

Páginas consultadas entre el 11 y el 12 de octubre de 2026.

**Evaluación y entrenamiento**

- [PAR-Q+ y cribado previo](https://open-exam-prep.com/study-guides/crossfit-l3/screening-assessment/screening-health-medical)
- [Algoritmo de cribado del ACSM](https://open-exam-prep.com/study-guides/acsm-cep/patient-assessment/preparticipation-screening)
- [saiyan-protocol (regla de progresión en calistenia)](https://github.com/code-knayam/saiyan-protocol)

**Catálogo de ejercicios**

- [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
- [Martjn/calisthenics\_exercises](https://huggingface.co/datasets/Martjn/calisthenics_exercises)
- [RepDB free (exercise-dataset)](https://github.com/sergei-argutin/exercise-dataset)
- [wger](https://github.com/wger-project/wger)

**Nutrición**

- [USDA FoodData Central — API Guide](https://fdc.nal.usda.gov/api-guide)
- [Tabla de composición de alimentos extendida 2019 — detalles técnicos](https://siagro.conabio.gob.mx/nutricion/download/Detalles_tecnicos.pdf)
- [Open Food Facts — condiciones de uso de la API](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api)
- [OpenNutriTracker](https://github.com/simonoppowa/OpenNutriTracker), [su wiki](https://github.com/simonoppowa/OpenNutriTracker/wiki) y [análisis de su backend](https://www.blog.brightcoding.dev/2026/09/29/simonoppowaopennutritracker-open-source-calorie-tracker-with-barcode-scanning)
- [NutriTrace](https://github.com/traceapps/nutritrace/)
- [ISSN Position Stand: protein and exercise](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5477153/)

**Composición corporal por imagen**

- [Validación de estimación de grasa con cámara de smartphone](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9243018/)
- [Google Research — PhotoScan](https://research.google/blog/seeing-beyond-bmi-estimating-cardiometabolic-risk-with-smartphone-imagery/)
- [Digital Scale — IMC desde fotos (arXiv)](https://arxiv.org/abs/2508.20534v1)

**Infraestructura y modelos**

- Dokploy v0.30.2 en el VPS propio (recursos, proyectos y destinos consultados el 12 oct 2026)
- [Supabase — precios](https://supabase.com/pricing)
- [Cloudflare R2 — precios](https://developers.cloudflare.com/r2/pricing/)
- [Anthropic — modelos](https://platform.claude.com/docs/en/models/overview)
- [OpenAI — precios](https://developers.openai.com/api/docs/pricing)
- [Google Gemini API — precios](https://ai.google.dev/gemini-api/docs/pricing)

**Diseño**

- [hemeron.com](https://hemeron.com) (colores, tipografías, radios y motivos tomados de sus estilos calculados)
