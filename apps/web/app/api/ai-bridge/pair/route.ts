import { PairRequest } from '@stenia/ai';
import { NextResponse, type NextRequest } from 'next/server';

import { registerPairing } from '@/lib/ai-bridge';

export const dynamic = 'force-dynamic';

/** La Mac propone vincularse (hash del token + código). No da acceso hasta que el admin confirma el código. */
export async function POST(request: NextRequest) {
  const parsed = PairRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Solicitud inválida.' }, { status: 400 });
  const result = await registerPairing(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
