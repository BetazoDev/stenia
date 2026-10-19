'use server';

import type { CheckinMode } from '@stenia/core';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { analyzeCheckin, decideCheckin, dismissCheckin, openCheckinNow, setCheckinMode, type StoredProposal } from '@/lib/checkins';
import { requireSession } from '@/lib/session';

export type AnalyzeResult = { ok: true; summary: string; proposals: StoredProposal[]; generator: 'llm' | 'rules'; aiMessage: string | null } | { ok: false; message: string };
export type DecideResult = { ok: true; version: number | null; accepted: number } | { ok: false; message: string };

export async function analyzeCheckinAction(id: string, answers: unknown): Promise<AnalyzeResult> {
  const { user } = await requireSession();
  try {
    const result = await analyzeCheckin(user.id, z.string().min(1).parse(id), answers);
    revalidatePath(`/revision/${id}`);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: 'Revisa tus respuestas: faltan escalas por contestar.' };
    return { ok: false, message: error instanceof Error ? error.message : 'No se pudo analizar la revisión.' };
  }
}

export async function decideCheckinAction(id: string, decision: unknown): Promise<DecideResult> {
  const { user } = await requireSession();
  try {
    const result = await decideCheckin(user.id, z.string().min(1).parse(id), decision);
    revalidatePath('/revision');
    revalidatePath('/rutina');
    revalidatePath('/hoy');
    return { ok: true, version: result.version, accepted: result.accepted.length };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'No se pudo guardar la decisión.' };
  }
}

const Mode = z.enum(['auto', 'weekly', 'biweekly', 'monthly']);

export async function setCheckinModeAction(mode: CheckinMode) {
  const { user } = await requireSession();
  await setCheckinMode(user.id, Mode.parse(mode));
  revalidatePath('/revision');
}

export async function openCheckinAction(type: 'light' | 'full') {
  const { user } = await requireSession();
  const id = await openCheckinNow(user.id, z.enum(['light', 'full']).parse(type));
  redirect(`/revision/${id}`);
}

export async function dismissCheckinAction(id: string) {
  const { user } = await requireSession();
  await dismissCheckin(user.id, z.string().min(1).parse(id));
  revalidatePath('/revision');
  revalidatePath('/hoy');
  redirect('/revision');
}
