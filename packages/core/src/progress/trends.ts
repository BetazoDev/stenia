import type { Goal } from '../schemas/common';

/** Tendencias para las revisiones (sección 9.3): nunca se decide con un solo pesaje. */

export type DatedValue = { date: string; value: number };

/** Media móvil exponencial sobre valores ordenados por fecha. α≈0.1 suaviza ruido diario de agua/glucógeno. */
export function ema(values: DatedValue[], alpha = 0.1): DatedValue[] {
  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  const out: DatedValue[] = [];
  let prev: number | null = null;
  for (const v of sorted) {
    prev = prev === null ? v.value : prev + alpha * (v.value - prev);
    out.push({ date: v.date, value: Math.round(prev * 100) / 100 });
  }
  return out;
}

const dayMs = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);

/** Pendiente semanal (kg/semana) de la tendencia en los últimos `days` días, por mínimos cuadrados. */
export function weeklySlope(series: DatedValue[], days = 14, now = new Date()): number | null {
  const cutoff = now.getTime() - days * dayMs;
  const pts = series.filter((p) => toMs(p.date) >= cutoff);
  if (pts.length < 3) return null;
  const xs = pts.map((p) => (toMs(p.date) - cutoff) / dayMs);
  const ys = pts.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * ((ys[i] ?? my) - my), 0);
  const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
  if (den === 0) return 0;
  return Math.round((num / den) * 7 * 100) / 100;
}

/** Rango de cambio semanal esperado (% del peso) según el objetivo. */
export function expectedWeeklyChangePct(goal: Goal): { min: number; max: number } {
  switch (goal) {
    case 'fat_loss':
      return { min: -1, max: -0.25 };
    case 'hypertrophy':
      return { min: 0.1, max: 0.5 };
    case 'strength':
      return { min: -0.1, max: 0.4 };
    case 'recomposition':
      return { min: -0.4, max: 0.15 };
    default:
      return { min: -0.3, max: 0.3 };
  }
}

/** Peso fuera de la tendencia objetivo en dos semanas seguidas (pendientes de 7 días de cada semana). */
export function weightOffTrend(series: DatedValue[], goal: Goal, now = new Date()): { off: boolean; slopes: (number | null)[] } {
  const smoothed = ema(series);
  const lastWeek = weeklySlope(smoothed.filter((p) => toMs(p.date) > now.getTime() - 7 * dayMs), 7, now);
  const prevNow = new Date(now.getTime() - 7 * dayMs);
  const prevWeek = weeklySlope(smoothed.filter((p) => toMs(p.date) <= prevNow.getTime()), 7, prevNow);
  const ref = smoothed[smoothed.length - 1]?.value ?? 0;
  const range = expectedWeeklyChangePct(goal);
  const outside = (slope: number | null) => {
    if (slope === null || ref <= 0) return false;
    const pct = (slope / ref) * 100;
    return pct < range.min - 0.15 || pct > range.max + 0.15;
  };
  return { off: outside(lastWeek) && outside(prevWeek), slopes: [lastWeek, prevWeek] };
}

export type PerformancePoint = { date: string; score: number };

/** Estancamiento: el mejor rendimiento de las últimas `weeks` semanas no supera al de antes. */
export function isStagnant(points: PerformancePoint[], weeks = 3, now = new Date()): boolean {
  const cutoff = now.getTime() - weeks * 7 * dayMs;
  const recent = points.filter((p) => toMs(p.date) >= cutoff);
  const before = points.filter((p) => toMs(p.date) < cutoff);
  if (recent.length < 2 || before.length === 0) return false;
  return Math.max(...recent.map((p) => p.score)) <= Math.max(...before.map((p) => p.score));
}

/** Rendimiento cayendo: la media de las últimas sesiones es menor que la de las anteriores. */
export function performanceDeclining(points: PerformancePoint[], window = 3): boolean {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < window * 2) return false;
  const avg = (arr: PerformancePoint[]) => arr.reduce((a, p) => a + p.score, 0) / arr.length;
  return avg(sorted.slice(-window)) < avg(sorted.slice(-window * 2, -window)) * 0.97;
}

export type TriggerInput = {
  goal: Goal;
  weights: DatedValue[];
  /** Rendimiento por ejercicio principal (1RM estimado o repeticiones/segundos). */
  mainLifts: { exerciseId: string; points: PerformancePoint[] }[];
  plannedPerWeek: number;
  completedThisWeek: number;
  /** Día de la semana actual (0 = lunes … 6 = domingo): las sesiones perdidas solo cuentan cuando ya no hay tiempo. */
  weekdayIndex: number;
  efforts: number[];
  painReported: boolean;
};

export type DetectedTrigger = { trigger: 'stagnation' | 'weight_off_trend' | 'missed_sessions' | 'fatigue' | 'pain'; detail: string };

export function detectTriggers(input: TriggerInput, now = new Date()): DetectedTrigger[] {
  const out: DetectedTrigger[] = [];
  const stagnant = input.mainLifts.filter((l) => isStagnant(l.points, 3, now));
  if (stagnant.length > 0) out.push({ trigger: 'stagnation', detail: `${stagnant.length} ejercicio(s) principal(es) sin progreso en 3 semanas` });
  if (input.weights.length >= 6 && weightOffTrend(input.weights, input.goal, now).off) {
    out.push({ trigger: 'weight_off_trend', detail: 'El peso suavizado salió del rango esperado dos semanas seguidas' });
  }
  const remainingDays = 6 - input.weekdayIndex;
  const missed = input.plannedPerWeek - input.completedThisWeek - remainingDays;
  if (missed >= 2) out.push({ trigger: 'missed_sessions', detail: `${missed} sesiones que ya no caben esta semana` });
  const avgEffort = input.efforts.length > 0 ? input.efforts.reduce((a, b) => a + b, 0) / input.efforts.length : 0;
  if (avgEffort >= 8 && input.mainLifts.some((l) => performanceDeclining(l.points))) {
    out.push({ trigger: 'fatigue', detail: 'Esfuerzo alto con rendimiento a la baja' });
  }
  if (input.painReported) out.push({ trigger: 'pain', detail: 'Dolor reportado en una serie' });
  return out;
}

/** Adherencia por semana (sesiones completadas / planeadas). */
export function weeklyAdherence(sessionDates: string[], plannedPerWeek: number, weeks: number, now = new Date()): { weekStart: string; done: number; pct: number }[] {
  const out: { weekStart: string; done: number; pct: number }[] = [];
  const day = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const start = new Date(monday.getTime() - w * 7 * dayMs);
    const end = new Date(start.getTime() + 7 * dayMs);
    const done = sessionDates.filter((d) => {
      const t = Date.parse(d);
      return t >= start.getTime() && t < end.getTime();
    }).length;
    out.push({ weekStart: start.toISOString().slice(0, 10), done, pct: plannedPerWeek > 0 ? Math.min(1, done / plannedPerWeek) : 0 });
  }
  return out;
}
