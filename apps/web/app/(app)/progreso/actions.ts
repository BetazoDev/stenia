'use server';

import { evaluatePhotoPose, type Landmark, type PhotoPose } from '@stenia/core';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { addMeasurement, deleteAllPhotos, deleteMeasurement, deletePhoto, savePhoto, setPhotosConsent } from '@/lib/body';
import { localDateString } from '@/lib/dates';
import { getProfile } from '@/lib/profile';
import { requireSession } from '@/lib/session';

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const cm = z.number().min(10).max(250).nullable();
const MeasurementForm = z.object({
  measuredAt: z.iso.date(),
  weightKg: z.number().min(25).max(350).nullable(),
  neckCm: cm,
  waistCm: cm,
  hipCm: cm,
  armCm: cm,
  thighCm: cm,
  notes: z.string().max(500).nullable(),
});

export async function addMeasurementAction(raw: unknown): Promise<ActionResult> {
  const { user } = await requireSession();
  const parsed = MeasurementForm.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Revisa los valores: peso entre 25 y 350 kg y medidas entre 10 y 250 cm.' };
  const d = parsed.data;
  if (d.measuredAt > localDateString()) return { ok: false, message: 'La fecha no puede ser futura.' };
  if (d.weightKg === null && d.waistCm === null && d.neckCm === null && d.hipCm === null && d.armCm === null && d.thighCm === null) {
    return { ok: false, message: 'Captura al menos el peso o una medida.' };
  }
  const row = await addMeasurement(user.id, { ...d, source: 'manual' });
  revalidatePath('/progreso');
  revalidatePath('/progreso/medidas');
  return { ok: true, message: row?.bodyFatPct ? `Grasa corporal estimada (Marina): ${row.bodyFatPct}%` : undefined };
}

export async function deleteMeasurementAction(id: string): Promise<ActionResult> {
  const { user } = await requireSession();
  await deleteMeasurement(user.id, z.string().min(1).parse(id));
  revalidatePath('/progreso/medidas');
  return { ok: true };
}

export async function setPhotosConsentAction(consent: boolean): Promise<ActionResult> {
  const { user } = await requireSession();
  await setPhotosConsent(user.id, consent);
  revalidatePath('/progreso/fotos');
  return { ok: true };
}

const PoseInput = z.enum(['front', 'side', 'back']);
const LandmarkSchema = z.object({ x: z.number(), y: z.number(), z: z.number().optional(), visibility: z.number().optional() });
const MAX_BYTES = 4 * 1024 * 1024;

/** Sube una foto guiada. La pose se valida en el cliente con MediaPipe y se vuelve a validar aquí. */
export async function uploadPhotoAction(form: FormData): Promise<ActionResult> {
  const { user } = await requireSession();
  const profile = await getProfile(user.id);
  if (!profile?.photosConsentAt) return { ok: false, message: 'Primero activa el consentimiento para fotos.' };
  const pose = PoseInput.safeParse(form.get('pose'));
  const file = form.get('file');
  if (!pose.success || !(file instanceof File)) return { ok: false, message: 'Falta la foto o la pose.' };
  if (!['image/jpeg', 'image/webp', 'image/png'].includes(file.type)) return { ok: false, message: 'Formato no admitido (usa JPG, PNG o WebP).' };
  if (file.size > MAX_BYTES) return { ok: false, message: 'La foto pesa más de 4 MB.' };
  let landmarks: Landmark[] | null = null;
  const rawLandmarks = form.get('landmarks');
  if (typeof rawLandmarks === 'string' && rawLandmarks.length > 0) {
    const parsed = z.array(LandmarkSchema).length(33).safeParse(JSON.parse(rawLandmarks));
    if (parsed.success) landmarks = parsed.data.map((l) => ({ x: l.x, y: l.y, z: l.z ?? 0, visibility: l.visibility ?? 1 }));
  }
  const check = landmarks ? evaluatePhotoPose(landmarks, pose.data as PhotoPose) : null;
  const data = new Uint8Array(await file.arrayBuffer());
  await savePhoto(user.id, {
    pose: pose.data,
    data,
    contentType: file.type,
    landmarks: landmarks ? { points: landmarks, ok: check?.ok ?? false, issues: check?.issues ?? [] } : null,
  });
  revalidatePath('/progreso/fotos');
  return { ok: true };
}

export async function deletePhotoAction(id: string): Promise<ActionResult> {
  const { user } = await requireSession();
  await deletePhoto(user.id, z.string().min(1).parse(id));
  revalidatePath('/progreso/fotos');
  return { ok: true };
}

export async function deleteAllPhotosAction(): Promise<ActionResult> {
  const { user } = await requireSession();
  await deleteAllPhotos(user.id);
  await setPhotosConsent(user.id, false);
  revalidatePath('/progreso/fotos');
  revalidatePath('/configuracion');
  return { ok: true };
}
