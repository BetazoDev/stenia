import { describe, expect, it } from 'vitest';

import { FIXTURE_CATALOG } from '../routine/fixtures';
import type { RoutinePlan } from '../schemas/routine';
import { bmi, leanMassKg, navyBodyFat } from './body';
import { CheckinAnswers, applyAdjustments, changesRoutine, deterministicProposals, nextCheckinDates } from './checkins';
import { evaluatePhotoPose, type Landmark } from './pose';
import { detectTriggers, ema, isStagnant, weeklyAdherence, weeklySlope, weightOffTrend } from './trends';

const now = new Date('2026-10-19T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);

describe('fórmula de la Marina', () => {
  it('hombre: 178 cm, cintura 85, cuello 38 = 16.4% (referencia calculada aparte)', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 178, waistCm: 85, neckCm: 38 })).toBe(16.4);
  });
  it('mujer requiere cadera', () => {
    expect(navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 72, neckCm: 33 })).toBeNull();
    expect(navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 72, neckCm: 33, hipCm: 98 })).toBe(26.9);
  });
  it('rechaza medidas imposibles', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 178, waistCm: 30, neckCm: 38 })).toBeNull();
  });
  it('masa magra e IMC', () => {
    expect(leanMassKg(80, 20)).toBe(64);
    expect(bmi(80, 178)).toBe(25.2);
  });
});

describe('tendencias', () => {
  it('la EMA suaviza un pesaje atípico', () => {
    const s = ema([
      { date: '2026-10-01', value: 80 },
      { date: '2026-10-02', value: 80 },
      { date: '2026-10-03', value: 83 },
    ]);
    expect(s[2]?.value).toBeLessThan(80.5);
  });

  it('pendiente semanal por mínimos cuadrados', () => {
    const series = Array.from({ length: 14 }, (_, i) => ({ date: daysAgo(13 - i), value: 80 - i * 0.1 }));
    expect(weeklySlope(series, 14, now)).toBeCloseTo(-0.7, 1);
  });

  it('detecta peso fuera de tendencia dos semanas seguidas (pérdida de grasa que no baja)', () => {
    const rising = Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(14 - i), value: 80 + i * 0.15 }));
    expect(weightOffTrend(rising, 'fat_loss', now).off).toBe(true);
    const falling = Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(14 - i), value: 80 - i * 0.07 }));
    expect(weightOffTrend(falling, 'fat_loss', now).off).toBe(false);
  });

  it('estancamiento de 3 semanas', () => {
    const pts = [
      { date: daysAgo(40), score: 100 },
      { date: daysAgo(30), score: 105 },
      { date: daysAgo(14), score: 104 },
      { date: daysAgo(3), score: 105 },
    ];
    expect(isStagnant(pts, 3, now)).toBe(true);
    expect(isStagnant([...pts, { date: daysAgo(1), score: 107 }], 3, now)).toBe(false);
  });

  it('disparadores combinados', () => {
    const t = detectTriggers(
      { goal: 'hypertrophy', weights: [], mainLifts: [], plannedPerWeek: 4, completedThisWeek: 1, weekdayIndex: 6, efforts: [], painReported: true },
      now,
    );
    expect(t.map((x) => x.trigger).sort()).toEqual(['missed_sessions', 'pain']);
  });

  it('adherencia por semana', () => {
    const weeks = weeklyAdherence(['2026-10-13T10:00:00Z', '2026-10-15T10:00:00Z', '2026-10-19T08:00:00Z'], 4, 2, now);
    expect(weeks.map((w) => w.done)).toEqual([2, 1]);
  });
});

describe('revisiones', () => {
  it('calendario automático: ligera semanal y completa mensual', () => {
    expect(nextCheckinDates('auto', '2026-10-12', '2026-10-01', '2026-10-19')).toEqual({ light: '2026-10-19', full: '2026-10-29' });
    expect(nextCheckinDates('biweekly', null, null, '2026-10-19').light).toBeNull();
  });

  it('propuestas deterministas por fatiga, dolor y peso', () => {
    const r = deterministicProposals({
      triggers: ['pain', 'fatigue'],
      type: 'early',
      goal: 'fat_loss',
      adherencePct: 0.9,
      avgEffort: 9,
      energy: 2,
      sleep: 3,
      weightSlopePctPerWeek: 0.4,
      expectedRange: { min: -1, max: -0.25 },
      stagnantExercises: [],
      painExercises: [{ id: 'a', name: 'Press militar', alternativeId: 'b', alternativeName: 'Landmine press' }],
    });
    expect(r.adjustments.map((a) => a.kind)).toEqual(['swap_exercise', 'deload', 'calories']);
    expect(r.adjustments[2]?.kcalDelta).toBe(-150);
  });

  it('sin señales propone mantener', () => {
    const r = deterministicProposals({ triggers: [], type: 'light', goal: 'hypertrophy', adherencePct: 1, avgEffort: 7, energy: 4, sleep: 4, weightSlopePctPerWeek: 0.3, expectedRange: { min: 0.1, max: 0.5 }, stagnantExercises: [], painExercises: [] });
    expect(r.adjustments).toHaveLength(1);
    expect(r.adjustments[0]?.kind).toBe('keep');
  });

  it('aplica sustituciones y volumen a una nueva versión', () => {
    const byId = new Map(FIXTURE_CATALOG.map((e) => [e.id, e]));
    const plan: RoutinePlan = {
      rationale: 'x',
      days: [
        {
          name: 'A',
          exercises: [
            { exerciseId: 'id-bench-press', sets: 3, repMin: 6, repMax: 10, targetSeconds: null, rirTarget: 2, restSeconds: 120 },
            { exerciseId: 'id-barbell-row', sets: 3, repMin: 6, repMax: 10, targetSeconds: null, rirTarget: 2, restSeconds: 120 },
            { exerciseId: 'id-biceps-curl', sets: 3, repMin: 10, repMax: 15, targetSeconds: null, rirTarget: 1, restSeconds: 60 },
          ],
        },
      ],
    };
    const adjustments = [
      { kind: 'swap_exercise' as const, description: '', muscle: null, setsDelta: null, fromExercise: 'id-bench-press', toExercise: 'id-dumbbell-press', kcalDelta: null },
      { kind: 'volume' as const, description: '', muscle: 'accessories', setsDelta: -1, fromExercise: null, toExercise: null, kcalDelta: null },
    ];
    const next = applyAdjustments(plan, adjustments, byId);
    expect(next.days[0]?.exercises[0]?.exerciseId).toBe('id-dumbbell-press');
    expect(next.days[0]?.exercises[2]?.sets).toBe(2);
    expect(plan.days[0]?.exercises[0]?.exerciseId).toBe('id-bench-press');
    expect(changesRoutine(adjustments)).toBe(true);
  });
});

describe('pose para fotos guiadas', () => {
  const body = (opts: { shoulderSpread: number; noseVis: number; hipX?: number; ankleY?: number }): Landmark[] => {
    const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    const hip = opts.hipX ?? 0.5;
    lm[0] = { x: hip, y: 0.12, visibility: opts.noseVis };
    lm[11] = { x: hip - opts.shoulderSpread / 2, y: 0.22, visibility: 0.9 };
    lm[12] = { x: hip + opts.shoulderSpread / 2, y: 0.22, visibility: 0.9 };
    lm[15] = { x: hip - 0.2, y: 0.5, visibility: 0.9 };
    lm[16] = { x: hip + 0.2, y: 0.5, visibility: 0.9 };
    lm[23] = { x: hip - 0.06, y: 0.5, visibility: 0.9 };
    lm[24] = { x: hip + 0.06, y: 0.5, visibility: 0.9 };
    lm[27] = { x: hip - 0.05, y: opts.ankleY ?? 0.9, visibility: 0.9 };
    lm[28] = { x: hip + 0.05, y: opts.ankleY ?? 0.9, visibility: 0.9 };
    return lm;
  };

  it('acepta frente bien encuadrado', () => {
    expect(evaluatePhotoPose(body({ shoulderSpread: 0.2, noseVis: 0.95 }), 'front')).toMatchObject({ ok: true, detected: 'front' });
  });
  it('detecta espalda y perfil', () => {
    expect(evaluatePhotoPose(body({ shoulderSpread: 0.2, noseVis: 0.2 }), 'back').detected).toBe('back');
    expect(evaluatePhotoPose(body({ shoulderSpread: 0.03, noseVis: 0.9 }), 'side').detected).toBe('side');
  });
  it('pide corregir encuadre', () => {
    const r = evaluatePhotoPose(body({ shoulderSpread: 0.2, noseVis: 0.95, hipX: 0.8, ankleY: 0.99 }), 'front');
    expect(r.ok).toBe(false);
    expect(r.issues.join(' ')).toMatch(/tobillos|centro/);
  });
  it('sin persona', () => {
    expect(evaluatePhotoPose(null, 'front').ok).toBe(false);
  });
});

describe('respuestas de revisión', () => {
  it('acepta escalas 1–5 y aplica valores por defecto', () => {
    const parsed = CheckinAnswers.parse({ energy: 3, sleep: '4', effort: 5 });
    expect(parsed).toMatchObject({ energy: 3, sleep: 4, effort: 5, weightKg: null, planRating: null, notes: '', measurements: null });
  });
  it('rechaza escalas fuera de rango y pesos imposibles', () => {
    expect(CheckinAnswers.safeParse({ energy: 0, sleep: 3, effort: 3 }).success).toBe(false);
    expect(CheckinAnswers.safeParse({ energy: 3, sleep: 3, effort: 6 }).success).toBe(false);
    expect(CheckinAnswers.safeParse({ energy: 3, sleep: 3, effort: 3, weightKg: 12 }).success).toBe(false);
  });
  it('valida medidas opcionales en centímetros', () => {
    const ok = CheckinAnswers.parse({ energy: 3, sleep: 3, effort: 3, measurements: { waistCm: 82, neckCm: 38 } });
    expect(ok.measurements).toEqual({ waistCm: 82, neckCm: 38, hipCm: null, armCm: null, thighCm: null });
    expect(CheckinAnswers.safeParse({ energy: 3, sleep: 3, effort: 3, measurements: { waistCm: 900 } }).success).toBe(false);
  });
});
