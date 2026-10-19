import { boolean, customType, index, integer, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt, id, tz, updatedAt } from './_shared';
import { user } from './auth';

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return 'bytea';
  },
});

/** Configuración de la app generada en tiempo de ejecución (p. ej. claves VAPID), cifrada si es secreta. */
export const appConfig = pgTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  encrypted: boolean('encrypted').notNull().default(false),
  updatedAt: updatedAt(),
});

/** Tareas largas lanzadas desde la configuración de desarrollador (importaciones, traducciones). */
export const job = pgTable(
  'job',
  {
    id: id(),
    type: text('type').notNull(),
    /** running | done | error */
    status: text('status').notNull().default('running'),
    progress: integer('progress').notNull().default(0),
    total: integer('total').notNull().default(0),
    message: text('message'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    startedAt: createdAt(),
    finishedAt: tz('finished_at'),
  },
  (t) => [index('job_type_started_idx').on(t.type, t.startedAt)],
);

/**
 * Almacenamiento privado en la base cuando R2 no está configurado (fotos corporales). Solo se sirve por una ruta
 * autenticada que verifica al propietario.
 */
export const storedFile = pgTable(
  'stored_file',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull().unique(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    data: bytea('data').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('stored_file_user_idx').on(t.userId)],
);
