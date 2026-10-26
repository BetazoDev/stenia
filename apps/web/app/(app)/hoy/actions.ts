'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireSession } from '@/lib/session';
import { closePendingSession, restartRotation, restartToday } from '@/lib/training-day';

export type RestartKind = 'day' | 'week' | 'cycle';

/** Pruebas: repetir el día, volver al primer día de la rotación o empezar el bloque desde la semana 1. */
export async function restartAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { user } = await requireSession();
  const kind = z.enum(['day', 'week', 'cycle']).safeParse(raw);
  if (!kind.success) return { ok: false, message: 'Opción no válida.' };
  if (kind.data === 'day') await restartToday(user.id);
  else await restartRotation(user.id, kind.data === 'cycle');
  revalidatePath('/hoy');
  revalidatePath('/rutina');
  return { ok: true };
}

export async function closePendingSessionAction(
  id: unknown,
  status: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { user } = await requireSession();
  const parsed = z
    .object({ id: z.string().min(1).max(64), status: z.enum(['completed', 'discarded']) })
    .safeParse({ id, status });
  if (!parsed.success) return { ok: false, message: 'Datos inválidos.' };
  await closePendingSession(user.id, parsed.data.id, parsed.data.status);
  revalidatePath('/hoy');
  return { ok: true };
}
