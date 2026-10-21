import { BridgeResult } from '@stenia/ai';
import { NextResponse, type NextRequest } from 'next/server';

import { finishRequest, verifyBridgeAuth } from '@/lib/ai-bridge';

export const dynamic = 'force-dynamic';

/** La Mac devuelve el resultado de una petición; el servidor lo valida con el esquema zod al recibirlo. */
export async function POST(request: NextRequest) {
  if (!(await verifyBridgeAuth(request.headers.get('authorization')))) {
    return NextResponse.json({ ok: false, message: 'Mac no vinculada.' }, { status: 401 });
  }
  const parsed = BridgeResult.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Resultado inválido.' }, { status: 400 });
  await finishRequest(parsed.data);
  return NextResponse.json({ ok: true });
}
