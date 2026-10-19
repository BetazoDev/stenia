import 'server-only';

import { checkin } from '@stenia/db';
import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from './db';
import { localDateString } from './dates';

export type EarlyTrigger = 'pain' | 'stagnation' | 'weight_off_trend' | 'missed_sessions' | 'fatigue';

export const TRIGGER_LABELS_ES: Record<EarlyTrigger, string> = {
  pain: 'Dolor reportado en una serie',
  stagnation: 'Estancamiento en un ejercicio principal',
  weight_off_trend: 'Peso fuera de la tendencia objetivo',
  missed_sessions: 'Sesiones perdidas esta semana',
  fatigue: 'Esfuerzo alto con rendimiento a la baja',
};

/** Abre una revisión adelantada si no hay otra pendiente con el mismo disparador. */
export async function triggerEarlyCheckin(userId: string, trigger: EarlyTrigger, detail?: Record<string, unknown>): Promise<string | null> {
  const db = getDb();
  const [pending] = await db
    .select({ id: checkin.id })
    .from(checkin)
    .where(and(eq(checkin.userId, userId), eq(checkin.type, 'early'), eq(checkin.trigger, trigger), isNull(checkin.completedAt), isNull(checkin.dismissedAt)))
    .limit(1);
  if (pending) return pending.id;
  const [row] = await db
    .insert(checkin)
    .values({ userId, type: 'early', trigger, scheduledFor: localDateString(), answers: detail ? { detail } : {} })
    .returning({ id: checkin.id });
  return row?.id ?? null;
}
