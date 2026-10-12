import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Verificación para Dokploy y el runbook: responde 200 si la app y la base contestan. */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: 'ok', time: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, db: 'error', message: error instanceof Error ? error.message : 'error' },
      { status: 503 },
    );
  }
}
