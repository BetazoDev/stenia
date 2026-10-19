import { profile } from '@stenia/db';
import { isNotNull } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';

import { detectAndOpenEarlyCheckins, ensureScheduledCheckins } from '@/lib/checkins';
import { TRIGGER_LABELS_ES } from '@/lib/checkins-trigger';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { sendPush } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Tarea programada diaria (runbook, paso 8): crea las revisiones vencidas, detecta disparadores de revisión
 * adelantada y avisa por push a quien tenga suscripción.
 */
export async function GET(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: 'No autorizado' }, { status: 401 });
  }
  const users = await getDb().select({ userId: profile.userId }).from(profile).where(isNotNull(profile.onboardingCompletedAt));
  let scheduled = 0;
  let early = 0;
  let pushed = 0;
  const errors: string[] = [];
  for (const { userId } of users) {
    try {
      const created = await ensureScheduledCheckins(userId);
      const opened = await detectAndOpenEarlyCheckins(userId);
      scheduled += created.length;
      early += opened.length;
      for (const c of created) {
        pushed += await sendPush(userId, {
          title: c.type === 'full' ? 'Revisión completa' : 'Revisión semanal',
          body: 'Toma dos minutos para revisar cómo vas y ajustar el plan.',
          tag: `checkin-${c.id}`,
          url: `/revision/${c.id}`,
        });
      }
      for (const o of opened) {
        pushed += await sendPush(userId, {
          title: 'Revisión adelantada',
          body: TRIGGER_LABELS_ES[o.trigger],
          tag: `checkin-${o.id}`,
          url: `/revision/${o.id}`,
        });
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message.slice(0, 120) : 'error');
    }
  }
  return NextResponse.json({ ok: errors.length === 0, users: users.length, scheduled, early, pushed, errors: errors.length });
}
