'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createPresetProfile, deleteGymProfile, saveGymProfile, setActiveGymProfile } from '@/lib/gym';
import { requireSession } from '@/lib/session';

const Meta = z
  .object({
    dumbbellMinKg: z.number().min(0).max(200).optional(),
    dumbbellMaxKg: z.number().min(0).max(200).optional(),
    dumbbellStepKg: z.number().min(0.5).max(20).optional(),
    bandResistances: z.array(z.string().max(20)).max(8).optional(),
    weightedKgAvailable: z.number().min(0).max(200).optional(),
    weightedStepKg: z.number().min(0.25).max(20).optional(),
  })
  .partial();

const SaveInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Ponle un nombre').max(60),
  kind: z.enum(['gym', 'home', 'park']),
  equipment: z.array(z.object({ slug: z.string().min(1).max(60), meta: Meta.optional() })).max(80),
});

export type ActionResult = { ok: true; id?: string } | { ok: false; message: string };

export async function saveGymProfileAction(raw: unknown): Promise<ActionResult> {
  const { user } = await requireSession();
  const parsed = SaveInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  try {
    const id = await saveGymProfile(user.id, parsed.data);
    revalidatePath('/equipo');
    return { ok: true, id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'No se pudo guardar.' };
  }
}

export async function activateGymProfileAction(id: string): Promise<ActionResult> {
  const { user } = await requireSession();
  await setActiveGymProfile(user.id, id);
  revalidatePath('/equipo');
  return { ok: true };
}

export async function deleteGymProfileAction(id: string): Promise<ActionResult> {
  const { user } = await requireSession();
  await deleteGymProfile(user.id, id);
  revalidatePath('/equipo');
  return { ok: true };
}

export async function createPresetAction(preset: 'gym' | 'home' | 'park'): Promise<ActionResult> {
  const { user } = await requireSession();
  const id = await createPresetProfile(user.id, preset);
  revalidatePath('/equipo');
  return { ok: true, id };
}
