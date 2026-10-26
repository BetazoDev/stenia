import { describe, expect, it } from 'vitest';

import { formatWeight, kgToUnit, unitToKg, weightStepIn, weightUnitFrom } from './units';

describe('unidades de peso', () => {
  it('lee la preferencia guardada', () => {
    expect(weightUnitFrom('imperial')).toBe('lb');
    expect(weightUnitFrom('metric')).toBe('kg');
    expect(weightUnitFrom(null)).toBe('kg');
  });

  it('convierte kg ↔ lb y vuelve al mismo número capturado', () => {
    expect(kgToUnit(100, 'lb')).toBe(220.5);
    expect(kgToUnit(62.5, 'kg')).toBe(62.5);
    for (const lb of [45, 135, 225, 12.5]) expect(kgToUnit(unitToKg(lb, 'lb'), 'lb')).toBe(lb);
  });

  it('formatea con la unidad elegida', () => {
    expect(formatWeight(60, 'kg')).toBe('60 kg');
    expect(formatWeight(60, 'lb')).toBe('132.3 lb');
  });

  it('usa pasos redondos en libras', () => {
    expect(weightStepIn(2.5, 'lb')).toBe(5);
    expect(weightStepIn(5, 'lb')).toBe(10);
    expect(weightStepIn(1.25, 'lb')).toBe(2.5);
    expect(weightStepIn(2.5, 'kg')).toBe(2.5);
  });
});
