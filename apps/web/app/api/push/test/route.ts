import { NextResponse } from 'next/server';

import { requireApiUser } from '@/lib/api';
import { sendPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const sent = await sendPush(user.id, { title: 'Stenia', body: 'Las notificaciones funcionan.', tag: 'test', url: '/configuracion' });
  return NextResponse.json({ ok: sent > 0, sent });
}
