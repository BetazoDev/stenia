import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createdAt, id, updatedAt } from './_shared';
import { user } from './auth';
import { equipment } from './equipment';

export const loadType = pgEnum('load_type', ['external', 'bodyweight', 'assisted', 'weighted_bw', 'isometric']);
export const exerciseLevel = pgEnum('exercise_level', ['beginner', 'intermediate', 'advanced']);
export const mediaType = pgEnum('media_type', ['image', 'video']);

export const exercise = pgTable(
  'exercise',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    nameEs: text('name_es').notNull(),
    nameEn: text('name_en').notNull(),
    /** Patrón de movimiento (MovementPattern en @stenia/core). */
    pattern: text('pattern').notNull().default('isolation'),
    /** gym | calisthenics | mobility | cardio */
    category: text('category').notNull().default('gym'),
    primaryMuscles: jsonb('primary_muscles').$type<string[]>().notNull().default([]),
    secondaryMuscles: jsonb('secondary_muscles').$type<string[]>().notNull().default([]),
    loadType: loadType('load_type').notNull().default('external'),
    level: exerciseLevel('level').notNull().default('beginner'),
    mechanic: text('mechanic'),
    force: text('force'),
    descriptionEs: text('description_es'),
    descriptionEn: text('description_en'),
    instructionsEs: jsonb('instructions_es').$type<string[]>().notNull().default([]),
    instructionsEn: jsonb('instructions_en').$type<string[]>().notNull().default([]),
    cuesEs: jsonb('cues_es').$type<string[]>().notNull().default([]),
    commonErrorsEs: jsonb('common_errors_es').$type<string[]>().notNull().default([]),
    /** Datos extra del origen (etiquetas, objetivos, nivel original). */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    source: text('source').notNull(),
    sourceId: text('source_id'),
    license: text('license'),
    attributionUrl: text('attribution_url'),
    /** Las traducciones hechas por LLM quedan en false hasta revisión humana. */
    reviewed: boolean('reviewed').notNull().default(false),
    active: boolean('active').notNull().default(true),
    /** ID de un video de YouTube curado a mano (se muestra con youtube-nocookie.com). */
    videoId: text('video_id'),
    /** Nombres es/en normalizados (minúsculas, sin acentos) para la búsqueda. */
    searchText: text('search_text').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('exercise_source_source_id_idx').on(t.source, t.sourceId),
    index('exercise_pattern_idx').on(t.pattern),
    index('exercise_load_type_idx').on(t.loadType),
  ],
);

export const exerciseEquipment = pgTable(
  'exercise_equipment',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    required: boolean('required').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.equipmentId] })],
);

export type ProgressionThreshold = {
  kind: 'reps' | 'seconds';
  value: number;
  sessions: number;
};

export const exerciseProgression = pgTable(
  'exercise_progression',
  {
    id: id(),
    fromExerciseId: text('from_exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    toExerciseId: text('to_exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    threshold: jsonb('threshold').$type<ProgressionThreshold>().notNull(),
    source: text('source').notNull(),
  },
  (t) => [uniqueIndex('exercise_progression_unique_idx').on(t.fromExerciseId, t.toExerciseId)],
);

export const exerciseMedia = pgTable(
  'exercise_media',
  {
    id: id(),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    type: mediaType('type').notNull(),
    /** start | end | main | video */
    role: text('role').notNull().default('main'),
    url: text('url').notNull(),
    /** Llave en el bucket público de R2 cuando el archivo está espejado. */
    storageKey: text('storage_key'),
    originUrl: text('origin_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    source: text('source').notNull(),
    license: text('license').notNull(),
    attributionUrl: text('attribution_url').notNull(),
  },
  (t) => [index('exercise_media_exercise_id_idx').on(t.exerciseId)],
);

/** Recomendación personalizada del LLM para un ejercicio (generada una vez y cacheada). */
export const exerciseTip = pgTable(
  'exercise_tip',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    model: text('model').notNull(),
    promptVersion: integer('prompt_version').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('exercise_tip_user_exercise_idx').on(t.userId, t.exerciseId)],
);
