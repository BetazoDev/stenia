import type { MuscleGroup } from '../schemas/common';
import { RoutinePlan } from '../schemas/routine';
import { ALWAYS_AVAILABLE } from './catalog';
import { estimateExerciseSeconds, MAJOR_MUSCLES, MIN_RIR_FOR_CAP, WARMUP_SECONDS, WEEKLY_VOLUME } from './rules';
import type { CatalogExercise, GenerationContext } from './types';

export type RoutineValidation = {
  ok: boolean;
  plan: RoutinePlan | null;
  /** Errores que obligan a reintentar (se envían al LLM tal cual). */
  errors: string[];
  /** Avisos que no bloquean el guardado. */
  warnings: string[];
  minutesPerDay: number[];
  weeklySets: Partial<Record<MuscleGroup, number>>;
};

/** Series semanales por músculo: primario cuenta 1, secundario 0.5. */
export function weeklySetsByMuscle(plan: RoutinePlan, byId: Map<string, CatalogExercise>): Partial<Record<MuscleGroup, number>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const day of plan.days) {
    for (const item of day.exercises) {
      const ex = byId.get(item.exerciseId);
      if (!ex) continue;
      for (const m of ex.primaryMuscles) out[m] = (out[m] ?? 0) + item.sets;
      for (const m of ex.secondaryMuscles) out[m] = (out[m] ?? 0) + item.sets * 0.5;
    }
  }
  return out;
}

/** Validación de la salida del LLM (sección 6, paso 5). */
export function validateRoutinePlan(
  raw: unknown,
  args: { ctx: GenerationContext; catalogById: Map<string, CatalogExercise>; allowedIds: Set<string> },
): RoutineValidation {
  const { ctx, catalogById, allowedIds } = args;
  const parsed = RoutinePlan.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      plan: null,
      errors: parsed.error.issues.slice(0, 8).map((i) => `Formato inválido en ${i.path.join('.') || 'raíz'}: ${i.message}`),
      warnings: [],
      minutesPerDay: [],
      weeklySets: {},
    };
  }
  const plan = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];
  const available = new Set([...ctx.availableEquipment, ...ALWAYS_AVAILABLE]);
  const minRir = MIN_RIR_FOR_CAP[ctx.intensityCap];

  if (plan.days.length !== ctx.daysPerWeek) {
    errors.push(`La rutina debe tener exactamente ${ctx.daysPerWeek} días (tiene ${plan.days.length}).`);
  }

  const minutesPerDay = plan.days.map((day, d) => {
    const seen = new Set<string>();
    let seconds = WARMUP_SECONDS;
    day.exercises.forEach((item, i) => {
      const where = `Día ${d + 1} («${day.name}»), ejercicio ${i + 1}`;
      const ex = catalogById.get(item.exerciseId);
      if (!ex || !allowedIds.has(item.exerciseId)) {
        errors.push(`${where}: el ID «${item.exerciseId}» no existe en el catálogo permitido.`);
        return;
      }
      if (seen.has(item.exerciseId)) errors.push(`${where}: «${ex.nameEs}» está repetido en el mismo día.`);
      seen.add(item.exerciseId);
      const missing = ex.equipment.filter((e) => !available.has(e));
      if (missing.length > 0) errors.push(`${where}: «${ex.nameEs}» requiere equipo no disponible (${missing.join(', ')}).`);
      if (ex.loadType === 'isometric') {
        if (item.targetSeconds === null) errors.push(`${where}: «${ex.nameEs}» es isométrico y necesita targetSeconds.`);
      } else if (item.repMin === null || item.repMax === null) {
        errors.push(`${where}: «${ex.nameEs}» necesita repMin y repMax.`);
      } else if (item.repMin > item.repMax) {
        errors.push(`${where}: repMin (${item.repMin}) es mayor que repMax (${item.repMax}).`);
      }
      if (item.rirTarget < minRir) {
        errors.push(`${where}: el RIR mínimo permitido por el cribado de salud es ${minRir} (se pidió ${item.rirTarget}).`);
      }
      seconds += estimateExerciseSeconds({
        sets: item.sets,
        repMin: item.repMin,
        repMax: item.repMax,
        targetSeconds: item.targetSeconds,
        rirTarget: item.rirTarget,
        restSeconds: item.restSeconds,
      });
    });
    const minutes = Math.round(seconds / 60);
    if (minutes > ctx.minutesPerSession * 1.05) {
      errors.push(`Día ${d + 1} («${day.name}»): dura ~${minutes} min y el máximo es ${ctx.minutesPerSession} min. Quita ejercicios o series.`);
    }
    return minutes;
  });

  const weeklySets = weeklySetsByMuscle(plan, catalogById);
  const { min, max } = WEEKLY_VOLUME[ctx.level];
  for (const [muscle, sets] of Object.entries(weeklySets) as [MuscleGroup, number][]) {
    if (sets > max * 1.35) errors.push(`Volumen excesivo para ${muscle}: ${sets} series/semana (máximo ${max}).`);
    else if (sets > max) warnings.push(`Volumen alto para ${muscle}: ${sets} series/semana (referencia ${max}).`);
  }
  for (const muscle of MAJOR_MUSCLES) {
    const sets = weeklySets[muscle] ?? 0;
    if (sets > 0 && sets < min * 0.5) warnings.push(`Volumen bajo para ${muscle}: ${sets} series/semana.`);
  }

  return { ok: errors.length === 0, plan, errors, warnings, minutesPerDay, weeklySets };
}
