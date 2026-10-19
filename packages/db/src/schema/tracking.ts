import { boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt, id, tz, updatedAt } from './_shared';
import { user } from './auth';

export const bodyFatMethod = pgEnum('body_fat_method', ['navy', 'bia', 'inbody', 'dexa', 'photo_estimate', 'manual']);
export const photoPose = pgEnum('photo_pose', ['front', 'side', 'back']);
export const checkinType = pgEnum('checkin_type', ['light', 'full', 'early']);
export const checkinMode = pgEnum('checkin_mode', ['auto', 'weekly', 'biweekly', 'monthly']);

export const bodyMeasurement = pgTable(
  'body_measurement',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    measuredAt: date('measured_at').notNull(),
    weightKg: doublePrecision('weight_kg'),
    neckCm: doublePrecision('neck_cm'),
    waistCm: doublePrecision('waist_cm'),
    hipCm: doublePrecision('hip_cm'),
    armCm: doublePrecision('arm_cm'),
    thighCm: doublePrecision('thigh_cm'),
    bodyFatPct: doublePrecision('body_fat_pct'),
    bodyFatMethod: bodyFatMethod('body_fat_method'),
    leanMassKg: doublePrecision('lean_mass_kg'),
    bmrMeasured: integer('bmr_measured'),
    source: text('source').notNull().default('manual'),
    /** Estimación aproximada (p. ej. % grasa por foto): nunca se usa para decisiones automáticas. */
    approximate: boolean('approximate').notNull().default(false),
    raw: jsonb('raw').$type<Record<string, unknown> | null>(),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [index('body_measurement_user_date_idx').on(t.userId, t.measuredAt)],
);

export const bodyPhoto = pgTable('body_photo', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  takenAt: tz('taken_at').notNull(),
  pose: photoPose('pose').notNull(),
  storageKey: text('storage_key').notNull(),
  /** r2 | db */
  storageDriver: text('storage_driver').notNull().default('db'),
  contentType: text('content_type').notNull().default('image/jpeg'),
  sizeBytes: integer('size_bytes').notNull().default(0),
  landmarks: jsonb('landmarks').$type<Record<string, unknown> | null>(),
  createdAt: createdAt(),
});

export const checkin = pgTable(
  'checkin',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: checkinType('type').notNull(),
    trigger: text('trigger'),
    scheduledFor: date('scheduled_for').notNull(),
    completedAt: tz('completed_at'),
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull().default({}),
    aiSummary: text('ai_summary'),
    proposedChanges: jsonb('proposed_changes').$type<unknown[]>().notNull().default([]),
    decision: jsonb('decision').$type<Record<string, unknown>>().notNull().default({}),
    /** Tendencias calculadas por el código al completar la revisión. */
    metrics: jsonb('metrics').$type<Record<string, unknown>>().notNull().default({}),
    dismissedAt: tz('dismissed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('checkin_user_scheduled_idx').on(t.userId, t.scheduledFor)],
);

export const checkinSettings = pgTable('checkin_settings', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  mode: checkinMode('mode').notNull().default('auto'),
  nextLightAt: date('next_light_at'),
  nextFullAt: date('next_full_at'),
  updatedAt: updatedAt(),
});
