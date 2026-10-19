import { date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { boolean } from 'drizzle-orm/pg-core';

import { createdAt, id } from './_shared';
import { user } from './auth';

export const foodSource = pgEnum('food_source', ['usda', 'incmnsz', 'off', 'custom']);

export type FoodPortion = { label: string; grams: number };

/** Los productos de Open Food Facts (`source = 'off'`) no se exportan mezclados con el resto (ODbL). */
export const food = pgTable(
  'food',
  {
    id: id(),
    source: foodSource('source').notNull(),
    sourceId: text('source_id'),
    nameEs: text('name_es').notNull(),
    nameEn: text('name_en'),
    brand: text('brand'),
    barcode: text('barcode'),
    kcal: doublePrecision('kcal').notNull(),
    proteinG: doublePrecision('protein_g').notNull(),
    carbsG: doublePrecision('carbs_g').notNull(),
    fatG: doublePrecision('fat_g').notNull(),
    fiberG: doublePrecision('fiber_g'),
    portions: jsonb('portions').$type<FoodPortion[]>().notNull().default([]),
    /** Grupo del sistema de equivalentes (protein, cereal, fruit, vegetable, fat, dairy, legume, sugar, free). */
    groupCode: text('group_code'),
    /** Nombres normalizados (minúsculas, sin acentos) para la búsqueda. */
    searchText: text('search_text').notNull().default(''),
    /** La traducción al español fue revisada por una persona. */
    nameReviewed: boolean('name_reviewed').notNull().default(false),
    license: text('license'),
    attributionUrl: text('attribution_url'),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('food_source_source_id_idx').on(t.source, t.sourceId),
    index('food_barcode_idx').on(t.barcode),
  ],
);

export const nutritionTarget = pgTable('nutrition_target', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  effectiveFrom: date('effective_from').notNull(),
  kcal: integer('kcal').notNull(),
  proteinG: integer('protein_g').notNull(),
  carbsG: integer('carbs_g').notNull(),
  fatG: integer('fat_g').notNull(),
  method: text('method').notNull(),
  rationale: text('rationale'),
  createdAt: createdAt(),
});

export const mealPlan = pgTable('meal_plan', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  plan: jsonb('plan').$type<Record<string, unknown>>().notNull(),
  version: integer('version').notNull().default(1),
  /** active | archived */
  status: text('status').notNull().default('active'),
  targetId: text('target_id'),
  createdAt: createdAt(),
});

export const mealLog = pgTable(
  'meal_log',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    meal: text('meal').notNull(),
    foodId: text('food_id')
      .notNull()
      .references(() => food.id, { onDelete: 'restrict' }),
    grams: doublePrecision('grams').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('meal_log_user_date_idx').on(t.userId, t.date)],
);

export const foodFavorite = pgTable(
  'food_favorite',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    foodId: text('food_id')
      .notNull()
      .references(() => food.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.foodId] })],
);

export type SavedMealItem = { foodId: string; grams: number };

export const savedMeal = pgTable('saved_meal', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  items: jsonb('items').$type<SavedMealItem[]>().notNull().default([]),
  createdAt: createdAt(),
});
