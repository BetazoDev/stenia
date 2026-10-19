import { describe, expect, it } from 'vitest';

import { acsmDecision, evaluateScreening, type ParqAnswers } from './screening';

const noParq: ParqAnswers = { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false };

describe('acsmDecision', () => {
  it('sin enfermedad ni síntomas y entrenando: sin valoración y sin límite', () => {
    expect(
      acsmDecision({ exercisesRegularly: true, knownDisease: false, symptoms: false, desiredIntensity: 'vigorous' }),
    ).toMatchObject({ clearance: false, cap: 'vigorous' });
  });

  it('sin entrenar y sano: empieza ligero a moderado sin valoración', () => {
    expect(
      acsmDecision({ exercisesRegularly: false, knownDisease: false, symptoms: false, desiredIntensity: 'vigorous' }),
    ).toMatchObject({ clearance: false, cap: 'light_moderate' });
  });

  it('con síntomas siempre recomienda valoración', () => {
    expect(
      acsmDecision({ exercisesRegularly: true, knownDisease: false, symptoms: true, desiredIntensity: 'light' }),
    ).toMatchObject({ clearance: true, cap: 'light_moderate' });
  });

  it('enfermedad conocida entrenando: moderado sin valoración, vigoroso con valoración', () => {
    expect(
      acsmDecision({ exercisesRegularly: true, knownDisease: true, symptoms: false, desiredIntensity: 'moderate' }),
    ).toMatchObject({ clearance: false, cap: 'moderate' });
    expect(
      acsmDecision({ exercisesRegularly: true, knownDisease: true, symptoms: false, desiredIntensity: 'vigorous' }),
    ).toMatchObject({ clearance: true });
  });
});

describe('evaluateScreening', () => {
  const healthy = { exercisesRegularly: true, knownDisease: false, symptoms: false, desiredIntensity: 'vigorous' as const };

  it('todo "no" no pide seguimiento ni limita', () => {
    const r = evaluateScreening({ parq: noParq, acsm: healthy });
    expect(r.needsFollowUp).toBe(false);
    expect(r.clearanceRecommended).toBe(false);
    expect(r.intensityCap).toBe('vigorous');
  });

  it('un "sí" sin seguimiento contestado nunca aprueba automáticamente', () => {
    const r = evaluateScreening({ parq: { ...noParq, q6: true }, acsm: healthy });
    expect(r.needsFollowUp).toBe(true);
    expect(r.clearanceRecommended).toBe(true);
    expect(r.intensityCap).toBe('light_moderate');
  });

  it('un "sí" controlado y autorizado deja intensidad moderada', () => {
    const r = evaluateScreening({
      parq: { ...noParq, q6: true },
      followUp: { conditions: ['musculoskeletal'], controlled: true, symptomsOnExertion: false, clearedByDoctor: true },
      acsm: healthy,
    });
    expect(r.clearanceRecommended).toBe(false);
    expect(r.intensityCap).toBe('moderate');
  });

  it('dolor de pecho siempre marca bandera aunque el seguimiento sea favorable', () => {
    const r = evaluateScreening({
      parq: { ...noParq, q2: true },
      followUp: { conditions: ['cardiovascular'], controlled: true, symptomsOnExertion: false, clearedByDoctor: true },
      acsm: healthy,
    });
    expect(r.clearanceRecommended).toBe(true);
    expect(r.intensityCap).toBe('light_moderate');
    expect(r.flags.knownDisease).toBe(true);
  });
});
