import { NextResponse } from 'next/server';

import { requireApiUser } from '@/lib/api';
import { getVapidKeys } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const { publicKey } = await getVapidKeys();
  return NextResponse.json({ ok: true, publicKey });
}
