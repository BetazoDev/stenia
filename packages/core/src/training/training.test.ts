import { describe, expect, it } from 'vitest';

import { compareSet, effectiveSetsByMuscle, sessionStats } from './compare';
import { computeTodayTarget, formatTarget, isDeloadWeek, roundToStep } from './progression';
import { bestSet, detectSetRecords, detectVolumeRecord, epley1rm } from './records';
import { adjustRest, endClock, pauseClock, restRemainingMs, resumeClock, sessionElapsedMs } from './timers';
import type { ExerciseSession, LoggedSet, Prescribed } from './types';

const set = (over: Partial<LoggedSet> = {}): LoggedSet => ({
  weightKg: null,
  assistanceKg: null,
  addedWeightKg: null,
  reps: null,
  seconds: null,
  rir: null,
  completed: true,
  ...over,
});

const session = (date: string, sets: LoggedSet[]): ExerciseSession => ({ date, exerciseId: 'x', sets });
const ext: Prescribed = { loadType: 'external', sets: 3, repMin: 8, repMax: 12, targetSeconds: null, rirTarget: 1 };

describe('progresión external', () => {
  it('sin historial arranca con el peso estimado redondeado', () => {
    const t = computeTodayTarget({ prescription: ext, history: [], initialWeightKg: 61 });
    expect(t.action).toBe('start');
    expect(t.weightKg).toBe(60);
  });

  it('doble progresión: tope del rango con RIR ≥ 1 sube el incremento mínimo', () => {
    const last = session('2026-10-10', [1, 2, 3].map(() => set({ weightKg: 60, reps: 12, rir: 1 })));
    const t = computeTodayTarget({ prescription: ext, history: [last] });
    expect(t.action).toBe('increase');
    expect(t.weightKg).toBe(62.5);
    expect(t.reason).toContain('3×12');
    expect(formatTarget(t, 'external')).toBe('62.5 kg × 8–12, RIR 1–2');
  });

  it('tope del rango con RIR 0 no sube', () => {
    const last = session('2026-10-10', [1, 2, 3].map(() => set({ weightKg: 60, reps: 12, rir: 0 })));
    expect(computeTodayTarget({ prescription: ext, history: [last] }).action).toBe('hold');
  });

  it('2 sesiones fallidas mantienen y 3 descargan 10%', () => {
    const fail = (d: string) => session(d, [set({ weightKg: 100, reps: 6 }), set({ weightKg: 100, reps: 5 }), set({ weightKg: 100, reps: 5 })]);
    const two = computeTodayTarget({ prescription: ext, history: [fail('3'), fail('2')] });
    expect(two).toMatchObject({ action: 'hold', weightKg: 100 });
    const three = computeTodayTarget({ prescription: ext, history: [fail('3'), fail('2'), fail('1')] });
    expect(three).toMatchObject({ action: 'deload', weightKg: 90 });
  });

  it('la semana de descarga baja 10%', () => {
    const last = session('1', [1, 2, 3].map(() => set({ weightKg: 80, reps: 10 })));
    expect(computeTodayTarget({ prescription: ext, history: [last], deload: true })).toMatchObject({ action: 'deload', weightKg: 72.5 });
  });
});

describe('progresión bodyweight', () => {
  const bw: Prescribed = { loadType: 'bodyweight', sets: 3, repMin: 5, repMax: 12, targetSeconds: null, rirTarget: 2 };
  const good = (d: string) => session(d, [1, 2, 3].map(() => set({ reps: 12 })));

  it('umbral en 3 sesiones seguidas pasa a la siguiente variante', () => {
    const t = computeTodayTarget({ prescription: bw, history: [good('3'), good('2'), good('1')], ladder: { previousId: 'a', nextId: 'c' } });
    expect(t).toMatchObject({ action: 'advance_variant', suggestedExerciseId: 'c' });
  });

  it('con solo 2 sesiones aún mantiene', () => {
    expect(computeTodayTarget({ prescription: bw, history: [good('2'), good('1')], ladder: { previousId: null, nextId: 'c' } }).action).toBe('hold');
  });

  it('fallo repetido regresa a la variante anterior', () => {
    const bad = (d: string) => session(d, [set({ reps: 4 }), set({ reps: 3 }), set({ reps: 3 })]);
    const t = computeTodayTarget({ prescription: bw, history: [bad('2'), bad('1')], ladder: { previousId: 'a', nextId: 'c' } });
    expect(t).toMatchObject({ action: 'regress_variant', suggestedExerciseId: 'a' });
  });

  it('en la variante final con lastre pasa a weighted_bw', () => {
    const t = computeTodayTarget({ prescription: bw, history: [good('3'), good('2'), good('1')], ladder: { previousId: 'a', nextId: null }, increments: { addedKg: 2.5 } });
    expect(t).toMatchObject({ action: 'add_weight', addedWeightKg: 2.5 });
  });
});

describe('progresión assisted, weighted_bw e isometric', () => {
  it('assisted reduce la asistencia al llegar al tope y la sube tras fallos', () => {
    const p: Prescribed = { loadType: 'assisted', sets: 3, repMin: 6, repMax: 10, targetSeconds: null, rirTarget: 2 };
    const top = session('1', [1, 2, 3].map(() => set({ assistanceKg: 20, reps: 10 })));
    expect(computeTodayTarget({ prescription: p, history: [top] })).toMatchObject({ action: 'decrease_assistance', assistanceKg: 15 });
    const bad = (d: string) => session(d, [1, 2, 3].map(() => set({ assistanceKg: 20, reps: 4 })));
    expect(computeTodayTarget({ prescription: p, history: [bad('2'), bad('1')] })).toMatchObject({ action: 'increase_assistance', assistanceKg: 25 });
  });

  it('weighted_bw suma el lastre mínimo', () => {
    const p: Prescribed = { loadType: 'weighted_bw', sets: 3, repMin: 5, repMax: 8, targetSeconds: null, rirTarget: 1 };
    const top = session('1', [1, 2, 3].map(() => set({ addedWeightKg: 10, reps: 8, rir: 1 })));
    expect(computeTodayTarget({ prescription: p, history: [top], increments: { addedKg: 1.25 } })).toMatchObject({ action: 'add_weight', addedWeightKg: 11.25 });
  });

  it('isometric suma 5 s al completar todas las series y avanza al llegar al umbral', () => {
    const p: Prescribed = { loadType: 'isometric', sets: 3, repMin: null, repMax: null, targetSeconds: 20, rirTarget: 1 };
    const done = (s: number) => session('1', [1, 2, 3].map(() => set({ seconds: s, target: { seconds: s } })));
    expect(computeTodayTarget({ prescription: p, history: [done(20)] })).toMatchObject({ action: 'add_seconds', targetSeconds: 25 });
    const t = computeTodayTarget({ prescription: p, history: [done(30)], ladder: { previousId: null, nextId: 'n', threshold: { kind: 'seconds', value: 30, sessions: 1 } } });
    expect(t).toMatchObject({ action: 'advance_variant', suggestedExerciseId: 'n' });
  });

  it('isometric con fallo repetido regresa de variante', () => {
    const p: Prescribed = { loadType: 'isometric', sets: 2, repMin: null, repMax: null, targetSeconds: 30, rirTarget: 1 };
    const bad = (d: string) => session(d, [set({ seconds: 15 }), set({ seconds: 12 })]);
    expect(computeTodayTarget({ prescription: p, history: [bad('2'), bad('1')], ladder: { previousId: 'p', nextId: null } })).toMatchObject({ action: 'regress_variant', suggestedExerciseId: 'p' });
  });

  it('descarga cada 4–8 semanas', () => {
    expect(isDeloadWeek(6, 6)).toBe(true);
    expect(isDeloadWeek(5, 6)).toBe(false);
    expect(isDeloadWeek(4, 2)).toBe(true);
    expect(roundToStep(61.3, 2.5)).toBe(62.5);
  });
});

describe('récords', () => {
  it('Epley solo hasta 12 repeticiones', () => {
    expect(epley1rm(100, 1)).toBe(100);
    expect(epley1rm(100, 10)).toBe(133.3);
    expect(epley1rm(100, 13)).toBeNull();
  });

  it('detecta peso, repeticiones con ese peso y 1RM', () => {
    const history = [set({ weightKg: 60, reps: 10 }), set({ weightKg: 62.5, reps: 6 })];
    expect(detectSetRecords(set({ weightKg: 65, reps: 8 }), history).map((r) => r.type)).toEqual(['max_weight', 'max_e1rm']);
    // 65 × 5 sube el peso máximo pero no el 1RM estimado (75.8 < 80 de 60 × 10).
    expect(detectSetRecords(set({ weightKg: 65, reps: 5 }), history).map((r) => r.type)).toEqual(['max_weight']);
    expect(detectSetRecords(set({ weightKg: 60, reps: 11 }), history).map((r) => r.type)).toContain('max_reps_at_weight');
    expect(detectSetRecords(set({ weightKg: 50, reps: 5 }), history)).toEqual([]);
  });

  it('detecta el isométrico más largo y el volumen', () => {
    expect(detectSetRecords(set({ seconds: 45 }), [set({ seconds: 40 })])).toEqual([{ type: 'longest_isometric', value: 45 }]);
    const vol = detectVolumeRecord([set({ weightKg: 50, reps: 10 })], [[set({ weightKg: 40, reps: 10 })]]);
    expect(vol).toEqual({ type: 'max_volume', value: 500 });
  });

  it('elige la mejor serie por 1RM estimado', () => {
    expect(bestSet([set({ weightKg: 60, reps: 10 }), set({ weightKg: 70, reps: 3 })])?.weightKg).toBe(60);
  });
});

describe('cronómetros desde marcas de tiempo', () => {
  it('descuenta pausas y sigue correcto tras bloquear 5 minutos', () => {
    let clock = { startedAt: 0, pausedMs: 0, pausedAt: null, endedAt: null } as const as Parameters<typeof sessionElapsedMs>[0];
    clock = pauseClock(clock, 60_000);
    expect(sessionElapsedMs(clock, 120_000)).toBe(60_000);
    clock = resumeClock(clock, 120_000);
    // Pantalla bloqueada 5 minutos sin ticks: el cálculo sigue siendo exacto.
    expect(sessionElapsedMs(clock, 120_000 + 300_000)).toBe(360_000);
    clock = endClock(clock, 500_000);
    expect(sessionElapsedMs(clock, 9_999_999)).toBe(440_000);
  });

  it('descanso con ajuste de ±15 s', () => {
    let rest = { startedAt: 0, targetSeconds: 90, adjustSeconds: 0 };
    expect(restRemainingMs(rest, 30_000)).toBe(60_000);
    rest = adjustRest(rest, 15, 30_000);
    expect(restRemainingMs(rest, 30_000)).toBe(75_000);
    rest = adjustRest(rest, -200, 30_000);
    expect(restRemainingMs(rest, 30_000)).toBe(0);
  });
});

describe('comparaciones', () => {
  it('delta por serie: verde si sube, gris si iguala, ámbar si baja', () => {
    expect(compareSet(set({ weightKg: 62.5, reps: 8 }), set({ weightKg: 60, reps: 8 }), 'external')?.direction).toBe('up');
    expect(compareSet(set({ weightKg: 60, reps: 8 }), set({ weightKg: 60, reps: 8 }), 'external')?.direction).toBe('same');
    expect(compareSet(set({ reps: 7 }), set({ reps: 9 }), 'bodyweight')?.direction).toBe('down');
    expect(compareSet(set({ assistanceKg: 10, reps: 6 }), set({ assistanceKg: 15, reps: 8 }), 'assisted')?.direction).toBe('up');
    expect(compareSet(set({ reps: 7 }), null, 'bodyweight')).toBeNull();
  });

  it('resumen de sesión y series efectivas por músculo', () => {
    const stats = sessionStats([{ ...set({ weightKg: 50, reps: 10 }), restActualSeconds: 90 }, { ...set({ weightKg: 50, reps: 8 }), restActualSeconds: 110 }], 1800);
    expect(stats).toEqual({ volumeKg: 900, durationSec: 1800, avgRestSec: 100, completedSets: 2 });
    const map = effectiveSetsByMuscle([
      { set: set({ reps: 10, rir: 2 }), primary: ['chest'], secondary: ['triceps'] },
      { set: set({ reps: 10, rir: null, completed: false }), primary: ['chest'], secondary: [] },
    ]);
    expect(map).toEqual({ chest: 1, triceps: 0.5 });
  });
});
