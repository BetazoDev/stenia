import { boolean, customType, index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

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

/**
 * Cola del puente de IA: peticiones que el servidor no resuelve solo y que contesta la Mac del usuario con su
 * suscripción de Claude. El `payload` (prompt e imágenes) se borra al terminar; las filas viejas se eliminan.
 */
export const aiBridgeRequest = pgTable(
  'ai_bridge_request',
  {
    id: id(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    fn: text('fn').notNull(),
    modelId: text('model_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** pending | running | done | error | expired */
    status: text('status').notNull().default('pending'),
    output: jsonb('output').$type<unknown>(),
    error: text('error'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    latencyMs: integer('latency_ms'),
    createdAt: createdAt(),
    claimedAt: tz('claimed_at'),
    finishedAt: tz('finished_at'),
  },
  (t) => [index('ai_bridge_request_status_idx').on(t.status, t.createdAt)],
);
