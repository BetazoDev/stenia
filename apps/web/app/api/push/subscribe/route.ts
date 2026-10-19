import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireApiUser } from '@/lib/api';
import { removeSubscription, saveSubscription } from '@/lib/push';

export const dynamic = 'force-dynamic';

const Sub = z.object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const parsed = Sub.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Suscripción inválida' }, { status: 400 });
  await saveSubscription(user.id, parsed.data, request.headers.get('user-agent'));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (body?.endpoint) await removeSubscription(user.id, body.endpoint);
  return NextResponse.json({ ok: true });
}
