import { describe, expect, it } from 'vitest';

import { RoutinePlan } from '../schemas/routine';
import { alternativesFor, exclusionReason, filterCatalog } from './catalog';
import { FIXTURE_CATALOG, fixtureContext } from './fixtures';
import { dayNames, estimateSessionMinutes, prescribe, splitFor } from './rules';
import { buildTemplatePlan, InsufficientCatalogError } from './template';
import { validateRoutinePlan } from './validate';

const byId = new Map(FIXTURE_CATALOG.map((e) => [e.id, e]));
const allowed = (ctx = fixtureContext()) => new Set(filterCatalog(FIXTURE_CATALOG, ctx).map((e) => e.id));

describe('split', () => {
  it('sigue la regla por días', () => {
    expect(splitFor(2, 'intermediate', 'hypertrophy').days).toEqual(['full_a', 'full_b']);
    expect(splitFor(3, 'beginner', 'hypertrophy').key).toBe('full_body_3');
    expect(splitFor(3, 'intermediate', 'strength').key).toBe('ppl_3');
    expect(splitFor(4, 'advanced', 'strength').days).toEqual(['upper', 'lower', 'upper', 'lower']);
    expect(splitFor(6, 'advanced', 'hypertrophy').days).toHaveLength(6);
  });

  it('numera días repetidos', () => {
    expect(dayNames(['upper', 'lower', 'upper', 'lower'])).toEqual(['Torso A', 'Pierna A', 'Torso B', 'Pierna B']);
    expect(dayNames(['full_a', 'full_b'])).toEqual(['Cuerpo completo A', 'Cuerpo completo B']);
  });
});

describe('prescripción', () => {
  it('fuerza usa 3–6 repeticiones y descanso largo en compuestos', () => {
    const p = prescribe({ role: 'main', loadType: 'external', goal: 'strength', level: 'intermediate', intensityCap: 'vigorous' });
    expect([p.repMin, p.repMax]).toEqual([3, 6]);
    expect(p.restSeconds).toBe(180);
  });

  it('hipertrofia usa 6–15 y accesorios con descanso corto', () => {
    const main = prescribe({ role: 'main', loadType: 'external', goal: 'hypertrophy', level: 'intermediate', intensityCap: 'vigorous' });
    const acc = prescribe({ role: 'accessory', loadType: 'external', goal: 'hypertrophy', level: 'intermediate', intensityCap: 'vigorous' });
    expect(main.repMin).toBeGreaterThanOrEqual(6);
    expect(acc.repMax).toBeLessThanOrEqual(15);
    expect(acc.restSeconds).toBeLessThanOrEqual(90);
  });

  it('isométricos usan segundos y no repeticiones', () => {
    const p = prescribe({ role: 'core', loadType: 'isometric', goal: 'hypertrophy', level: 'beginner', intensityCap: 'vigorous' });
    expect(p.targetSeconds).toBeGreaterThan(0);
    expect(p.repMin).toBeNull();
  });

  it('el tope ligero–moderado sube el RIR y evita series muy pesadas', () => {
    const p = prescribe({ role: 'main', loadType: 'external', goal: 'strength', level: 'advanced', intensityCap: 'light_moderate' });
    expect(p.rirTarget).toBeGreaterThanOrEqual(3);
    expect(p.repMin).toBeGreaterThanOrEqual(8);
  });
});

describe('filtro del catálogo', () => {
  it('excluye ejercicios sin el equipo disponible', () => {
    const ctx = fixtureContext({ availableEquipment: ['dumbbells', 'bench_flat'] });
    const bench = FIXTURE_CATALOG.find((e) => e.slug === 'bench-press');
    expect(bench && exclusionReason(bench, ctx)).toBe('equipment');
    expect(filterCatalog(FIXTURE_CATALOG, ctx).every((e) => e.equipment.every((q) => ctx.availableEquipment.includes(q)))).toBe(true);
  });

  it('excluye por lesión de hombro y por vetados', () => {
    const ctx = fixtureContext({ injuryZones: ['shoulder'], banned: ['hip thrust'] });
    const names = filterCatalog(FIXTURE_CATALOG, ctx).map((e) => e.slug);
    expect(names).not.toContain('overhead-press');
    expect(names).not.toContain('dips');
    expect(names).not.toContain('hip-thrust');
  });

  it('nunca incluye cardio en la rutina de fuerza', () => {
    expect(filterCatalog(FIXTURE_CATALOG, fixtureContext()).map((e) => e.slug)).not.toContain('jumping-jack');
  });

  it('ofrece sustitutos del mismo patrón sin el equipo ocupado', () => {
    const bench = FIXTURE_CATALOG.find((e) => e.slug === 'bench-press');
    if (!bench) throw new Error('fixture');
    const alts = alternativesFor(bench, FIXTURE_CATALOG, fixtureContext(), { unavailableEquipment: ['barbell'] });
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => a.pattern === 'horizontal_push' && !a.equipment.includes('barbell'))).toBe(true);
  });
});

describe('plantilla de respaldo', () => {
  for (const days of [2, 3, 4, 5, 6]) {
    it(`genera una rutina válida de ${days} días`, () => {
      const ctx = fixtureContext({ daysPerWeek: days });
      const plan = buildTemplatePlan(FIXTURE_CATALOG, ctx);
      expect(RoutinePlan.safeParse(plan).success).toBe(true);
      const result = validateRoutinePlan(plan, { ctx, catalogById: byId, allowedIds: allowed(ctx) });
      expect(result.errors).toEqual([]);
      expect(result.minutesPerDay.every((m) => m <= ctx.minutesPerSession * 1.05)).toBe(true);
    });
  }

  it('respeta sesiones cortas', () => {
    const ctx = fixtureContext({ minutesPerSession: 30 });
    const plan = buildTemplatePlan(FIXTURE_CATALOG, ctx);
    const result = validateRoutinePlan(plan, { ctx, catalogById: byId, allowedIds: allowed(ctx) });
    expect(result.ok).toBe(true);
    expect(plan.days.every((d) => d.exercises.length >= 3)).toBe(true);
  });

  it('funciona solo con peso corporal (parque)', () => {
    const ctx = fixtureContext({ availableEquipment: ['pull_up_bar', 'parallel_bars'], gymRatio: 0 });
    const plan = buildTemplatePlan(FIXTURE_CATALOG, ctx);
    const used = plan.days.flatMap((d) => d.exercises.map((e) => byId.get(e.exerciseId)));
    expect(used.every((e) => e && e.loadType !== 'external')).toBe(true);
  });

  it('incluye la habilidad elegida', () => {
    const ctx = fixtureContext({ daysPerWeek: 3, level: 'intermediate', skillGoals: ['handstand'] });
    const plan = buildTemplatePlan(FIXTURE_CATALOG, ctx);
    expect(plan.days.some((d) => d.exercises.some((e) => e.exerciseId === 'id-handstand-hold'))).toBe(true);
  });

  it('falla de forma explícita si no hay catálogo compatible', () => {
    expect(() => buildTemplatePlan(FIXTURE_CATALOG.slice(0, 2), fixtureContext({ availableEquipment: [] }))).toThrow(InsufficientCatalogError);
  });
});

describe('validación', () => {
  const ctx = fixtureContext({ daysPerWeek: 2 });
  const good = buildTemplatePlan(FIXTURE_CATALOG, ctx);

  it('rechaza IDs inventados', () => {
    const bad = structuredClone(good);
    bad.days[0]!.exercises[0]!.exerciseId = 'inventado';
    const r = validateRoutinePlan(bad, { ctx, catalogById: byId, allowedIds: allowed(ctx) });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('inventado');
  });

  it('rechaza sesiones demasiado largas', () => {
    const bad = structuredClone(good);
    for (const e of bad.days[0]!.exercises) {
      e.sets = 6;
      e.restSeconds = 300;
    }
    const r = validateRoutinePlan(bad, { ctx, catalogById: byId, allowedIds: allowed(ctx) });
    expect(r.errors.some((e) => e.includes('min'))).toBe(true);
  });

  it('rechaza RIR por debajo del tope de salud', () => {
    const capped = fixtureContext({ daysPerWeek: 2, intensityCap: 'light_moderate' });
    const bad = structuredClone(good);
    bad.days[0]!.exercises[0]!.rirTarget = 0;
    const r = validateRoutinePlan(bad, { ctx: capped, catalogById: byId, allowedIds: allowed(capped) });
    expect(r.errors.some((e) => e.includes('RIR'))).toBe(true);
  });

  it('rechaza el formato incorrecto y número de días distinto', () => {
    expect(validateRoutinePlan({ days: [] }, { ctx, catalogById: byId, allowedIds: allowed(ctx) }).ok).toBe(false);
    const three = fixtureContext({ daysPerWeek: 3 });
    expect(validateRoutinePlan(good, { ctx: three, catalogById: byId, allowedIds: allowed(three) }).errors[0]).toContain('3 días');
  });

  it('estima la duración de una sesión', () => {
    expect(estimateSessionMinutes([{ sets: 3, repMin: 8, repMax: 12, targetSeconds: null, rirTarget: 2, restSeconds: 120 }])).toBeGreaterThan(5);
  });
});
