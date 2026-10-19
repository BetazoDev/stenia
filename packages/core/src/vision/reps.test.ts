import { describe, expect, it } from 'vitest';

import { LM, type Landmark } from '../progress/pose';
import { createCounter, frameMetrics, jointAngle, repExerciseFor, stepCounter, type CounterState, type RepExercise } from './reps';

function run(exercise: RepExercise, angles: number[], extra: { chinAboveHands?: boolean } = {}): CounterState {
  let s = createCounter(exercise);
  angles.forEach((a, i) => {
    s = stepCounter(s, { angle: a, ...extra }, i * 33, { alpha: 1, confirmFrames: 2 });
  });
  return s;
}

const hold = (a: number, n = 3) => Array.from({ length: n }, () => a);
const cycle = (top: number, bottom: number) => [...hold(top), 140, 120, 100, ...hold(bottom), 110, 130, 150, ...hold(top)];

describe('ángulos', () => {
  it('calcula el ángulo en el vértice', () => {
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(90);
    expect(jointAngle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180);
  });
});

describe('conteo de repeticiones', () => {
  it('cuenta sentadillas completas', () => {
    const s = run('squat', [...cycle(175, 85), ...cycle(175, 90).slice(3), ...cycle(172, 95).slice(3)]);
    expect(s.reps).toBe(3);
    expect(s.partials).toBe(0);
  });

  it('marca la sentadilla corta como parcial y da una indicación', () => {
    const s = run('squat', [...hold(175), 150, 135, 125, 125, 125, 140, 165, ...hold(175)]);
    expect(s.reps).toBe(0);
    expect(s.partials).toBe(1);
    expect(s.cue).toMatch(/Baja más/);
  });

  it('ignora el ruido de un solo cuadro', () => {
    const s = run('pushup', [...hold(170), 85, 170, ...hold(170)]);
    expect(s.reps).toBe(0);
  });

  it('cuenta lagartijas', () => {
    const s = run('pushup', [...cycle(170, 80), ...cycle(170, 85).slice(3)]);
    expect(s.reps).toBe(2);
  });

  it('en dominada exige la barbilla sobre las manos', () => {
    expect(run('pullup', cycle(165, 60), { chinAboveHands: false }).reps).toBe(0);
    expect(run('pullup', cycle(165, 60), { chinAboveHands: true }).reps).toBe(1);
  });

  it('suaviza con media móvil', () => {
    let s = createCounter('squat');
    s = stepCounter(s, { angle: 180 });
    s = stepCounter(s, { angle: 100 }, 0, { alpha: 0.5 });
    expect(s.smoothed).toBe(140);
  });
});

describe('métricas por cuadro', () => {
  const blank = (): Landmark[] => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  it('usa el lado visible para la rodilla', () => {
    const lm = blank();
    lm[LM.rightHip] = { x: 0.5, y: 0.4, visibility: 0.9 };
    lm[LM.rightKnee] = { x: 0.5, y: 0.6, visibility: 0.9 };
    lm[LM.rightAnkle] = { x: 0.7, y: 0.6, visibility: 0.9 };
    expect(frameMetrics('squat', lm).angle).toBeCloseTo(90);
  });
  it('sin landmarks no hay ángulo', () => {
    expect(frameMetrics('pushup', null).angle).toBeNull();
  });
});

describe('ejercicios compatibles', () => {
  it('reconoce sentadilla, lagartija y dominada', () => {
    expect(repExerciseFor({ name: 'Sentadilla con peso corporal', pattern: 'squat' })).toBe('squat');
    expect(repExerciseFor({ name: 'Sentadilla búlgara', pattern: 'squat' })).toBeNull();
    expect(repExerciseFor({ name: 'Lagartija agarre cerrado', pattern: 'horizontal_push' })).toBe('pushup');
    expect(repExerciseFor({ name: 'Lagartija en pica', pattern: 'vertical_push' })).toBeNull();
    expect(repExerciseFor({ name: 'Dominada supina', pattern: 'vertical_pull' })).toBe('pullup');
    expect(repExerciseFor({ name: 'Press de banca con barra', pattern: 'horizontal_push' })).toBeNull();
  });
});
