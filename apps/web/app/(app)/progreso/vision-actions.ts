'use server';

import { BodyCompositionExtraction, BodyFatPhotoEstimate, bodyCompositionPrompt, bodyFatPhotoPrompt } from '@stenia/ai';
import { bodyPhoto } from '@stenia/db';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { runAi } from '@/lib/ai';
import { addMeasurement, latestBodyComposition } from '@/lib/body';
import { getDb } from '@/lib/db';
import { localDateString } from '@/lib/dates';
import { getNutritionState, refreshTargets } from '@/lib/nutrition';
import { getProfile } from '@/lib/profile';
import { requireSession } from '@/lib/session';
import { readPrivate, type StorageDriver } from '@/lib/storage';

const MAX_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type ExtractResult = { ok: true; data: BodyCompositionExtraction } | { ok: false; message: string; reason?: string };

/** Lee el ticket con el modelo de visión. La imagen no se guarda: solo los valores que la persona confirme. */
export async function extractTicketAction(form: FormData): Promise<ExtractResult> {
  const { user } = await requireSession();
  const file = form.get('file');
  if (!(file instanceof File)) return { ok: false, message: 'Falta la imagen del ticket.' };
  if (!IMAGE_TYPES.includes(file.type)) return { ok: false, message: 'Formato no admitido (JPG, PNG o WebP).' };
  if (file.size > MAX_BYTES) return { ok: false, message: 'La imagen pesa más de 6 MB.' };
  const rendered = bodyCompositionPrompt.render({});
  const result = await runAi({
    fn: 'inbody_extraction',
    userId: user.id,
    schema: BodyCompositionExtraction,
    system: rendered.system,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: rendered.prompt },
          { type: 'image', image: new Uint8Array(await file.arrayBuffer()), mediaType: file.type },
        ],
      },
    ],
    promptId: bodyCompositionPrompt.id,
    promptVersion: bodyCompositionPrompt.version,
    withImages: true,
  });
  if (!result.ok) return { ok: false, message: result.message, reason: result.reason };
  return { ok: true, data: result.output };
}

const num = (min: number, max: number) => z.number().min(min).max(max).nullable();
const TicketValues = z.object({
  device: z.enum(['inbody', 'bia', 'dexa', 'other']),
  measuredAt: z.iso.date(),
  weightKg: num(25, 350),
  bodyFatPct: num(2, 70),
  leanMassKg: num(10, 200),
  skeletalMuscleKg: num(5, 120),
  bmrKcal: num(800, 4500),
  visceralFatLevel: num(1, 60),
  extracted: z.boolean(),
});

export async function saveTicketAction(raw: unknown): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const { user } = await requireSession();
  const parsed = TicketValues.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Revisa los valores: alguno está fuera de rango.' };
  const v = parsed.data;
  if (v.measuredAt > localDateString()) return { ok: false, message: 'La fecha no puede ser futura.' };
  if (v.weightKg === null && v.bodyFatPct === null && v.leanMassKg === null && v.bmrKcal === null) return { ok: false, message: 'Captura al menos un valor.' };
  await addMeasurement(user.id, {
    measuredAt: v.measuredAt,
    weightKg: v.weightKg,
    neckCm: null,
    waistCm: null,
    hipCm: null,
    armCm: null,
    thighCm: null,
    bodyFatPct: v.bodyFatPct,
    bodyFatMethod: v.device === 'dexa' ? 'dexa' : v.device === 'inbody' ? 'inbody' : 'bia',
    leanMassKg: v.leanMassKg,
    bmrMeasured: v.bmrKcal ? Math.round(v.bmrKcal) : null,
    source: v.device === 'other' ? 'bia' : v.device,
    raw: { skeletalMuscleKg: v.skeletalMuscleKg, visceralFatLevel: v.visceralFatLevel, extractedByAi: v.extracted },
  });
  let message = 'Medición guardada.';
  if ((await getNutritionState(user.id)).status === 'ready') {
    const target = await refreshTargets(user.id);
    if (target) message = `Medición guardada. Tus metas ahora usan ${target.method === 'measured' ? 'tu TMB medida' : 'tu composición corporal'}: ${target.kcal} kcal.`;
  }
  revalidatePath('/progreso/medidas');
  revalidatePath('/nutricion');
  return { ok: true, message };
}

export type PhotoEstimateResult = { ok: true; pct: number; low: number; high: number; confidence: string; notes: string } | { ok: false; message: string };

/** Estimación experimental del % de grasa por foto. Solo por acción explícita y siempre marcada como aproximada. */
export async function estimateBodyFatAction(confirm: boolean): Promise<PhotoEstimateResult> {
  const { user } = await requireSession();
  if (confirm !== true) return { ok: false, message: 'Confirma el envío de las fotos.' };
  const profile = await getProfile(user.id);
  if (!profile?.photosConsentAt) return { ok: false, message: 'Activa primero el consentimiento de fotos.' };
  if (!profile.sex || !profile.heightCm) return { ok: false, message: 'Faltan sexo y estatura en tu perfil.' };
  const rows = await getDb().select().from(bodyPhoto).where(eq(bodyPhoto.userId, user.id)).orderBy(desc(bodyPhoto.takenAt)).limit(30);
  const latest = (['front', 'side', 'back'] as const).map((pose) => rows.find((r) => r.pose === pose)).filter((r): r is (typeof rows)[number] => Boolean(r));
  if (!latest.some((r) => r.pose === 'front') || !latest.some((r) => r.pose === 'side')) return { ok: false, message: 'Necesitas al menos una foto de frente y una de perfil.' };
  const images = [];
  for (const r of latest) {
    const file = await readPrivate(user.id, r.storageKey, r.storageDriver as StorageDriver);
    if (file) images.push({ type: 'image' as const, image: file.data, mediaType: file.contentType });
  }
  const body = await latestBodyComposition(user.id);
  const rendered = bodyFatPhotoPrompt.render({ sex: profile.sex === 'male' ? 'hombre' : 'mujer', heightCm: profile.heightCm, weightKg: body.weightKg ?? profile.weightKg ?? 0 });
  const result = await runAi({
    fn: 'body_fat_photo',
    userId: user.id,
    schema: BodyFatPhotoEstimate,
    system: rendered.system,
    messages: [{ role: 'user', content: [{ type: 'text', text: rendered.prompt }, ...images] }],
    promptId: bodyFatPhotoPrompt.id,
    promptVersion: bodyFatPhotoPrompt.version,
    withImages: true,
  });
  if (!result.ok) return { ok: false, message: result.message };
  const e = result.output;
  const low = Math.min(e.rangeLow, e.bodyFatPct);
  const high = Math.max(e.rangeHigh, e.bodyFatPct);
  await addMeasurement(user.id, {
    measuredAt: localDateString(),
    weightKg: null,
    neckCm: null,
    waistCm: null,
    hipCm: null,
    armCm: null,
    thighCm: null,
    bodyFatPct: Math.round(e.bodyFatPct * 10) / 10,
    bodyFatMethod: 'photo_estimate',
    source: 'photo_estimate',
    approximate: true,
    raw: { rangeLow: low, rangeHigh: high, confidence: e.confidence, notes: e.notes, photoIds: latest.map((r) => r.id), modelId: result.modelId },
  });
  revalidatePath('/progreso/fotos');
  revalidatePath('/progreso/medidas');
  return { ok: true, pct: Math.round(e.bodyFatPct * 10) / 10, low, high, confidence: e.confidence, notes: e.notes };
}
