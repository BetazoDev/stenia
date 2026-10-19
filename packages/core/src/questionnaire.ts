import { z } from 'zod';

import { Goal, Sex } from './schemas/common';
import { AcsmAnswers, ParqAnswers, ParqFollowUp } from './screening';

/** Cuestionario inicial de 8 bloques (sección 4 del PRD). Obligatorios para generar: 1, 2, 5 y 6. */

export const SkillGoal = z.enum(['handstand', 'muscle_up', 'front_lever', 'back_lever', 'planche', 'l_sit', 'pistol_squat', 'human_flag']);
export type SkillGoal = z.infer<typeof SkillGoal>;

export const SKILL_LABELS_ES: Record<SkillGoal, string> = {
  handstand: 'Pino (handstand)',
  muscle_up: 'Muscle-up',
  front_lever: 'Front lever',
  back_lever: 'Back lever',
  planche: 'Planche',
  l_sit: 'L-sit',
  pistol_squat: 'Sentadilla pistol',
  human_flag: 'Bandera humana',
};

export const GOAL_LABELS_ES: Record<Goal, string> = {
  hypertrophy: 'Ganar músculo (hipertrofia)',
  strength: 'Ganar fuerza',
  fat_loss: 'Perder grasa',
  recomposition: 'Recomposición (perder grasa y ganar músculo)',
  skills: 'Dominar habilidades de calistenia',
};

export const InjuryZone = z.enum(['neck', 'shoulder', 'elbow', 'wrist', 'upper_back', 'lower_back', 'hip', 'knee', 'ankle']);
export type InjuryZone = z.infer<typeof InjuryZone>;

export const INJURY_ZONE_LABELS_ES: Record<InjuryZone, string> = {
  neck: 'Cuello',
  shoulder: 'Hombro',
  elbow: 'Codo',
  wrist: 'Muñeca',
  upper_back: 'Espalda alta',
  lower_back: 'Espalda baja',
  hip: 'Cadera',
  knee: 'Rodilla',
  ankle: 'Tobillo',
};

export const ActivityLevel = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);
export type ActivityLevel = z.infer<typeof ActivityLevel>;

export const ACTIVITY_LABELS_ES: Record<ActivityLevel, string> = {
  sedentary: 'Sedentaria (oficina, casi sin caminar)',
  light: 'Ligera (camino un poco a diario)',
  moderate: 'Moderada (de pie o caminando buena parte del día)',
  active: 'Activa (trabajo físico)',
  very_active: 'Muy activa (trabajo físico pesado)',
};

export const BodyFatMethod = z.enum(['inbody', 'bia', 'dexa', 'navy', 'manual']);
export type BodyFatMethod = z.infer<typeof BodyFatMethod>;

export const SafetyBlock = z.object({
  parq: ParqAnswers,
  followUp: ParqFollowUp.optional(),
  acsm: AcsmAnswers,
});

export const BodyBlock = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  sex: Sex,
  heightCm: z.number().min(120).max(230),
  weightKg: z.number().min(30).max(300),
});

export const KnownBlock = z.object({
  bodyFatPct: z.number().min(3).max(70).nullable().default(null),
  bodyFatMethod: BodyFatMethod.nullable().default(null),
  neckCm: z.number().min(20).max(70).nullable().default(null),
  waistCm: z.number().min(40).max(200).nullable().default(null),
  hipCm: z.number().min(50).max(200).nullable().default(null),
  bmrMeasured: z.number().int().min(800).max(4000).nullable().default(null),
});

export const LevelBlock = z.object({
  trainingMonths: z.number().int().min(0).max(600).nullable().default(null),
  maxPushups: z.number().int().min(0).max(200).nullable().default(null),
  maxPullups: z.number().int().min(0).max(100).nullable().default(null),
  maxDips: z.number().int().min(0).max(150).nullable().default(null),
  plankSeconds: z.number().int().min(0).max(1200).nullable().default(null),
  benchKg: z.number().min(0).max(400).nullable().default(null),
  squatKg: z.number().min(0).max(500).nullable().default(null),
  rowKg: z.number().min(0).max(400).nullable().default(null),
});

export const GoalBlock = z.object({
  goal: Goal,
  skillGoals: z.array(SkillGoal).default([]),
  /** 0 = solo calistenia, 100 = solo gimnasio. */
  gymRatio: z.number().int().min(0).max(100),
});

export const LogisticsBlock = z.object({
  daysPerWeek: z.number().int().min(2).max(6),
  minutesPerSession: z.number().int().min(20).max(150),
  /** 0 = domingo … 6 = sábado. */
  preferredDays: z.array(z.number().int().min(0).max(6)).default([]),
});

export const InjuriesBlock = z.object({
  zones: z.array(InjuryZone).default([]),
  painfulMovements: z.string().max(400).default(''),
  surgeries: z.string().max(400).default(''),
});

export const RecoveryBlock = z.object({
  sleepHours: z.number().min(3).max(12).nullable().default(null),
  stress: z.number().int().min(1).max(5).nullable().default(null),
  activity: ActivityLevel.nullable().default(null),
  favorites: z.string().max(400).default(''),
  banned: z.string().max(400).default(''),
});

export const Questionnaire = z.object({
  safety: SafetyBlock.optional(),
  body: BodyBlock.optional(),
  known: KnownBlock.optional(),
  level: LevelBlock.optional(),
  goal: GoalBlock.optional(),
  logistics: LogisticsBlock.optional(),
  injuries: InjuriesBlock.optional(),
  recovery: RecoveryBlock.optional(),
});
export type Questionnaire = z.infer<typeof Questionnaire>;

export const CompleteQuestionnaire = Questionnaire.extend({
  safety: SafetyBlock,
  body: BodyBlock,
  goal: GoalBlock,
  logistics: LogisticsBlock,
});
export type CompleteQuestionnaire = z.infer<typeof CompleteQuestionnaire>;

export const REQUIRED_BLOCKS = ['safety', 'body', 'goal', 'logistics'] as const;
export type BlockKey = keyof Questionnaire;

export const BLOCK_LABELS_ES: Record<BlockKey, string> = {
  safety: 'Seguridad',
  body: 'Datos corporales',
  known: 'Datos que ya conoces',
  level: 'Nivel actual',
  goal: 'Objetivo',
  logistics: 'Logística',
  injuries: 'Lesiones y dolor',
  recovery: 'Recuperación y preferencias',
};

export function missingRequiredBlocks(q: Questionnaire): BlockKey[] {
  return REQUIRED_BLOCKS.filter((key) => {
    const schema = { safety: SafetyBlock, body: BodyBlock, goal: GoalBlock, logistics: LogisticsBlock }[key];
    return !schema.safeParse(q[key]).success;
  });
}

export function canGenerateRoutine(q: Questionnaire): q is CompleteQuestionnaire {
  return missingRequiredBlocks(q).length === 0;
}

/** Edad en años cumplidos a una fecha dada. */
export function ageFromBirthDate(birthDate: string, at = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  let age = at.getUTCFullYear() - y;
  const beforeBirthday = at.getUTCMonth() + 1 < m || (at.getUTCMonth() + 1 === m && at.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';

export const LEVEL_LABELS_ES: Record<TrainingLevel, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

/** Nivel de entrenamiento a partir del bloque 4 (meses entrenando y marcas de calistenia). */
export function trainingLevel(level: z.infer<typeof LevelBlock> | undefined): TrainingLevel {
  if (!level) return 'beginner';
  const months = level.trainingMonths ?? 0;
  let score = months >= 24 ? 2 : months >= 6 ? 1 : 0;
  const pull = level.maxPullups ?? 0;
  const push = level.maxPushups ?? 0;
  if (pull >= 12 || push >= 40) score = Math.max(score, 2);
  else if (pull >= 5 || push >= 20) score = Math.max(score, 1);
  return score >= 2 ? 'advanced' : score === 1 ? 'intermediate' : 'beginner';
}

/** Lista "a, b; c" → ["a", "b", "c"] para favoritos y vetados. */
export function splitList(text: string | undefined): string[] {
  return (text ?? '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}
