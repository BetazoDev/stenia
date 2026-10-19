import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { requireApiUser } from '@/lib/api';
import { buildExerciseContextFor } from '@/lib/session-data';

export const dynamic = 'force-dynamic';

const Query = z.object({
  exerciseId: z.string().min(1),
  dayId: z.string().nullable(),
  sets: z.coerce.number().int().min(1).max(6),
  repMin: z.coerce.number().int().min(1).max(30).nullable(),
  repMax: z.coerce.number().int().min(1).max(30).nullable(),
  targetSeconds: z.coerce.number().int().min(5).max(120).nullable(),
  rirTarget: z.coerce.number().int().min(0).max(4),
  restSeconds: z.coerce.number().int().min(30).max(300),
});

/** Contexto ("última vez", meta de hoy) de un ejercicio sustituto en plena sesión. */
export async function GET(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const p = request.nextUrl.searchParams;
  const opt = (k: string) => (p.get(k) === null || p.get(k) === '' ? null : p.get(k));
  const parsed = Query.safeParse({
    exerciseId: p.get('exerciseId'),
    dayId: opt('dayId'),
    sets: p.get('sets'),
    repMin: opt('repMin'),
    repMax: opt('repMax'),
    targetSeconds: opt('targetSeconds'),
    rirTarget: p.get('rirTarget'),
    restSeconds: p.get('restSeconds'),
  });
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Parámetros inválidos' }, { status: 400 });
  const { exerciseId, dayId, ...prescription } = parsed.data;
  const context = await buildExerciseContextFor(user.id, exerciseId, dayId, prescription);
  if (!context) return NextResponse.json({ ok: false, message: 'Ejercicio no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, context });
}
