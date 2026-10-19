import { describe, expect, it } from 'vitest';

import { ageFromBirthDate, canGenerateRoutine, missingRequiredBlocks, splitList, trainingLevel, type Questionnaire } from './questionnaire';

const base: Questionnaire = {
  safety: {
    parq: { q1: false, q2: false, q3: false, q4: false, q5: false, q6: false, q7: false },
    acsm: { exercisesRegularly: true, knownDisease: false, symptoms: false, desiredIntensity: 'moderate' },
  },
  body: { birthDate: '1992-05-20', sex: 'male', heightCm: 178, weightKg: 80 },
  goal: { goal: 'hypertrophy', skillGoals: [], gymRatio: 60 },
  logistics: { daysPerWeek: 4, minutesPerSession: 60, preferredDays: [1, 2, 4, 5] },
};

describe('bloques obligatorios', () => {
  it('con 1, 2, 5 y 6 se puede generar', () => {
    expect(missingRequiredBlocks(base)).toEqual([]);
    expect(canGenerateRoutine(base)).toBe(true);
  });

  it('sin seguridad o logística no se puede generar', () => {
    const { safety: _s, ...rest } = base;
    expect(missingRequiredBlocks(rest)).toEqual(['safety']);
    expect(canGenerateRoutine({ ...base, logistics: undefined })).toBe(false);
  });
});

describe('utilidades', () => {
  it('calcula la edad cumplida', () => {
    expect(ageFromBirthDate('1992-05-20', new Date(Date.UTC(2026, 4, 19)))).toBe(33);
    expect(ageFromBirthDate('1992-05-20', new Date(Date.UTC(2026, 4, 20)))).toBe(34);
  });

  it('estima el nivel por meses y marcas', () => {
    expect(trainingLevel(undefined)).toBe('beginner');
    expect(trainingLevel({ trainingMonths: 12, maxPushups: null, maxPullups: null, maxDips: null, plankSeconds: null, benchKg: null, squatKg: null, rowKg: null })).toBe('intermediate');
    expect(trainingLevel({ trainingMonths: 3, maxPushups: 10, maxPullups: 14, maxDips: null, plankSeconds: null, benchKg: null, squatKg: null, rowKg: null })).toBe('advanced');
  });

  it('separa listas de texto', () => {
    expect(splitList('sentadilla búlgara, burpees; \n dominadas')).toEqual(['sentadilla búlgara', 'burpees', 'dominadas']);
  });
});
