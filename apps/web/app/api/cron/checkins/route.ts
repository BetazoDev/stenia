import { isNull, lte, or } from 'drizzle-orm';
import { checkinSettings } from '@stenia/db';
import { NextResponse, type NextRequest } from 'next/server';

import { getDb } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Tarea programada diaria (runbook, paso 8). Por ahora cuenta las revisiones vencidas;
 * las notificaciones push se conectan en la Fase 2.
 */
export async function GET(request: NextRequest) {
  const secret = env().CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: 'No autorizado' }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const due = await getDb()
    .select({ userId: checkinSettings.userId })
    .from(checkinSettings)
    .where(
      or(lte(checkinSettings.nextLightAt, today), lte(checkinSettings.nextFullAt, today), isNull(checkinSettings.nextLightAt)),
    );
  return NextResponse.json({ ok: true, due: due.length, date: today });
}
