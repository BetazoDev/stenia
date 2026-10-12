import { boolean, doublePrecision, index, integer, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt, id, tz, updatedAt } from './_shared';
import { user } from './auth';
import { exercise } from './catalog';
import { routineDay, routineExercise, routineVersion } from './plan';

/** Sesión de entrenamiento (en el PRD `session`; renombrada porque Better Auth usa `session`). */
export const workoutSession = pgTable(
  'workout_session',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    routineVersionId: text('routine_version_id').references(() => routineVersion.id, { onDelete: 'set null' }),
    routineDayId: text('routine_day_id').references(() => routineDay.id, { onDelete: 'set null' }),
    startedAt: tz('started_at').notNull(),
    endedAt: tz('ended_at'),
    pausedMs: integer('paused_ms').notNull().default(0),
    effort: integer('effort'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('workout_session_user_started_idx').on(t.userId, t.startedAt)],
);

export const sessionExercise = pgTable(
  'session_exercise',
  {
    id: id(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSession.id, { onDelete: 'cascade' }),
    routineExerciseId: text('routine_exercise_id').references(() => routineExercise.id, { onDelete: 'set null' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
    startedAt: tz('started_at'),
    endedAt: tz('ended_at'),
    substitutedFromExerciseId: text('substituted_from_exercise_id').references(() => exercise.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [index('session_exercise_session_id_idx').on(t.sessionId)],
);

export const setLog = pgTable(
  'set_log',
  {
    id: id(),
    sessionExerciseId: text('session_exercise_id')
      .notNull()
      .references(() => sessionExercise.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    weightKg: doublePrecision('weight_kg'),
    assistanceKg: doublePrecision('assistance_kg'),
    addedWeightKg: doublePrecision('added_weight_kg'),
    reps: integer('reps'),
    seconds: integer('seconds'),
    rir: integer('rir'),
    completedAt: tz('completed_at'),
    restActualSeconds: integer('rest_actual_seconds'),
    restTargetSeconds: integer('rest_target_seconds'),
    isRecord: boolean('is_record').notNull().default(false),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [
    index('set_log_session_exercise_idx').on(t.sessionExerciseId),
    index('set_log_user_completed_idx').on(t.userId, t.completedAt),
  ],
);

export const prType = pgEnum('pr_type', [
  'max_weight',
  'max_reps_at_weight',
  'max_e1rm',
  'max_volume',
  'longest_isometric',
  'new_variant',
]);

export const personalRecord = pgTable(
  'personal_record',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    type: prType('type').notNull(),
    value: doublePrecision('value').notNull(),
    setLogId: text('set_log_id').references(() => setLog.id, { onDelete: 'set null' }),
    achievedAt: tz('achieved_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('personal_record_user_exercise_idx').on(t.userId, t.exerciseId)],
);
