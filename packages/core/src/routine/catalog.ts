import type { MovementPattern } from '../schemas/common';
import type { InjuryZone, TrainingLevel } from '../questionnaire';
import type { CatalogExercise, GenerationContext, Slot } from './types';

/** Filtro del catálogo (sección 6, paso 3): equipo disponible, lesiones, vetados y nivel. */

const LEVEL_RANK: Record<TrainingLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Equipo que se asume disponible aunque el perfil no lo declare. */
export const ALWAYS_AVAILABLE = ['floor_space'];

/** Patrones que no forman parte de una rutina de fuerza (calentamiento y cardio quedan fuera). */
const EXCLUDED_PATTERNS: MovementPattern[] = ['mobility', 'cardio', 'explosive', 'carry'];

type InjuryRule = { patterns?: MovementPattern[]; names: RegExp };

/** Exclusiones por zona lesionada. Conservador: ante la duda, se excluye y se sustituye por el mismo patrón. */
export const INJURY_RULES: Record<InjuryZone, InjuryRule> = {
  neck: { names: /neck|shrug|behind the neck|cuello|encogimiento/i },
  shoulder: {
    patterns: ['vertical_push'],
    names: /\bdips?\b|fondos|handstand|pino|overhead|upright row|behind the neck|planche|muscle.?up|arnold/i,
  },
  elbow: { names: /skull|french press|close.?grip|diamond|diamante|lying triceps|jm press/i },
  wrist: { names: /handstand|pino|planche|front squat|wrist|muñeca|frog stand|crow|cuervo/i },
  upper_back: { names: /good morning|bent.?over|t.?bar row|pendlay/i },
  lower_back: {
    patterns: ['hinge'],
    names: /deadlift|peso muerto|good morning|bent.?over|back extension|hyperextension|superman|jefferson/i,
  },
  hip: { names: /sumo|pistol|cossack|frog squat/i },
  knee: {
    patterns: ['lunge'],
    names: /jump|salto|pistol|sissy|leg extension|extensi[oó]n de pierna|deep squat|lunge|zancada|step.?up/i,
  },
  ankle: { names: /jump|salto|calf|pantorrilla|skipping|run|box/i },
};

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesAny(ex: CatalogExercise, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = `${normalizeText(ex.nameEs)} ${normalizeText(ex.nameEn)}`;
  return terms.some((t) => {
    const n = normalizeText(t);
    return n.length > 2 && haystack.includes(n);
  });
}

/** Palabras sueltas de "movimientos que duelen" que excluyen ejercicios por nombre. */
function painfulTerms(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3);
}

export type FilterReason = 'equipment' | 'injury' | 'banned' | 'level' | 'pattern';

export function exclusionReason(ex: CatalogExercise, ctx: GenerationContext): FilterReason | null {
  if (EXCLUDED_PATTERNS.includes(ex.pattern)) return 'pattern';
  const available = new Set([...ctx.availableEquipment, ...ALWAYS_AVAILABLE]);
  if (!ex.equipment.every((e) => available.has(e))) return 'equipment';
  if (LEVEL_RANK[ex.level] > LEVEL_RANK[ctx.level] + (ctx.level === 'beginner' ? 0 : 1)) return 'level';
  for (const zone of ctx.injuryZones) {
    const rule = INJURY_RULES[zone];
    if (rule.patterns?.includes(ex.pattern) || rule.names.test(`${ex.nameEn} ${ex.nameEs}`)) return 'injury';
  }
  if (matchesAny(ex, painfulTerms(ctx.painfulMovements))) return 'injury';
  if (matchesAny(ex, ctx.banned)) return 'banned';
  return null;
}

export function filterCatalog(exercises: CatalogExercise[], ctx: GenerationContext): CatalogExercise[] {
  return exercises.filter((ex) => exclusionReason(ex, ctx) === null);
}

const SOURCE_SCORE: Record<string, number> = { repdb: 1, 'free-exercise-db': 0.5, calisthenics: 0.4 };

/** Ejercicios canónicos por patrón: los que un entrenador elegiría primero. */
export const STAPLES: Partial<Record<MovementPattern, RegExp>> = {
  squat: /^(barbell )?(back |front |high bar |low bar )?squats?$|goblet squat|^leg press|hack squat|smith machine squat|^bodyweight squat|^air squat|^squat$|safety bar squat/,
  hinge: /romanian deadlift|^(barbell |conventional )?deadlift$|^rdl|hip thrust|stiff.?legged deadlift|dumbbell romanian|single leg romanian|glute bridge|back extension|45 degree hyperextension/,
  lunge: /walking lunge|bulgarian split squat|reverse lunge|^dumbbell lunges?$|^lunges?$|step.?ups?$|split squat/,
  horizontal_push: /^(barbell )?bench press|dumbbell bench press|incline (barbell |dumbbell )?(bench )?press|^push.?ups?$|^dips?$|parallel bar dips?|chest dips?|machine chest press|chest press|decline push.?up|diamond push.?up/,
  vertical_push: /^(standing )?(barbell )?overhead press|military press|dumbbell shoulder press|seated dumbbell (shoulder )?press|machine shoulder press|pike push.?up|handstand push.?up|arnold press/,
  vertical_pull: /^pull.?ups?$|^chin.?ups?$|lat pulldown|wide.?grip pulldown|close.?grip (lat )?pulldown|neutral grip pull.?up|assisted pull.?up|band assisted pull.?up/,
  horizontal_pull: /^(barbell |bent.?over (barbell )?)rows?$|bent.?over row|one.?arm dumbbell row|dumbbell row|seated cable row|cable row|t.?bar row|chest.?supported row|inverted row|australian pull.?up|machine row|seal row/,
  core: /^plank$|front plank|side plank|hanging (leg|knee) raises?|ab wheel|rollout|cable crunch|dead bug|hollow (body )?hold|l.?sit|pallof press|^crunches?$/,
  isolation: /(barbell|dumbbell|ez.?bar|cable|hammer|preacher) curls?|^biceps? curls?|triceps? pushdown|rope pushdown|overhead (triceps|cable) extension|skull ?crusher|lateral raises?|face pull|rear delt fly|reverse (pec deck|fly)|^leg curl|lying leg curl|seated leg curl|^leg extension|(standing|seated) calf raise|^calf raise|cable (fly|crossover)|pec deck|dumbbell fly|shrugs?$|nordic/,
  skill: /handstand|planche|front lever|back lever|l.?sit|muscle.?up|human flag|pistol/,
};

/** Variantes raras que no conviene elegir sin una razón específica. */
const EXOTIC = /somersault|jefferson|halo|zercher|anderson|\bpin\b|deficit|paused|tempo|with chains|chain|landmine|curtsy|cossack|hindu|frankenstein|spider|drag curl|bottoms.?up|clean|snatch|jerk|windmill|turkish|around the world|bradford|guillotine|jm press|tate press|kneeling|sots|overhead squat|one.?leg|single.?leg|single.?arm|one.?arm|band(ed)?s?\b|with bands|isometric|negative|partial|plyo|explosive|jump/;

/** Preferencia de un ejercicio para un hueco: proporción gym/calistenia, compuesto, nivel, fuente y favoritos. */
export function scoreExercise(ex: CatalogExercise, slot: Slot, ctx: GenerationContext): number {
  const gym = ctx.gymRatio / 100;
  let score = ex.loadType === 'external' ? gym * 2 : (1 - gym) * 2;
  if ((slot.role === 'main' || slot.role === 'secondary') && ex.mechanic === 'compound') score += 1;
  if (slot.role === 'accessory' && ex.mechanic === 'isolation') score += 0.5;
  if (ex.level === ctx.level) score += 0.5;
  if (LEVEL_RANK[ex.level] > LEVEL_RANK[ctx.level]) score -= 0.75;
  score += SOURCE_SCORE[ex.source] ?? 0;
  if (ex.hasMedia) score += 0.5;
  if (ex.reviewed) score += 0.3;
  const name = normalizeText(ex.nameEn);
  const staple = STAPLES[ex.pattern]?.test(name) ?? false;
  if (staple) score += slot.role === 'main' || slot.role === 'secondary' || slot.role === 'skill' ? 3 : 1.5;
  if (EXOTIC.test(name) && !(slot.skill && skillMatches(ex, slot.skill))) score -= slot.role === 'main' ? 3 : 1.5;
  if (matchesAny(ex, ctx.favorites)) score += 2;
  if (slot.skill && skillMatches(ex, slot.skill)) score += 4;
  if (slot.focus && slot.focus.includes(ex.primaryMuscles[0] ?? 'full_body')) score += 0.5;
  // Evita máquinas genéricas como opción principal si hay alternativas más específicas.
  if (ex.equipment.includes('machine_generic') || ex.equipment.includes('other_equipment')) score -= 0.5;
  return score;
}

const SKILL_TERMS: Record<string, RegExp> = {
  handstand: /handstand|pino|wall walk|pike/i,
  planche: /planche|pseudo planche|tuck planche|lean/i,
  muscle_up: /muscle.?up|explosive pull|chest.?to.?bar|high pull/i,
  front_lever: /front lever|tuck lever|dragon flag/i,
  back_lever: /back lever|skin the cat|german hang/i,
  l_sit: /l.?sit|tuck sit|v.?sit|compression/i,
  pistol_squat: /pistol|shrimp|single.?leg squat|box pistol/i,
  human_flag: /flag|bandera/i,
};

export function skillMatches(ex: CatalogExercise, skill: string): boolean {
  return SKILL_TERMS[skill]?.test(`${ex.nameEn} ${ex.nameEs}`) ?? false;
}

export function fitsSlot(ex: CatalogExercise, slot: Slot): boolean {
  if (slot.role === 'skill') return slot.skill ? skillMatches(ex, slot.skill) : ex.pattern === 'skill';
  if (!slot.patterns.includes(ex.pattern)) return false;
  if (slot.focus && slot.focus.length > 0) {
    return ex.primaryMuscles.some((m) => slot.focus?.includes(m));
  }
  return true;
}

/** Clave para deduplicar el mismo ejercicio presente en varias fuentes. */
export function dedupeKey(ex: CatalogExercise): string {
  return normalizeText(ex.nameEn)
    .replace(/\b(the|a|with|on|and|exercise)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rankForSlot(candidates: CatalogExercise[], slot: Slot, ctx: GenerationContext): CatalogExercise[] {
  const scored = candidates
    .filter((ex) => fitsSlot(ex, slot))
    .map((ex) => ({ ex, score: scoreExercise(ex, slot, ctx) }))
    .sort((a, b) => b.score - a.score || a.ex.slug.localeCompare(b.ex.slug));
  const seen = new Set<string>();
  const out: CatalogExercise[] = [];
  for (const { ex } of scored) {
    const key = dedupeKey(ex);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ex);
  }
  return out;
}

/** Sustitutos del mismo patrón con el equipo disponible (botón "Hoy no está disponible"). */
export function alternativesFor(
  exercise: CatalogExercise,
  catalog: CatalogExercise[],
  ctx: GenerationContext,
  options: { unavailableEquipment?: string[]; limit?: number } = {},
): CatalogExercise[] {
  const busy = new Set(options.unavailableEquipment ?? []);
  const reduced: GenerationContext = { ...ctx, availableEquipment: ctx.availableEquipment.filter((e) => !busy.has(e)) };
  const slot: Slot = { role: 'secondary', patterns: [exercise.pattern] };
  const pool = filterCatalog(catalog, reduced).filter(
    (ex) =>
      ex.id !== exercise.id &&
      ex.pattern === exercise.pattern &&
      ex.primaryMuscles.some((m) => exercise.primaryMuscles.includes(m)) &&
      !ex.equipment.some((e) => busy.has(e)),
  );
  return rankForSlot(pool, slot, reduced).slice(0, options.limit ?? 6);
}
