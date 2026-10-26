'use server';

import { unitsColumnFor } from '@stenia/core';
import { user } from '@stenia/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/session';

/** Guarda la unidad de peso de la cuenta (kg o lb). */
export async function setWeightUnitAction(raw: unknown): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const unit = z.enum(['kg', 'lb']).safeParse(raw);
  if (!unit.success) return { ok: false };
  await getDb().update(user).set({ units: unitsColumnFor(unit.data), updatedAt: new Date() }).where(eq(user.id, session.user.id));
  revalidatePath('/', 'layout');
  return { ok: true };
}
