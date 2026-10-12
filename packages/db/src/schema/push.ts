import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';

import { createdAt, id } from './_shared';
import { user } from './auth';

export const pushSubscription = pgTable('push_subscription', {
  id: id(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  keys: jsonb('keys').$type<{ p256dh: string; auth: string }>().notNull(),
  userAgent: text('user_agent'),
  createdAt: createdAt(),
});
