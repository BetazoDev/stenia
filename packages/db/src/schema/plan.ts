import { date, integer, jsonb, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createdAt, id, updatedAt } from './_shared';
import { user } from './auth';
import { exercise } from './catalog';
import { gymProfile } from './equipment';

export const routineStatus = pgEnum('routine_status', ['draft', 'active', 'archived']);
export const routineAuthor = pgEnum('routine_author', ['ai', 'user']);

export const routine = pgTable('routine', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  gymProfileId: text('gym_profile_id').references(() => gymProfile.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  status: routineStatus('status').notNull().default('draft'),
  currentVersionId: text('current_version_id'),
  /** Inicio del bloque actual ("Semana X de Y"). */
  startedOn: date('started_on'),
  blockWeeks: integer('block_weeks').notNull().default(8),
  /** Semana de descarga cada N semanas (4–8). */
  deloadEveryWeeks: integer('deload_every_weeks').notNull().default(6),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const routineVersion = pgTable(
  'routine_version',
  {
    id: id(),
    routineId: text('routine_id')
      .notNull()
      .references(() => routine.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    author: routineAuthor('author').notNull(),
    rationale: text('rationale'),
    /** Versión del prompt, modelo y validaciones aplicadas. */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('routine_version_unique_idx').on(t.routineId, t.version)],
);

export const routineDay = pgTable('routine_day', {
  id: id(),
  routineVersionId: text('routine_version_id')
    .notNull()
    .references(() => routineVersion.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  name: text('name').notNull(),
});

export const routineExercise = pgTable('routine_exercise', {
  id: id(),
  routineDayId: text('routine_day_id')
    .notNull()
    .references(() => routineDay.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercise.id, { onDelete: 'restrict' }),
  sortOrder: integer('sort_order').notNull(),
  sets: integer('sets').notNull(),
  repMin: integer('rep_min'),
  repMax: integer('rep_max'),
  targetSeconds: integer('target_seconds'),
  rirTarget: integer('rir_target').notNull().default(2),
  restSeconds: integer('rest_seconds').notNull().default(90),
  notes: text('notes'),
});
