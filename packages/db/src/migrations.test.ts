import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { EQUIPMENT_SEED, seedEquipment } from './seed/equipment';
import { createTestDb } from './testing';
import { equipment, user } from './schema/index';

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

afterAll(async () => {
  await ctx.client.close();
});

describe('migraciones', () => {
  it('crea todas las tablas del modelo de datos', async () => {
    const rows = await ctx.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    );
    const names = rows.rows.map((r) => r.table_name);
    for (const expected of [
      'user',
      'session',
      'account',
      'verification',
      'profile',
      'screening',
      'injury',
      'gym_profile',
      'gym_profile_equipment',
      'equipment',
      'exercise',
      'exercise_equipment',
      'exercise_progression',
      'exercise_media',
      'routine',
      'routine_version',
      'routine_day',
      'routine_exercise',
      'workout_session',
      'session_exercise',
      'set_log',
      'personal_record',
      'body_measurement',
      'body_photo',
      'checkin',
      'checkin_settings',
      'food',
      'nutrition_target',
      'meal_plan',
      'meal_log',
      'ai_settings',
      'ai_usage',
      'ai_prompt_log',
      'push_subscription',
    ]) {
      expect(names, `falta la tabla ${expected}`).toContain(expected);
    }
  });

  it('siembra el equipamiento de forma idempotente', async () => {
    expect(await seedEquipment(ctx.db)).toBe(EQUIPMENT_SEED.length);
    expect(await seedEquipment(ctx.db)).toBe(EQUIPMENT_SEED.length);
    const rows = await ctx.db.select().from(equipment);
    expect(rows).toHaveLength(EQUIPMENT_SEED.length);
  });

  it('asigna valores por defecto a un usuario nuevo', async () => {
    const [created] = await ctx.db
      .insert(user)
      .values({ name: 'Prueba', email: 'prueba@example.com' })
      .returning();
    expect(created?.role).toBe('user');
    expect(created?.locale).toBe('es-MX');
    expect(created?.units).toBe('metric');
    expect(created?.id).toMatch(/[0-9a-f-]{36}/);
  });
});
