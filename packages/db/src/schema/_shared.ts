import { text, timestamp } from 'drizzle-orm/pg-core';

/** Identificadores de texto generados en la aplicación (también en el cliente para sincronización offline). */
export const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => globalThis.crypto.randomUUID());

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

export const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
