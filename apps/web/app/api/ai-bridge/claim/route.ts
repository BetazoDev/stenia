import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { claimNext, verifyBridgeAuth } from '@/lib/ai-bridge';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** La Mac pide trabajo (espera hasta 25 s). 204 si no hay nada; 401 si no está vinculada. */
export async function POST(request: NextRequest) {
  if (!(await verifyBridgeAuth(request.headers.get('authorization')))) {
    return NextResponse.json({ ok: false, message: 'Mac no vinculada.' }, { status: 401 });
  }
  const body = z
    .object({ worker: z.string().max(80).default('Mac'), waitMs: z.number().int().min(0).max(25_000).optional() })
    .safeParse(await request.json().catch(() => ({})));
  const job = await claimNext(body.success ? body.data.worker : 'Mac', body.success ? body.data.waitMs : undefined);
  if (!job) return new NextResponse(null, { status: 204 });
  return NextResponse.json(job, { headers: { 'cache-control': 'no-store' } });
}
