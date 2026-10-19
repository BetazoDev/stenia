import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt, id, tz, updatedAt } from './_shared';
import { user } from './auth';
import { exercise } from './catalog';
import { gymProfile } from './equipment';
import { routineDay, routineExercise, routineVersion } from './plan';

export const sessionStatus = pgEnum('session_status', ['active', 'completed', 'discarded']);

export type SessionSummary = {
  durationSec: number;
  volumeKg: number;
  completedSets: number;
  avgRestSec: number | null;
  records: { exerciseId: string; type: string; value: number }[];
  exercises: { exerciseId: string; durationSec: number; volumeKg: number; sets: number }[];
  previous?: { volumeKg: number; durationSec: number; avgRestSec: number | null } | null;
};

export type SetTargetJson = {
  weightKg?: number | null;
  assistanceKg?: number | null;
  addedWeightKg?: number | null;
  repMin?: number | null;
  repMax?: number | null;
  seconds?: number | null;
};

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
    gymProfileId: text('gym_profile_id').references(() => gymProfile.id, { onDelete: 'set null' }),
    status: sessionStatus('status').notNull().default('active'),
    startedAt: tz('started_at').notNull(),
    endedAt: tz('ended_at'),
    pausedMs: integer('paused_ms').notNull().default(0),
    pausedAt: tz('paused_at'),
    effort: integer('effort'),
    notes: text('notes'),
    summary: jsonb('summary').$type<SessionSummary | null>(),
    /** Marca del cliente para resolver la sincronización (gana la más reciente). */
    clientUpdatedAt: tz('client_updated_at'),
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
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
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
    notes: text('notes'),
    clientUpdatedAt: tz('client_updated_at'),
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
    target: jsonb('target').$type<SetTargetJson | null>(),
    startedAt: tz('started_at'),
    completedAt: tz('completed_at'),
    /** Dolor reportado en la serie: sugiere detener, sustituir y abre una revisión adelantada. */
    pain: boolean('pain').notNull().default(false),
    clientUpdatedAt: tz('client_updated_at'),
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
