import 'server-only';

import {
  CompleteQuestionnaire,
  evaluateScreening,
  missingRequiredBlocks,
  Questionnaire,
  splitList,
  trainingLevel,
  type BlockKey,
  type ScreeningResult,
} from '@stenia/core';
import { injury, profile, screening } from '@stenia/db';
import { and, desc, eq } from 'drizzle-orm';

import { getDb } from './db';

export type ProfileRow = typeof profile.$inferSelect;

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const [row] = await getDb().select().from(profile).where(eq(profile.userId, userId)).limit(1);
  return row ?? null;
}

export async function ensureProfile(userId: string): Promise<ProfileRow> {
  const existing = await getProfile(userId);
  if (existing) return existing;
  const [created] = await getDb().insert(profile).values({ userId }).onConflictDoNothing().returning();
  return created ?? ((await getProfile(userId)) as ProfileRow);
}

/** Respuestas guardadas (pueden estar incompletas mientras se contesta el cuestionario). */
export function readAnswers(row: ProfileRow | null): Questionnaire {
  const parsed = Questionnaire.safeParse(row?.answers ?? {});
  if (parsed.success) return parsed.data;
  // Conserva los bloques válidos aunque otros estén a medias.
  const raw = (row?.answers ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const one = Questionnaire.safeParse({ [key]: value });
    if (one.success) out[key] = (one.data as Record<string, unknown>)[key];
  }
  return out as Questionnaire;
}

/** Copia campos del cuestionario a columnas de `profile` para consultas y cálculos. */
function denormalize(q: Questionnaire): Partial<typeof profile.$inferInsert> {
  return {
    birthDate: q.body?.birthDate ?? null,
    sex: q.body?.sex ?? null,
    heightCm: q.body?.heightCm ?? null,
    weightKg: q.body?.weightKg ?? null,
    goal: q.goal?.goal ?? null,
    skillGoals: q.goal?.skillGoals ?? [],
    gymRatio: q.goal?.gymRatio ?? 50,
    daysPerWeek: q.logistics?.daysPerWeek ?? null,
    minutesPerSession: q.logistics?.minutesPerSession ?? null,
    preferredDays: q.logistics?.preferredDays ?? [],
    trainingMonths: q.level?.trainingMonths ?? null,
    currentLevel: Object.fromEntries(
      Object.entries(q.level ?? {}).filter((e): e is [string, number] => typeof e[1] === 'number'),
    ),
    sleepHours: q.recovery?.sleepHours ?? null,
    stress: q.recovery?.stress ?? null,
    activity: q.recovery?.activity ?? null,
    favoriteExercises: splitList(q.recovery?.favorites),
    bannedExercises: splitList(q.recovery?.banned),
  };
}

/** Guarda un bloque del cuestionario (validado) y sincroniza columnas, lesiones y cribado. */
export async function saveBlock<K extends BlockKey>(userId: string, key: K, value: Questionnaire[K]): Promise<Questionnaire> {
  const db = getDb();
  const row = await ensureProfile(userId);
  const answers = { ...readAnswers(row), [key]: value } as Questionnaire;
  const parsed = Questionnaire.parse(answers);
  await db
    .update(profile)
    .set({ answers: parsed as Record<string, unknown>, ...denormalize(parsed), updatedAt: new Date() })
    .where(eq(profile.userId, userId));

  if (key === 'injuries' && parsed.injuries) {
    await db.update(injury).set({ active: false, updatedAt: new Date() }).where(and(eq(injury.userId, userId), eq(injury.active, true)));
    const avoid = splitList(parsed.injuries.painfulMovements);
    if (parsed.injuries.zones.length > 0) {
      await db.insert(injury).values(
        parsed.injuries.zones.map((zone) => ({
          userId,
          zone,
          movementsToAvoid: avoid,
          notes: parsed.injuries?.surgeries || null,
          active: true,
        })),
      );
    }
  }
  return parsed;
}

export type ScreeningDecision = 'accepted' | 'declined';

/** Evalúa y registra el cribado PAR-Q+/ACSM. Todo "sí" deja registro en `screening`. */
export async function recordScreening(userId: string, decision: ScreeningDecision | null): Promise<ScreeningResult | null> {
  const row = await getProfile(userId);
  const q = readAnswers(row);
  if (!q.safety) return null;
  const result = evaluateScreening(q.safety);
  await getDb()
    .insert(screening)
    .values({
      userId,
      parqAnswers: { parq: q.safety.parq, followUp: q.safety.followUp ?? null, acsm: q.safety.acsm },
      acsmFlags: result.flags,
      clearanceRecommended: result.clearanceRecommended,
      intensityCap: result.intensityCap,
      reasons: result.reasons,
      userDecision: decision ?? (result.clearanceRecommended ? 'pending' : 'accepted'),
      decidedAt: decision ? new Date() : null,
    });
  return result;
}

export async function latestScreening(userId: string) {
  const [row] = await getDb().select().from(screening).where(eq(screening.userId, userId)).orderBy(desc(screening.createdAt)).limit(1);
  return row ?? null;
}

export async function completeOnboarding(userId: string): Promise<{ ok: true } | { ok: false; missing: BlockKey[] }> {
  const row = await getProfile(userId);
  const q = readAnswers(row);
  const missing = missingRequiredBlocks(q);
  if (missing.length > 0) return { ok: false, missing };
  await getDb().update(profile).set({ onboardingCompletedAt: new Date(), updatedAt: new Date() }).where(eq(profile.userId, userId));
  return { ok: true };
}

export function completeAnswers(q: Questionnaire): CompleteQuestionnaire | null {
  const parsed = CompleteQuestionnaire.safeParse(q);
  return parsed.success ? parsed.data : null;
}

export { trainingLevel };
