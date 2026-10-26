'use server';

import {
  BodyBlock,
  GoalBlock,
  InjuriesBlock,
  KnownBlock,
  LevelBlock,
  LogisticsBlock,
  RecoveryBlock,
  SafetyBlock,
  type BlockKey,
  type ScreeningResult,
} from '@stenia/core';
import { revalidatePath } from 'next/cache';
import { completeOnboarding, recordScreening, saveBlock } from '@/lib/profile';
import { requireSession } from '@/lib/session';

const SCHEMAS = {
  safety: SafetyBlock,
  body: BodyBlock,
  known: KnownBlock,
  level: LevelBlock,
  goal: GoalBlock,
  logistics: LogisticsBlock,
  injuries: InjuriesBlock,
  recovery: RecoveryBlock,
} as const;

export type ActionResult = { ok: true } | { ok: false; message: string };

const clean = (v: unknown): unknown => {
  if (v === '' || v === undefined) return null;
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
  return v;
};

export async function saveBlockAction(block: BlockKey, raw: unknown): Promise<ActionResult> {
  const { user } = await requireSession();
  const schema = SCHEMAS[block];
  if (!schema) return { ok: false, message: 'Bloque desconocido.' };
  const parsed = schema.safeParse(clean(raw ?? {}));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue ? `Revisa «${issue.path.join('.') || block}»: ${issue.message}` : 'Respuesta inválida.' };
  }
  await saveBlock(user.id, block, parsed.data as never);
  revalidatePath('/perfil');
  return { ok: true };
}

export async function recordScreeningAction(decision: 'accepted' | 'declined' | null): Promise<{ ok: true; result: ScreeningResult | null } | { ok: false; message: string }> {
  const { user } = await requireSession();
  const result = await recordScreening(user.id, decision);
  return { ok: true, result };
}

export async function finishOnboardingAction(): Promise<ActionResult> {
  const { user } = await requireSession();
  const result = await completeOnboarding(user.id);
  if (!result.ok) return { ok: false, message: `Faltan bloques obligatorios: ${result.missing.join(', ')}.` };
  revalidatePath('/hoy');
  return { ok: true };
}

