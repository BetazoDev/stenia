import {
  ACTIVITY_LABELS_ES,
  CONDITION_LABELS_ES,
  GOAL_LABELS_ES,
  INJURY_ZONE_LABELS_ES,
  PARQ_QUESTIONS,
  SKILL_LABELS_ES,
  type BlockKey,
} from '@stenia/core';

export type Draft = Partial<Record<BlockKey, Record<string, unknown>>>;

export type StepKind = 'yesno' | 'number' | 'select' | 'multiselect' | 'slider' | 'date' | 'text' | 'weekdays' | 'screening' | 'gym';

export type StepOption = { value: string | number; label: string; description?: string };

export type Step = {
  id: string;
  block: BlockKey | 'gym';
  title: string;
  hint?: string;
  kind: StepKind;
  path?: string[];
  options?: StepOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  optional?: boolean;
  visible?: (d: Draft) => boolean;
};

export function getPath(d: Draft, path: string[]): unknown {
  let cur: unknown = d;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function setPath(d: Draft, path: string[], value: unknown): Draft {
  const [head, ...rest] = path;
  if (!head) return d;
  const base = (d as Record<string, unknown>) ?? {};
  if (rest.length === 0) return { ...base, [head]: value } as Draft;
  const child = (base[head] as Draft | undefined) ?? {};
  return { ...base, [head]: setPath(child, rest, value) } as Draft;
}

const anyParqYes = (d: Draft) => PARQ_QUESTIONS.some((q) => getPath(d, ['safety', 'parq', q.id]) === true);
const isFemale = (d: Draft) => getPath(d, ['body', 'sex']) === 'female';

export const STEPS: Step[] = [
  // Primero el equipo: con él se eligen los ejercicios, y las fotos ayudan a reconocer cada máquina.
  {
    id: 'gym',
    block: 'gym',
    title: '¿Dónde vas a entrenar?',
    hint: 'Elige un punto de partida y marca el equipo que tienes. Las fotos te ayudan a reconocer cada máquina.',
    kind: 'gym',
  },
  ...PARQ_QUESTIONS.map<Step>((q, i) => ({
    id: `parq-${q.id}`,
    block: 'safety',
    title: q.text,
    hint: i === 0 ? `PAR-Q+ · pregunta ${i + 1} de 7. Ningún "sí" te descarta: solo abre preguntas de seguimiento.` : `PAR-Q+ · pregunta ${i + 1} de 7.${'hint' in q && q.hint ? ` ${q.hint}` : ''}`,
    kind: 'yesno',
    path: ['safety', 'parq', q.id],
  })),
  {
    id: 'followup-conditions',
    block: 'safety',
    title: '¿Qué tipo de condición tienes?',
    hint: 'Elige todas las que apliquen.',
    kind: 'multiselect',
    path: ['safety', 'followUp', 'conditions'],
    options: Object.entries(CONDITION_LABELS_ES).map(([value, label]) => ({ value, label })),
    visible: anyParqYes,
  },
  { id: 'followup-controlled', block: 'safety', title: '¿Está controlada con tratamiento (medicamento o terapia)?', kind: 'yesno', path: ['safety', 'followUp', 'controlled'], visible: anyParqYes },
  { id: 'followup-symptoms', block: 'safety', title: '¿Te aparecen síntomas (dolor, falta de aire, mareo) al hacer esfuerzo?', kind: 'yesno', path: ['safety', 'followUp', 'symptomsOnExertion'], visible: anyParqYes },
  { id: 'followup-cleared', block: 'safety', title: '¿Un médico ya te autorizó a hacer ejercicio?', kind: 'yesno', path: ['safety', 'followUp', 'clearedByDoctor'], visible: anyParqYes },
  {
    id: 'acsm-regular',
    block: 'safety',
    title: '¿Haces al menos 30 minutos de actividad moderada, 3 días por semana, desde hace 3 meses?',
    kind: 'yesno',
    path: ['safety', 'acsm', 'exercisesRegularly'],
  },
  {
    id: 'acsm-disease',
    block: 'safety',
    title: '¿Tienes diagnóstico de enfermedad cardiovascular, metabólica (como diabetes) o renal?',
    kind: 'yesno',
    path: ['safety', 'acsm', 'knownDisease'],
  },
  {
    id: 'acsm-symptoms',
    block: 'safety',
    title: '¿Has tenido síntomas como dolor de pecho, falta de aire anormal, desmayos, palpitaciones o hinchazón de tobillos?',
    kind: 'yesno',
    path: ['safety', 'acsm', 'symptoms'],
  },
  {
    id: 'acsm-intensity',
    block: 'safety',
    title: '¿Qué intensidad quieres entrenar?',
    kind: 'select',
    path: ['safety', 'acsm', 'desiredIntensity'],
    options: [
      { value: 'light', label: 'Ligera', description: 'Respiras con facilidad todo el tiempo.' },
      { value: 'moderate', label: 'Moderada', description: 'Puedes hablar, pero no cantar.' },
      { value: 'vigorous', label: 'Vigorosa', description: 'Series cerca del fallo y cargas altas.' },
    ],
  },
  { id: 'screening', block: 'safety', title: 'Resultado del cribado', kind: 'screening' },

  { id: 'birth', block: 'body', title: '¿Cuál es tu fecha de nacimiento?', kind: 'date', path: ['body', 'birthDate'] },
  {
    id: 'sex',
    block: 'body',
    title: '¿Cuál es tu sexo?',
    hint: 'Se usa para las fórmulas de gasto calórico y grasa corporal.',
    kind: 'select',
    path: ['body', 'sex'],
    options: [
      { value: 'male', label: 'Hombre' },
      { value: 'female', label: 'Mujer' },
    ],
  },
  { id: 'height', block: 'body', title: '¿Cuánto mides?', kind: 'number', path: ['body', 'heightCm'], unit: 'cm', min: 120, max: 230, step: 1 },
  { id: 'weight', block: 'body', title: '¿Cuánto pesas hoy?', kind: 'number', path: ['body', 'weightKg'], unit: 'kg', min: 30, max: 300, step: 0.1 },

  { id: 'bodyfat', block: 'known', title: '¿Conoces tu porcentaje de grasa?', hint: 'De un InBody, bioimpedancia o DEXA. Si no lo sabes, salta.', kind: 'number', path: ['known', 'bodyFatPct'], unit: '%', min: 3, max: 70, step: 0.1, optional: true },
  {
    id: 'bodyfat-method',
    block: 'known',
    title: '¿Con qué lo mediste?',
    kind: 'select',
    path: ['known', 'bodyFatMethod'],
    options: [
      { value: 'inbody', label: 'InBody' },
      { value: 'bia', label: 'Báscula de bioimpedancia' },
      { value: 'dexa', label: 'DEXA' },
      { value: 'navy', label: 'Cinta (fórmula de la Marina)' },
      { value: 'manual', label: 'Otro' },
    ],
    optional: true,
    visible: (d) => typeof getPath(d, ['known', 'bodyFatPct']) === 'number',
  },
  { id: 'neck', block: 'known', title: '¿Cuánto mide tu cuello?', hint: 'Debajo de la manzana de Adán, con la cinta horizontal.', kind: 'number', path: ['known', 'neckCm'], unit: 'cm', min: 20, max: 70, step: 0.5, optional: true },
  { id: 'waist', block: 'known', title: '¿Cuánto mide tu cintura?', hint: isFemaleHint(), kind: 'number', path: ['known', 'waistCm'], unit: 'cm', min: 40, max: 200, step: 0.5, optional: true },
  { id: 'hip', block: 'known', title: '¿Cuánto mide tu cadera?', hint: 'En la parte más ancha de los glúteos.', kind: 'number', path: ['known', 'hipCm'], unit: 'cm', min: 50, max: 200, step: 0.5, optional: true, visible: isFemale },
  { id: 'bmr', block: 'known', title: '¿Conoces tu tasa metabólica basal medida?', hint: 'Aparece en el ticket de InBody o de una calorimetría.', kind: 'number', path: ['known', 'bmrMeasured'], unit: 'kcal', min: 800, max: 4000, step: 10, optional: true },

  { id: 'months', block: 'level', title: '¿Cuántos meses llevas entrenando fuerza de forma constante?', kind: 'number', path: ['level', 'trainingMonths'], unit: 'meses', min: 0, max: 600, step: 1, optional: true },
  { id: 'pushups', block: 'level', title: '¿Cuántas flexiones seguidas haces con buena técnica?', kind: 'number', path: ['level', 'maxPushups'], unit: 'reps', min: 0, max: 200, step: 1, optional: true },
  { id: 'pullups', block: 'level', title: '¿Cuántas dominadas seguidas haces?', kind: 'number', path: ['level', 'maxPullups'], unit: 'reps', min: 0, max: 100, step: 1, optional: true },
  { id: 'dips', block: 'level', title: '¿Cuántos fondos en paralelas haces?', kind: 'number', path: ['level', 'maxDips'], unit: 'reps', min: 0, max: 150, step: 1, optional: true },
  { id: 'plank', block: 'level', title: '¿Cuántos segundos aguantas en plancha?', kind: 'number', path: ['level', 'plankSeconds'], unit: 's', min: 0, max: 1200, step: 5, optional: true },
  { id: 'bench', block: 'level', title: '¿Con cuánto peso haces 8–10 repeticiones de press de banca?', kind: 'number', path: ['level', 'benchKg'], unit: 'kg', min: 0, max: 400, step: 2.5, optional: true },
  { id: 'squat', block: 'level', title: '¿Con cuánto peso haces 8–10 repeticiones de sentadilla?', kind: 'number', path: ['level', 'squatKg'], unit: 'kg', min: 0, max: 500, step: 2.5, optional: true },
  { id: 'row', block: 'level', title: '¿Con cuánto peso haces 8–10 repeticiones de remo?', kind: 'number', path: ['level', 'rowKg'], unit: 'kg', min: 0, max: 400, step: 2.5, optional: true },

  {
    id: 'goal',
    block: 'goal',
    title: '¿Cuál es tu objetivo principal?',
    kind: 'select',
    path: ['goal', 'goal'],
    options: Object.entries(GOAL_LABELS_ES).map(([value, label]) => ({ value, label })),
  },
  {
    id: 'ratio',
    block: 'goal',
    title: '¿Cómo quieres repartir gimnasio y calistenia?',
    hint: '0 = solo calistenia · 100 = solo gimnasio.',
    kind: 'slider',
    path: ['goal', 'gymRatio'],
    min: 0,
    max: 100,
    step: 10,
  },
  {
    id: 'skills',
    block: 'goal',
    title: '¿Qué habilidades quieres dominar?',
    hint: 'Elige hasta tres. Se practican al inicio de los días que les corresponden.',
    kind: 'multiselect',
    path: ['goal', 'skillGoals'],
    options: Object.entries(SKILL_LABELS_ES).map(([value, label]) => ({ value, label })),
    optional: true,
    visible: (d) => getPath(d, ['goal', 'goal']) === 'skills' || Number(getPath(d, ['goal', 'gymRatio']) ?? 50) <= 60,
  },

  {
    id: 'days',
    block: 'logistics',
    title: '¿Cuántos días por semana puedes entrenar?',
    kind: 'select',
    path: ['logistics', 'daysPerWeek'],
    options: [2, 3, 4, 5, 6].map((n) => ({
      value: n,
      label: `${n} días`,
      description: { 2: 'Cuerpo completo', 3: 'Cuerpo completo o empuje/tirón/pierna', 4: 'Torso / pierna', 5: 'Híbrido', 6: 'Empuje / tirón / pierna ×2' }[n],
    })),
  },
  {
    id: 'minutes',
    block: 'logistics',
    title: '¿Cuánto tiempo tienes por sesión?',
    kind: 'select',
    path: ['logistics', 'minutesPerSession'],
    options: [30, 45, 60, 75, 90, 120].map((n) => ({ value: n, label: `${n} minutos` })),
  },
  { id: 'weekdays', block: 'logistics', title: '¿Qué días prefieres entrenar?', kind: 'weekdays', path: ['logistics', 'preferredDays'], optional: true },

  {
    id: 'zones',
    block: 'injuries',
    title: '¿Tienes alguna zona lesionada o con dolor?',
    hint: 'Los ejercicios que la cargan se excluyen y se sustituyen por el mismo patrón.',
    kind: 'multiselect',
    path: ['injuries', 'zones'],
    options: Object.entries(INJURY_ZONE_LABELS_ES).map(([value, label]) => ({ value, label })),
    optional: true,
  },
  { id: 'painful', block: 'injuries', title: '¿Qué movimientos te duelen?', hint: 'Por ejemplo: press militar, sentadilla profunda.', kind: 'text', path: ['injuries', 'painfulMovements'], optional: true },
  { id: 'surgeries', block: 'injuries', title: '¿Has tenido cirugías relevantes?', kind: 'text', path: ['injuries', 'surgeries'], optional: true },

  { id: 'sleep', block: 'recovery', title: '¿Cuántas horas duermes en promedio?', kind: 'number', path: ['recovery', 'sleepHours'], unit: 'h', min: 3, max: 12, step: 0.5, optional: true },
  {
    id: 'stress',
    block: 'recovery',
    title: '¿Cómo calificas tu estrés?',
    kind: 'select',
    path: ['recovery', 'stress'],
    options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}`, description: ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'][n - 1] })),
    optional: true,
  },
  {
    id: 'activity',
    block: 'recovery',
    title: '¿Qué tan activo es tu día fuera del gimnasio?',
    kind: 'select',
    path: ['recovery', 'activity'],
    options: Object.entries(ACTIVITY_LABELS_ES).map(([value, label]) => ({ value, label })),
    optional: true,
  },
  { id: 'favorites', block: 'recovery', title: '¿Tienes ejercicios favoritos?', hint: 'Sepáralos con comas.', kind: 'text', path: ['recovery', 'favorites'], optional: true },
  { id: 'banned', block: 'recovery', title: '¿Hay ejercicios que no quieres hacer?', hint: 'Sepáralos con comas.', kind: 'text', path: ['recovery', 'banned'], optional: true },

];

function isFemaleHint(): string {
  return 'A la altura del ombligo, relajado y sin meter el abdomen.';
}

export function visibleSteps(d: Draft): Step[] {
  return STEPS.filter((s) => !s.visible || s.visible(d));
}

export function isAnswered(step: Step, d: Draft): boolean {
  if (!step.path) return true;
  const v = getPath(d, step.path);
  if (step.kind === 'multiselect' || step.kind === 'weekdays') return Array.isArray(v);
  if (step.kind === 'text') return typeof v === 'string' && v.trim().length > 0;
  return v !== undefined && v !== null && v !== '';
}

export const WEEKDAYS = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];
