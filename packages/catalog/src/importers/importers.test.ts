import { createTestDb } from '@stenia/db/testing';
import { seedEquipment } from '@stenia/db/seed';
import { exercise, exerciseEquipment, exerciseMedia, exerciseProgression } from '@stenia/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { importCalisthenics } from './calisthenics';
import { importFreeExerciseDb } from './free-exercise-db';
import { importRepDb } from './repdb';

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
  await seedEquipment(ctx.db);
});

afterAll(async () => {
  await ctx.client.close();
});

const fedRows = [
  {
    id: 'Barbell_Bench_Press_-_Medium_Grip',
    name: 'Barbell Bench Press - Medium Grip',
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders', 'triceps'],
    instructions: ['Lie back on a flat bench.', 'Lower the bar to the chest.'],
    category: 'strength',
    images: ['Barbell_Bench_Press_-_Medium_Grip/0.jpg', 'Barbell_Bench_Press_-_Medium_Grip/1.jpg'],
  },
  {
    id: 'Plank',
    name: 'Plank',
    force: 'static',
    level: 'beginner',
    mechanic: 'isolation',
    equipment: 'body only',
    primaryMuscles: ['abdominals'],
    secondaryMuscles: [],
    instructions: ['Hold the position.'],
    category: 'strength',
    images: ['Plank/0.jpg', 'Plank/1.jpg'],
  },
];

const calRows = [
  {
    id: 1,
    name: 'Wall Push-Up',
    category: 'push',
    primary_muscles: ['chest', 'anterior deltoids', 'triceps'],
    description: 'Stand facing a wall and push away.',
    progression_1: 'Wall Push-Up',
    progression_2: 'Incline Push-Up (counter height)',
    progression_3: 'Incline Push-Up (low surface)',
    links: [
      { source: 'free-exercise-db', type: 'image', url: 'https://example.com/0.jpg', license: 'public-domain' },
      { source: 'exercisedb.dev', type: 'gif', url: 'https://example.com/x.gif', license: null },
    ],
  },
];

const repRows = [
  {
    id: 'pull-up',
    name_en: 'Pull-Up',
    name_es: 'Dominada',
    category: 'strength',
    force_type: 'pull',
    mechanic: 'compound',
    difficulty: 'intermediate',
    equipment: 'pull_up_bar',
    body_part: 'back',
    primary_muscles: ['latissimus_dorsi'],
    secondary_muscles: ['biceps_brachii'],
    goals: ['strength'],
    tags: ['bodyweight', 'calisthenics'],
    is_bodyweight: true,
    instructions_en: ['Hang from the bar.'],
    instructions_es: ['Cuélgate de la barra.'],
    tips_es: ['Mantén el core firme.'],
    images: { flat: { start: 'images/flat/pull-up-start.webp', peak: 'images/flat/pull-up-peak.webp' } },
  },
];

describe('importadores de catálogo', () => {
  it('importa free-exercise-db con equipo, tipo de carga y medios', async () => {
    const summary = await importFreeExerciseDb(ctx.db, fedRows, { mirror: null });
    expect(summary.exercises).toBe(2);
    expect(summary.media).toBe(4);
    const rows = await ctx.db.select().from(exercise);
    const bench = rows.find((r) => r.slug === 'fed-barbell-bench-press-medium-grip');
    const plank = rows.find((r) => r.slug === 'fed-plank');
    expect(bench?.loadType).toBe('external');
    expect(bench?.pattern).toBe('horizontal_push');
    expect(bench?.primaryMuscles).toEqual(['chest']);
    expect(plank?.loadType).toBe('isometric');
    expect(plank?.category).toBe('calisthenics');
    const links = await ctx.db.select().from(exerciseEquipment);
    expect(links.length).toBeGreaterThanOrEqual(2); // barra + banco
  });

  it('es idempotente al repetir la importación', async () => {
    await importFreeExerciseDb(ctx.db, fedRows, { mirror: null });
    const rows = await ctx.db.select().from(exercise);
    expect(rows.filter((r) => r.source === 'free-exercise-db')).toHaveLength(2);
    const media = await ctx.db.select().from(exerciseMedia);
    expect(media.filter((m) => m.source === 'free-exercise-db')).toHaveLength(4);
  });

  it('importa calistenia creando la escalera de progresión y omitiendo GIF sin licencia', async () => {
    const summary = await importCalisthenics(ctx.db, calRows, { mirror: null });
    expect(summary.exercises).toBe(3);
    expect(summary.progressions).toBe(2);
    expect(summary.media).toBe(1);
    const edges = await ctx.db.select().from(exerciseProgression);
    expect(edges).toHaveLength(2);
    expect(edges[0]?.threshold).toEqual({ kind: 'reps', value: 12, sessions: 3 });
  });

  it('importa RepDB con textos en español revisados', async () => {
    const summary = await importRepDb(ctx.db, repRows, { mirror: null });
    expect(summary.exercises).toBe(1);
    const [row] = await ctx.db.select().from(exercise).where(undefined as never);
    expect(row).toBeDefined();
    const pullUp = (await ctx.db.select().from(exercise)).find((r) => r.slug === 'rep-pull-up');
    expect(pullUp?.nameEs).toBe('Dominada');
    expect(pullUp?.reviewed).toBe(true);
    expect(pullUp?.loadType).toBe('bodyweight');
    expect(pullUp?.pattern).toBe('vertical_pull');
    const media = await ctx.db.select().from(exerciseMedia);
    expect(media.filter((m) => m.source === 'repdb').map((m) => m.role)).toEqual(['start', 'end']);
  });
});
