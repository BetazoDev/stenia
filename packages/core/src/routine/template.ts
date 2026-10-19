import { GOAL_LABELS_ES, LEVEL_LABELS_ES } from '../questionnaire';
import type { RoutinePlan } from '../schemas/routine';
import { INTENSITY_CAP_LABELS_ES } from '../screening';
import { filterCatalog, rankForSlot } from './catalog';
import { dayNames, estimateExerciseSeconds, prescribe, slotsForDay, splitFor, WARMUP_SECONDS, WEEKLY_VOLUME } from './rules';
import type { MuscleGroup } from '../schemas/common';
import type { CatalogExercise, GenerationContext, Prescription, Slot } from './types';

export const MAX_EXERCISES_PER_DAY = 9;
export const MIN_EXERCISES_PER_DAY = 3;

export class InsufficientCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientCatalogError';
  }
}

export type PlannedExercise = {
  exercise: CatalogExercise;
  slot: Slot;
  prescription: Prescription;
};

export type PlannedDay = { name: string; exercises: PlannedExercise[] };

/** Construye la rutina sin LLM: mismo split, mismos límites. Es la plantilla de respaldo de la sección 6. */
export function buildTemplateDays(catalog: CatalogExercise[], ctx: GenerationContext): PlannedDay[] {
  const split = splitFor(ctx.daysPerWeek, ctx.level, ctx.goal);
  const names = dayNames(split.days);
  const candidates = filterCatalog(catalog, ctx);
  if (candidates.length < MIN_EXERCISES_PER_DAY) {
    throw new InsufficientCatalogError('No hay suficientes ejercicios compatibles con tu equipo y tus lesiones.');
  }
  const budget = ctx.minutesPerSession * 60 - WARMUP_SECONDS;
  const occurrences = new Map<string, number>();
  const weekly = new Map<MuscleGroup, number>();
  const maxWeekly = WEEKLY_VOLUME[ctx.level].max;
  const fitsVolume = (ex: CatalogExercise, sets: number) =>
    ex.primaryMuscles.every((m) => (weekly.get(m) ?? 0) + sets <= maxWeekly) &&
    ex.secondaryMuscles.every((m) => (weekly.get(m) ?? 0) + sets * 0.5 <= maxWeekly * 1.15);
  const addVolume = (ex: CatalogExercise, sets: number) => {
    for (const m of ex.primaryMuscles) weekly.set(m, (weekly.get(m) ?? 0) + sets);
    for (const m of ex.secondaryMuscles) weekly.set(m, (weekly.get(m) ?? 0) + sets * 0.5);
  };

  return split.days.map((dayType, dayIndex) => {
    const occurrence = occurrences.get(dayType) ?? 0;
    occurrences.set(dayType, occurrence + 1);
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    let seconds = 0;

    const tryAdd = (slot: Slot, rotation: number): boolean => {
      const ranked = rankForSlot(candidates, slot, ctx).filter((ex) => !used.has(ex.id));
      if (ranked.length === 0) return false;
      // Rotación para variar días repetidos, saltando opciones que excederían el volumen semanal.
      const ordered = [...ranked.slice(Math.min(rotation, ranked.length - 1)), ...ranked.slice(0, Math.min(rotation, ranked.length - 1))];
      const prescriptionFor = (ex: CatalogExercise) =>
        prescribe({ role: slot.role, loadType: ex.loadType, goal: ctx.goal, level: ctx.level, intensityCap: ctx.intensityCap });
      let pick = ordered.slice(0, 12).find((ex) => fitsVolume(ex, prescriptionFor(ex).sets));
      if (!pick) {
        if (slot.role !== 'main' && exercises.length >= MIN_EXERCISES_PER_DAY) return false;
        // Ninguno cabe: el que menos se pase del volumen semanal entre los mejores clasificados.
        const overflow = (ex: CatalogExercise) => {
          const sets = prescriptionFor(ex).sets;
          return (
            ex.primaryMuscles.reduce((acc, m) => acc + Math.max(0, (weekly.get(m) ?? 0) + sets - maxWeekly), 0) +
            ex.secondaryMuscles.reduce((acc, m) => acc + Math.max(0, (weekly.get(m) ?? 0) + sets * 0.5 - maxWeekly), 0)
          );
        };
        pick = [...ordered.slice(0, 12)].sort((a, b) => overflow(a) - overflow(b))[0];
      }
      if (!pick) return false;
      const prescription = prescriptionFor(pick);
      const cost = estimateExerciseSeconds(prescription);
      if (exercises.length >= MIN_EXERCISES_PER_DAY && seconds + cost > budget) return false;
      used.add(pick.id);
      seconds += cost;
      addVolume(pick, prescription.sets);
      exercises.push({ exercise: pick, slot, prescription });
      return true;
    };

    for (const slot of slotsForDay(dayType, ctx.skillGoals)) {
      if (exercises.length >= MAX_EXERCISES_PER_DAY) break;
      tryAdd(slot, occurrence);
    }
    // Relleno con patrones generales si el equipo es muy limitado.
    const fillers: Slot[] = [
      { role: 'secondary', patterns: ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'] },
      { role: 'secondary', patterns: ['squat', 'lunge', 'hinge'] },
      { role: 'core', patterns: ['core'] },
      { role: 'accessory', patterns: ['isolation'] },
    ];
    for (const slot of fillers) {
      if (exercises.length >= MIN_EXERCISES_PER_DAY) break;
      tryAdd(slot, 0);
    }
    if (exercises.length < MIN_EXERCISES_PER_DAY) {
      throw new InsufficientCatalogError(`No se pudieron reunir 3 ejercicios para el día ${dayIndex + 1}.`);
    }
    return { name: names[dayIndex] ?? `Día ${dayIndex + 1}`, exercises };
  });
}

export function templateRationale(ctx: GenerationContext): string {
  const split = splitFor(ctx.daysPerWeek, ctx.level, ctx.goal);
  const parts = [
    `${split.label}, ${ctx.daysPerWeek} días de ${ctx.minutesPerSession} min.`,
    `Nivel ${LEVEL_LABELS_ES[ctx.level].toLowerCase()}, objetivo: ${GOAL_LABELS_ES[ctx.goal].toLowerCase()}.`,
    `Proporción gimnasio/calistenia ${ctx.gymRatio}/${100 - ctx.gymRatio}.`,
    ctx.intensityCap !== 'vigorous' ? `Intensidad limitada a ${INTENSITY_CAP_LABELS_ES[ctx.intensityCap].toLowerCase()}.` : '',
    'Rutina armada con reglas deterministas: compuestos primero, accesorios después, volumen conservador.',
  ];
  return parts.filter(Boolean).join(' ').slice(0, 600);
}

export function toRoutinePlan(days: PlannedDay[], rationale: string): RoutinePlan {
  return {
    rationale: rationale.slice(0, 600),
    days: days.map((d) => ({
      name: d.name.slice(0, 40),
      exercises: d.exercises.map(({ exercise, prescription }) => ({
        exerciseId: exercise.id,
        sets: prescription.sets,
        repMin: prescription.repMin,
        repMax: prescription.repMax,
        targetSeconds: prescription.targetSeconds,
        rirTarget: prescription.rirTarget,
        restSeconds: prescription.restSeconds,
      })),
    })),
  };
}

export function buildTemplatePlan(catalog: CatalogExercise[], ctx: GenerationContext): RoutinePlan {
  return toRoutinePlan(buildTemplateDays(catalog, ctx), templateRationale(ctx));
}
