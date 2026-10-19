import type { Goal, LoadType, MuscleGroup } from '../schemas/common';
import type { SkillGoal, TrainingLevel } from '../questionnaire';
import type { IntensityCap } from '../screening';
import type { DayType, Prescription, Slot, SlotRole } from './types';

/** Reglas deterministas de la sección 6 del PRD. El LLM solo elige ejercicios dentro de estos límites. */

export const DAY_NAMES_ES: Record<DayType, string> = {
  full_a: 'Cuerpo completo A',
  full_b: 'Cuerpo completo B',
  full_c: 'Cuerpo completo C',
  push: 'Empuje',
  pull: 'Tirón',
  legs: 'Pierna',
  upper: 'Torso',
  lower: 'Pierna',
};

export type Split = { key: string; label: string; days: DayType[] };

/** 2 = cuerpo completo; 3 = cuerpo completo o PPL; 4 = torso/pierna; 5–6 = PPL o híbrido. */
export function splitFor(daysPerWeek: number, level: TrainingLevel, goal: Goal): Split {
  switch (Math.min(6, Math.max(2, Math.round(daysPerWeek)))) {
    case 2:
      return { key: 'full_body_2', label: 'Cuerpo completo (2 días)', days: ['full_a', 'full_b'] };
    case 3:
      return level === 'beginner' || goal === 'fat_loss'
        ? { key: 'full_body_3', label: 'Cuerpo completo (3 días)', days: ['full_a', 'full_b', 'full_c'] }
        : { key: 'ppl_3', label: 'Empuje / Tirón / Pierna', days: ['push', 'pull', 'legs'] };
    case 4:
      return { key: 'upper_lower_4', label: 'Torso / Pierna', days: ['upper', 'lower', 'upper', 'lower'] };
    case 5:
      return { key: 'hybrid_5', label: 'Empuje / Tirón / Pierna + Torso / Pierna', days: ['push', 'pull', 'legs', 'upper', 'lower'] };
    default:
      return { key: 'ppl_6', label: 'Empuje / Tirón / Pierna ×2', days: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] };
  }
}

/** Nombre único de cada día ("Torso A", "Torso B"…). */
export function dayNames(days: DayType[]): string[] {
  const counts = new Map<string, number>();
  for (const d of days) counts.set(DAY_NAMES_ES[d], (counts.get(DAY_NAMES_ES[d]) ?? 0) + 1);
  const seen = new Map<string, number>();
  return days.map((d) => {
    const base = DAY_NAMES_ES[d];
    if ((counts.get(base) ?? 0) <= 1 || base.endsWith(' A') || base.endsWith(' B') || base.endsWith(' C')) return base;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base} ${String.fromCharCode(64 + n)}`;
  });
}

const S = (role: SlotRole, patterns: Slot['patterns'], focus?: MuscleGroup[]): Slot => ({ role, patterns, focus });

/** Huecos por tipo de día, en orden de prioridad. */
export const DAY_SLOTS: Record<DayType, Slot[]> = {
  full_a: [
    S('main', ['squat']),
    S('main', ['horizontal_push']),
    S('main', ['vertical_pull']),
    S('secondary', ['hinge']),
    S('core', ['core']),
    S('accessory', ['isolation'], ['biceps', 'triceps']),
    S('accessory', ['isolation'], ['side_delts']),
  ],
  full_b: [
    S('main', ['hinge']),
    S('main', ['vertical_push']),
    S('main', ['horizontal_pull']),
    S('secondary', ['lunge', 'squat']),
    S('core', ['core']),
    S('accessory', ['isolation'], ['calves', 'hamstrings']),
    S('accessory', ['isolation'], ['rear_delts', 'biceps']),
  ],
  full_c: [
    S('main', ['squat', 'lunge']),
    S('main', ['horizontal_pull']),
    S('main', ['horizontal_push', 'vertical_push']),
    S('secondary', ['vertical_pull']),
    S('core', ['core']),
    S('accessory', ['isolation'], ['hamstrings']),
    S('accessory', ['isolation'], ['triceps', 'chest']),
  ],
  push: [
    S('main', ['horizontal_push']),
    S('main', ['vertical_push']),
    S('secondary', ['horizontal_push']),
    S('accessory', ['isolation'], ['side_delts']),
    S('accessory', ['isolation'], ['triceps']),
    S('accessory', ['isolation'], ['chest']),
    S('core', ['core']),
  ],
  pull: [
    S('main', ['vertical_pull']),
    S('main', ['horizontal_pull']),
    S('secondary', ['horizontal_pull', 'vertical_pull']),
    S('accessory', ['isolation'], ['biceps']),
    S('accessory', ['isolation'], ['rear_delts', 'upper_back', 'traps']),
    S('core', ['core']),
    S('accessory', ['isolation'], ['forearms', 'biceps']),
  ],
  legs: [
    S('main', ['squat']),
    S('main', ['hinge']),
    S('secondary', ['lunge']),
    S('accessory', ['isolation'], ['quads']),
    S('accessory', ['isolation'], ['hamstrings']),
    S('accessory', ['isolation'], ['calves']),
    S('core', ['core']),
  ],
  upper: [
    S('main', ['horizontal_push']),
    S('main', ['horizontal_pull']),
    S('secondary', ['vertical_push']),
    S('secondary', ['vertical_pull']),
    S('accessory', ['isolation'], ['biceps']),
    S('accessory', ['isolation'], ['triceps']),
    S('accessory', ['isolation'], ['side_delts', 'rear_delts']),
  ],
  lower: [
    S('main', ['squat']),
    S('main', ['hinge']),
    S('secondary', ['lunge']),
    S('accessory', ['isolation'], ['hamstrings']),
    S('accessory', ['isolation'], ['quads']),
    S('accessory', ['isolation'], ['calves']),
    S('core', ['core']),
  ],
};

/** Habilidades que se practican en cada tipo de día. */
const SKILL_DAYS: Record<SkillGoal, DayType[]> = {
  handstand: ['push', 'upper', 'full_a', 'full_b', 'full_c'],
  planche: ['push', 'upper', 'full_a', 'full_c'],
  muscle_up: ['pull', 'upper', 'full_b'],
  front_lever: ['pull', 'upper', 'full_a', 'full_c'],
  back_lever: ['pull', 'full_b'],
  l_sit: ['legs', 'lower', 'full_b', 'full_c'],
  pistol_squat: ['legs', 'lower', 'full_a'],
  human_flag: ['pull', 'full_c'],
};

export function slotsForDay(day: DayType, skillGoals: SkillGoal[]): Slot[] {
  const skills = skillGoals.filter((s) => SKILL_DAYS[s].includes(day)).slice(0, 1);
  const skillSlots: Slot[] = skills.map((skill) => ({ role: 'skill', patterns: ['skill', 'core'], skill }));
  return [...skillSlots, ...DAY_SLOTS[day]];
}

/** Volumen semanal por grupo muscular (series), conservador al inicio. */
export const WEEKLY_VOLUME: Record<TrainingLevel, { min: number; max: number }> = {
  beginner: { min: 6, max: 12 },
  intermediate: { min: 8, max: 16 },
  advanced: { min: 10, max: 20 },
};

/** Grupos que deben recibir volumen mínimo cuando el split los entrena. */
export const MAJOR_MUSCLES: MuscleGroup[] = ['chest', 'lats', 'upper_back', 'quads', 'hamstrings', 'glutes'];

const SETS: Record<TrainingLevel, Record<SlotRole, number>> = {
  beginner: { skill: 3, main: 3, secondary: 2, accessory: 2, core: 2 },
  intermediate: { skill: 4, main: 3, secondary: 3, accessory: 3, core: 2 },
  advanced: { skill: 5, main: 4, secondary: 3, accessory: 3, core: 3 },
};

type Range = [number, number];

const REP_RANGES: Record<Goal, Record<'main' | 'secondary' | 'accessory', Range>> = {
  strength: { main: [3, 6], secondary: [5, 8], accessory: [8, 12] },
  hypertrophy: { main: [6, 10], secondary: [8, 12], accessory: [10, 15] },
  fat_loss: { main: [8, 12], secondary: [10, 15], accessory: [12, 15] },
  recomposition: { main: [6, 10], secondary: [8, 12], accessory: [10, 15] },
  skills: { main: [5, 8], secondary: [6, 10], accessory: [8, 12] },
};

/** Rango para ejercicios de peso corporal (umbral de progresión de calistenia: 12 repeticiones). */
const BW_RANGES: Record<'main' | 'secondary' | 'accessory', Range> = {
  main: [5, 12],
  secondary: [6, 12],
  accessory: [8, 15],
};

const HOLD_SECONDS: Record<TrainingLevel, number> = { beginner: 20, intermediate: 30, advanced: 40 };
const SKILL_HOLD_SECONDS: Record<TrainingLevel, number> = { beginner: 10, intermediate: 15, advanced: 20 };

/** RIR mínimo por tope de intensidad (bandera PAR-Q+/ACSM). */
export const MIN_RIR_FOR_CAP: Record<IntensityCap, number> = { light_moderate: 3, moderate: 2, vigorous: 0 };

/** Rangos de descanso válidos por papel (segundos). */
export const REST_BOUNDS: Record<SlotRole, Range> = {
  skill: [120, 180],
  main: [90, 180],
  secondary: [75, 150],
  accessory: [45, 90],
  core: [45, 90],
};

export function prescribe(args: {
  role: SlotRole;
  loadType: LoadType;
  goal: Goal;
  level: TrainingLevel;
  intensityCap: IntensityCap;
}): Prescription {
  const { role, loadType, goal, level, intensityCap } = args;
  const sets = SETS[level][role];
  const minRir = MIN_RIR_FOR_CAP[intensityCap];
  const baseRir = role === 'accessory' && goal === 'hypertrophy' ? 1 : goal === 'hypertrophy' && level !== 'beginner' ? 1 : 2;
  const rirTarget = Math.min(4, Math.max(minRir, role === 'skill' ? 2 : baseRir));

  if (loadType === 'isometric' || role === 'skill') {
    const seconds = role === 'skill' ? SKILL_HOLD_SECONDS[level] : role === 'core' ? HOLD_SECONDS[level] + 10 : HOLD_SECONDS[level];
    if (loadType === 'isometric') {
      return {
        sets,
        repMin: null,
        repMax: null,
        targetSeconds: Math.min(120, seconds),
        rirTarget,
        restSeconds: role === 'skill' ? 150 : role === 'core' ? 60 : 90,
      };
    }
    // Habilidad dinámica (p. ej. muscle-up asistido): pocas repeticiones de calidad.
    return { sets, repMin: 3, repMax: 6, targetSeconds: null, rirTarget, restSeconds: 150 };
  }

  const rangeKey = role === 'main' ? 'main' : role === 'secondary' ? 'secondary' : 'accessory';
  let [repMin, repMax] = loadType === 'external' ? REP_RANGES[goal][rangeKey] : BW_RANGES[rangeKey];
  if (role === 'core') [repMin, repMax] = [10, 15];
  if (intensityCap === 'light_moderate' && repMin < 8) [repMin, repMax] = [8, Math.max(12, repMax)];

  const heavy = loadType === 'external' || loadType === 'weighted_bw';
  const restSeconds =
    role === 'main'
      ? heavy && goal === 'strength'
        ? 180
        : heavy
          ? 120
          : 90
      : role === 'secondary'
        ? heavy
          ? 90
          : 75
        : role === 'core'
          ? 60
          : 60;

  return { sets, repMin, repMax, targetSeconds: null, rirTarget, restSeconds };
}

/** Duración estimada de un ejercicio en segundos (trabajo + descansos + transición). */
export function estimateExerciseSeconds(p: Prescription): number {
  const reps = p.repMin !== null && p.repMax !== null ? (p.repMin + p.repMax) / 2 : 0;
  const work = p.targetSeconds !== null ? p.targetSeconds + 10 : reps * 3 + 15;
  return p.sets * work + Math.max(0, p.sets - 1) * p.restSeconds + 90;
}

export const WARMUP_SECONDS = 5 * 60;

export function estimateSessionMinutes(prescriptions: Prescription[]): number {
  const total = WARMUP_SECONDS + prescriptions.reduce((acc, p) => acc + estimateExerciseSeconds(p), 0);
  return Math.round(total / 60);
}
