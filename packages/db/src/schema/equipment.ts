import { boolean, integer, jsonb, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

import { createdAt, id, updatedAt } from './_shared';
import { user } from './auth';

export const equipmentCategory = pgEnum('equipment_category', [
  'machine',
  'free_weight',
  'structure',
  'space',
  'weighted',
  'other',
]);

export const equipment = pgTable('equipment', {
  id: id(),
  slug: text('slug').notNull().unique(),
  category: equipmentCategory('category').notNull(),
  nameEs: text('name_es').notNull(),
  nameEn: text('name_en').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const gymProfileKind = pgEnum('gym_profile_kind', ['gym', 'home', 'park']);

export const gymProfile = pgTable('gym_profile', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: gymProfileKind('kind').notNull().default('gym'),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type EquipmentMeta = {
  dumbbellMinKg?: number;
  dumbbellMaxKg?: number;
  dumbbellStepKg?: number;
  bandResistances?: string[];
  weightedKgAvailable?: number;
  weightedStepKg?: number;
};

export const gymProfileEquipment = pgTable(
  'gym_profile_equipment',
  {
    id: id(),
    gymProfileId: text('gym_profile_id')
      .notNull()
      .references(() => gymProfile.id, { onDelete: 'cascade' }),
    equipmentId: text('equipment_id')
      .notNull()
      .references(() => equipment.id, { onDelete: 'cascade' }),
    meta: jsonb('meta').$type<EquipmentMeta>().notNull().default({}),
  },
  (t) => [uniqueIndex('gym_profile_equipment_unique_idx').on(t.gymProfileId, t.equipmentId)],
);
