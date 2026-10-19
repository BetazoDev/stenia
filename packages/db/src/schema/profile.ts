import { boolean, date, doublePrecision, integer, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt, id, tz, updatedAt } from './_shared';

export type HealthFlags = {
  pregnant?: boolean;
  lactating?: boolean;
  diabetes?: boolean;
  kidneyDisease?: boolean;
  eatingDisorderHistory?: boolean;
};

export type NutritionPrefs = {
  mealsPerDay?: number;
  excludedFoods?: string[];
  budget?: 'low' | 'medium' | 'high';
  cooks?: boolean;
  view?: 'grams' | 'equivalents';
};

export type NutritionLimits = {
  /** Piso de calorías diario (kcal). */
  minKcal?: number;
  /** Ritmo máximo de pérdida semanal (% del peso corporal). */
  maxWeeklyLossPct?: number;
};
import { user } from './auth';

export const sex = pgEnum('sex', ['male', 'female']);
export const goal = pgEnum('goal', ['hypertrophy', 'strength', 'fat_loss', 'recomposition', 'skills']);
export const activityLevel = pgEnum('activity_level', ['sedentary', 'light', 'moderate', 'active', 'very_active']);
export const screeningDecision = pgEnum('screening_decision', ['pending', 'accepted', 'declined']);

export const profile = pgTable('profile', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  birthDate: date('birth_date'),
  sex: sex('sex'),
  heightCm: doublePrecision('height_cm'),
  weightKg: doublePrecision('weight_kg'),
  goal: goal('goal'),
  skillGoals: jsonb('skill_goals').$type<string[]>().notNull().default([]),
  /** 0 = solo calistenia, 100 = solo gimnasio. */
  gymRatio: integer('gym_ratio').notNull().default(50),
  daysPerWeek: integer('days_per_week'),
  minutesPerSession: integer('minutes_per_session'),
  /** Días preferidos, 0 = domingo … 6 = sábado. */
  preferredDays: jsonb('preferred_days').$type<number[]>().notNull().default([]),
  trainingMonths: integer('training_months'),
  /** Nivel actual declarado en el bloque 4 (máximos de flexiones, dominadas, pesos de trabajo…). */
  currentLevel: jsonb('current_level').$type<Record<string, number>>().notNull().default({}),
  sleepHours: doublePrecision('sleep_hours'),
  stress: integer('stress'),
  activity: activityLevel('activity'),
  favoriteExercises: jsonb('favorite_exercises').$type<string[]>().notNull().default([]),
  bannedExercises: jsonb('banned_exercises').$type<string[]>().notNull().default([]),
  /** Respuestas crudas del cuestionario (Questionnaire de @stenia/core) para editarlas. */
  answers: jsonb('answers').$type<Record<string, unknown>>().notNull().default({}),
  onboardingCompletedAt: tz('onboarding_completed_at'),
  healthFlags: jsonb('health_flags').$type<HealthFlags>().notNull().default({}),
  nutritionPrefs: jsonb('nutrition_prefs').$type<NutritionPrefs>().notNull().default({}),
  nutritionLimits: jsonb('nutrition_limits').$type<NutritionLimits>().notNull().default({}),
  photosConsentAt: tz('photos_consent_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const screening = pgTable('screening', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  parqAnswers: jsonb('parq_answers').$type<Record<string, unknown>>().notNull(),
  acsmFlags: jsonb('acsm_flags').$type<Record<string, boolean>>().notNull().default({}),
  clearanceRecommended: boolean('clearance_recommended').notNull().default(false),
  /** Si hay bandera, la rutina se limita a intensidad ligera–moderada. */
  intensityCap: text('intensity_cap'),
  reasons: jsonb('reasons').$type<string[]>().notNull().default([]),
  userDecision: screeningDecision('user_decision').notNull().default('pending'),
  decidedAt: tz('decided_at'),
  createdAt: createdAt(),
});

export const injury = pgTable('injury', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  zone: text('zone').notNull(),
  movementsToAvoid: jsonb('movements_to_avoid').$type<string[]>().notNull().default([]),
  notes: text('notes'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
