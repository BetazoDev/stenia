import { describe, expect, it } from 'vitest';

import { RoutinePlan } from './routine';

const exercise = {
  exerciseId: 'rep-push-up',
  sets: 3,
  repMin: 8,
  repMax: 12,
  targetSeconds: null,
  rirTarget: 2,
  restSeconds: 90,
};

const day = (n: number) => ({ name: `Día ${n}`, exercises: [exercise, exercise, exercise] });

describe('RoutinePlan', () => {
  it('acepta un plan válido de dos días', () => {
    const result = RoutinePlan.safeParse({ rationale: 'ok', days: [day(1), day(2)] });
    expect(result.success).toBe(true);
  });

  it('rechaza menos de 2 días o menos de 3 ejercicios por día', () => {
    expect(RoutinePlan.safeParse({ rationale: 'ok', days: [day(1)] }).success).toBe(false);
    expect(
      RoutinePlan.safeParse({ rationale: 'ok', days: [day(1), { name: 'x', exercises: [exercise] }] })
        .success,
    ).toBe(false);
  });

  it('rechaza valores fuera de rango', () => {
    const bad = { ...exercise, restSeconds: 10 };
    expect(
      RoutinePlan.safeParse({ rationale: 'ok', days: [day(1), { name: 'x', exercises: [bad, bad, bad] }] })
        .success,
    ).toBe(false);
  });
});
