import { describe, expect, it } from 'vitest';

import { formatClock, formatDurationMinutes, formatKg } from './format';

describe('formatKg', () => {
  it('omite decimales innecesarios', () => {
    expect(formatKg(60)).toBe('60 kg');
    expect(formatKg(62.5)).toBe('62.5 kg');
  });
});

describe('formatClock', () => {
  it('formatea minutos y segundos', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3599)).toBe('59:59');
  });

  it('agrega horas cuando aplica y nunca es negativo', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-10)).toBe('0:00');
  });
});

describe('formatDurationMinutes', () => {
  it('combina horas y minutos', () => {
    expect(formatDurationMinutes(45)).toBe('45 min');
    expect(formatDurationMinutes(60)).toBe('1 h');
    expect(formatDurationMinutes(95)).toBe('1 h 35 min');
  });
});
