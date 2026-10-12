import 'server-only';

import { and, count, eq, gte, lt } from 'drizzle-orm';
import { workoutSession } from '@stenia/db';

import { getDb } from '@/lib/db';
import { currentWeekBounds, weekdayIndex } from '@/lib/time';

export type WeekSummary = { days: boolean[]; todayIndex: number; thisWeek: number; total: number };

export async function getWeekSummary(userId: string): Promise<WeekSummary> {
  const db = getDb();
  const { start, end, todayIndex } = currentWeekBounds();
  const rows = await db
    .select({ startedAt: workoutSession.startedAt })
    .from(workoutSession)
    .where(and(eq(workoutSession.userId, userId), gte(workoutSession.startedAt, start), lt(workoutSession.startedAt, end)));
  const days = Array.from({ length: 7 }, () => false);
  for (const row of rows) days[weekdayIndex(row.startedAt)] = true;
  const [total] = await db.select({ value: count() }).from(workoutSession).where(eq(workoutSession.userId, userId));
  return { days, todayIndex, thisWeek: rows.length, total: total?.value ?? 0 };
}
