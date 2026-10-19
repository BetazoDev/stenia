'use server';

import { ExerciseTip, exerciseTipPrompt } from '@stenia/ai';
import { exercise, exerciseTip, sessionExercise } from '@stenia/db';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { runAi } from '@/lib/ai';
import { getDb } from '@/lib/db';
import { invalidateCatalogCache } from '@/lib/exercises';
import { completeAnswers, getProfile, readAnswers, trainingLevel } from '@/lib/profile';
import { exerciseHistory, setText } from '@/lib/session-data';
import { isAdmin, requireSession } from '@/lib/session';

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Recomendación personalizada del LLM, generada una vez y cacheada (sección 8). */
export async function generateTipAction(exerciseId: string): Promise<ActionResult> {
  const { user } = await requireSession();
  const db = getDb();
  const [ex] = await db.select().from(exercise).where(eq(exercise.id, exerciseId)).limit(1);
  if (!ex) return { ok: false, message: 'Ejercicio no encontrado.' };
  const q = completeAnswers(readAnswers(await getProfile(user.id)));
  const history = await exerciseHistory(user.id, [ex.id], 3);
  const notes = await db
    .select({ notes: sessionExercise.notes })
    .from(sessionExercise)
    .where(and(eq(sessionExercise.userId, user.id), eq(sessionExercise.exerciseId, ex.id), isNotNull(sessionExercise.notes)))
    .orderBy(desc(sessionExercise.startedAt))
    .limit(3);
  const rendered = exerciseTipPrompt.render({
    exercise: {
      name: ex.nameEs,
      pattern: ex.pattern,
      loadType: ex.loadType,
      cues: ex.cuesEs.slice(0, 4),
      errors: ex.commonErrorsEs.slice(0, 4),
    },
    profile: { level: trainingLevel(q?.level), goal: q?.goal.goal ?? 'hypertrophy', injuries: q?.injuries?.zones ?? [] },
    recentSets: (history.get(ex.id) ?? []).flatMap((s) => s.sets.map((x) => setText(x, ex.loadType))).slice(0, 9),
    notes: notes.map((n) => n.notes).filter(Boolean).join('\n'),
  });
  const result = await runAi({
    fn: 'exercise_tip',
    userId: user.id,
    schema: ExerciseTip,
    system: rendered.system,
    prompt: rendered.prompt,
    promptId: exerciseTipPrompt.id,
    promptVersion: exerciseTipPrompt.version,
  });
  if (!result.ok) return { ok: false, message: result.message };
  await db
    .insert(exerciseTip)
    .values({ userId: user.id, exerciseId: ex.id, text: result.output.tip, model: result.modelId, promptVersion: exerciseTipPrompt.version })
    .onConflictDoUpdate({
      target: [exerciseTip.userId, exerciseTip.exerciseId],
      set: { text: result.output.tip, model: result.modelId, promptVersion: exerciseTipPrompt.version, createdAt: new Date() },
    });
  revalidatePath(`/ejercicios/${ex.slug}`);
  return { ok: true };
}

/** Extrae el ID de un enlace de YouTube o acepta el ID directo. */
function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

export async function setVideoAction(exerciseId: string, input: string): Promise<ActionResult> {
  const { user } = await requireSession();
  if (!isAdmin(user)) return { ok: false, message: 'Solo administradores.' };
  const id = input.trim() === '' ? null : youtubeId(input);
  if (input.trim() !== '' && !id) return { ok: false, message: 'Enlace de YouTube no reconocido.' };
  const [ex] = await getDb().update(exercise).set({ videoId: id, updatedAt: new Date() }).where(eq(exercise.id, exerciseId)).returning({ slug: exercise.slug });
  if (ex) revalidatePath(`/ejercicios/${ex.slug}`);
  return { ok: true };
}

export async function markReviewedAction(exerciseId: string, reviewed: boolean): Promise<ActionResult> {
  const { user } = await requireSession();
  if (!isAdmin(user)) return { ok: false, message: 'Solo administradores.' };
  const [ex] = await getDb().update(exercise).set({ reviewed, updatedAt: new Date() }).where(eq(exercise.id, exerciseId)).returning({ slug: exercise.slug });
  invalidateCatalogCache();
  if (ex) revalidatePath(`/ejercicios/${ex.slug}`);
  return { ok: true };
}
