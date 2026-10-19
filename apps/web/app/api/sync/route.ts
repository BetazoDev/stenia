import { NextResponse, type NextRequest } from 'next/server';

import { requireApiUser } from '@/lib/api';
import { applySync, SyncPayload } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const parsed = SyncPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Datos de sincronización inválidos', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  return NextResponse.json(await applySync(user.id, parsed.data));
}
