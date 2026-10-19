import { NextResponse, type NextRequest } from 'next/server';

import { requireApiUser } from '@/lib/api';
import { buildBootstrap, routineDayIds } from '@/lib/session-data';

export const dynamic = 'force-dynamic';

/** Datos de la sesión en vivo de un día (`?dayId=`) o de todos los días de la rutina activa. */
export async function GET(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const dayId = request.nextUrl.searchParams.get('dayId');
  const ids = dayId ? [dayId] : await routineDayIds(user.id);
  const bootstraps = [];
  for (const id of ids) {
    const b = await buildBootstrap(user.id, id);
    if (b) bootstraps.push(b);
  }
  if (dayId && bootstraps.length === 0) return NextResponse.json({ ok: false, message: 'Día no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, bootstraps }, { headers: { 'cache-control': 'no-store' } });
}
