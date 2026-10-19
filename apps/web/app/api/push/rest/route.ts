import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireApiUser } from '@/lib/api';
import { scheduleRestPush } from '@/lib/push';

export const dynamic = 'force-dynamic';

const Body = z.object({ endsAt: z.number().int().positive(), body: z.string().max(140) });

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  scheduleRestPush(user.id, parsed.data.endsAt, parsed.data.body);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  scheduleRestPush(user.id, null, '');
  return NextResponse.json({ ok: true });
}
