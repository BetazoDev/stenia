#!/usr/bin/env bun
/**
 * Vista previa de la plantilla determinista contra el catálogo real (herramienta de desarrollo).
 * Uso: bun run scripts/preview-routine.ts [--days=4] [--minutes=60] [--preset=gym|home|park] [--goal=hypertrophy] [--ratio=60] [--level=intermediate]
 */
import { parseArgs } from 'node:util';

import { loadCatalogExercises } from '@stenia/catalog';
import { buildTemplateDays, filterCatalog, validateRoutinePlan, buildTemplatePlan, type GenerationContext, type Goal } from '@stenia/core';

import { openDb } from './lib/db';

const PRESETS: Record<string, string[]> = {
  gym: ['leg_press', 'hack_squat', 'leg_extension', 'leg_curl', 'hip_adductor_abductor', 'cable_high', 'cable_low', 'cable_crossover', 'lat_pulldown', 'seated_row', 'chest_press_machine', 'pec_deck', 'smith_machine', 'calf_machine', 'assisted_dip_pullup_machine', 'machine_generic', 'dumbbells', 'barbell', 'ez_bar', 'plates', 'kettlebells', 'bench_flat', 'bench_incline', 'rack', 'pull_up_bar', 'parallel_bars', 'dip_station', 'bands', 'floor_space', 'jump_space', 'dip_belt'],
  home: ['dumbbells', 'bench_flat', 'bands', 'pull_up_bar', 'floor_space', 'wall_handstand'],
  park: ['pull_up_bar', 'parallel_bars', 'dip_station', 'wall_bars', 'floor_space', 'jump_space', 'wall_handstand'],
};

const { values } = parseArgs({
  options: {
    days: { type: 'string', default: '4' },
    minutes: { type: 'string', default: '60' },
    preset: { type: 'string', default: 'gym' },
    goal: { type: 'string', default: 'hypertrophy' },
    ratio: { type: 'string', default: '60' },
    level: { type: 'string', default: 'intermediate' },
    skills: { type: 'string', default: '' },
  },
});

const ctx: GenerationContext = {
  goal: values.goal as Goal,
  level: values.level as GenerationContext['level'],
  daysPerWeek: Number(values.days),
  minutesPerSession: Number(values.minutes),
  gymRatio: Number(values.ratio),
  skillGoals: (values.skills ? values.skills.split(',') : []) as GenerationContext['skillGoals'],
  intensityCap: 'vigorous',
  injuryZones: [],
  painfulMovements: '',
  banned: [],
  favorites: [],
  availableEquipment: PRESETS[values.preset ?? 'gym'] ?? [],
};

const { db, pool } = openDb();
try {
  const catalog = await loadCatalogExercises(db);
  const allowed = filterCatalog(catalog, ctx);
  console.info(`Catálogo: ${catalog.length} · permitidos: ${allowed.length}`);
  for (const day of buildTemplateDays(catalog, ctx)) {
    console.info(`\n${day.name}`);
    for (const [i, e] of day.exercises.entries()) {
      const p = e.prescription;
      const dose = p.targetSeconds ? `${p.sets}×${p.targetSeconds}s` : `${p.sets}×${p.repMin}–${p.repMax}`;
      console.info(`  ${String(i + 1).padStart(2, '0')} [${e.slot.role}] ${e.exercise.nameEs} · ${e.exercise.loadType} · ${dose} · RIR ${p.rirTarget} · ${p.restSeconds}s · ${e.exercise.source} · ${e.exercise.equipment.join('+') || 'sin equipo'}`);
    }
  }
  const plan = buildTemplatePlan(catalog, ctx);
  const v = validateRoutinePlan(plan, { ctx, catalogById: new Map(catalog.map((e) => [e.id, e])), allowedIds: new Set(allowed.map((e) => e.id)) });
  console.info(`\nValidación: ${v.ok ? 'OK' : 'ERRORES'} · minutos/día ${v.minutesPerDay.join(', ')}`);
  for (const e of [...v.errors, ...v.warnings]) console.info(`  - ${e}`);
} finally {
  await pool.end();
}
