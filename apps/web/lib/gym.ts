import 'server-only';

import { equipment, gymProfile, gymProfileEquipment, type EquipmentMeta } from '@stenia/db';
import { and, asc, eq, sql } from 'drizzle-orm';

import { getDb } from './db';
import { PRESET_EQUIPMENT, PRESET_LABELS, type EquipmentItem, type GymPreset } from './gym-presets';

export { PRESET_EQUIPMENT, PRESET_LABELS, type EquipmentItem, type GymPreset } from './gym-presets';

export const DEFAULT_META: Record<string, EquipmentMeta> = {
  dumbbells: { dumbbellMinKg: 2.5, dumbbellMaxKg: 40, dumbbellStepKg: 2.5 },
  bands: { bandResistances: ['ligera', 'media', 'fuerte'] },
  dip_belt: { weightedKgAvailable: 20, weightedStepKg: 2.5 },
  weight_vest: { weightedKgAvailable: 10, weightedStepKg: 2.5 },
  backpack: { weightedKgAvailable: 15, weightedStepKg: 5 },
};

export type GymProfileWithEquipment = typeof gymProfile.$inferSelect & {
  equipment: { slug: string; meta: EquipmentMeta }[];
};

export async function listEquipment() {
  return getDb().select().from(equipment).orderBy(asc(equipment.sortOrder));
}

/** Ejercicio que mejor muestra cada máquina o implemento (fotos de referencia de catálogos abiertos). */
const PHOTO_EXERCISE: Record<string, string> = {
  ab_wheel: 'rep-ab-wheel-rollout',
  assisted_dip_pullup_machine: 'rep-assisted-pull-ups',
  bands: 'fed-band-pull-apart',
  barbell: 'fed-barbell-deadlift',
  bench_flat: 'fed-barbell-bench-press-medium-grip',
  bench_incline: 'fed-incline-dumbbell-press',
  cable_crossover: 'fed-cable-crossover',
  cable_high: 'fed-triceps-pushdown',
  cable_low: 'fed-standing-biceps-cable-curl',
  calf_machine: 'fed-standing-calf-raises',
  cardio_machine: 'rep-treadmill-running',
  chest_press_machine: 'rep-chest-press-machine',
  dip_belt: 'fed-weighted-pull-ups',
  dip_station: 'fed-dips-chest-version',
  dumbbells: 'fed-dumbbell-bicep-curl',
  ez_bar: 'fed-ez-bar-curl',
  floor_space: 'cal-forearm-plank',
  foam_roller: 'fed-quadriceps-smr',
  hack_squat: 'fed-hack-squat',
  hip_adductor_abductor: 'fed-thigh-abductor',
  jump_rope: 'rep-jump-rope',
  jump_space: 'cal-star-jump',
  kettlebells: 'fed-one-arm-kettlebell-swings',
  lat_pulldown: 'fed-wide-grip-lat-pulldown',
  leg_curl: 'fed-lying-leg-curls',
  leg_extension: 'fed-leg-extensions',
  leg_press: 'fed-leg-press',
  machine_generic: 'fed-leverage-chest-press',
  medicine_ball: 'fed-medicine-ball-chest-pass',
  other_equipment: 'fed-farmers-walk',
  parallel_bars: 'fed-dips-chest-version',
  pec_deck: 'fed-butterfly',
  plates: 'fed-front-plate-raise',
  plyo_box: 'fed-front-box-jump',
  pull_up_bar: 'fed-pullups',
  rack: 'fed-barbell-squat',
  rings: 'rep-ring-row',
  seated_row: 'fed-seated-cable-rows',
  sled: 'rep-sled-push',
  smith_machine: 'fed-smith-machine-squat',
  stability_ball: 'fed-exercise-ball-crunch',
  trap_bar: 'rep-hex-bar-deadlift',
  trx: 'rep-trx-row',
  wall_handstand: 'cal-handstand-hold',
};

let photoCache: { at: number; photos: Map<string, string> } | null = null;

/**
 * Foto de referencia por equipo: la del ejercicio elegido arriba y, si falta, la de un ejercicio que solo use ese
 * equipo. Se guarda una hora en memoria (el catálogo casi no cambia).
 */
export async function equipmentPhotos(): Promise<Map<string, string>> {
  if (photoCache && Date.now() - photoCache.at < 3_600_000 && photoCache.photos.size > 0) return photoCache.photos;
  const db = getDb();
  const auto = await db.execute<{ slug: string; url: string }>(sql`
    select distinct on (q.slug) q.slug, m.url
    from equipment q
    join exercise_equipment ee on ee.equipment_id = q.id and ee.required
    join exercise x on x.id = ee.exercise_id and x.active
    join exercise_media m on m.exercise_id = x.id and m.type = 'image'
    order by q.slug,
      (select count(*) from exercise_equipment e2 where e2.exercise_id = x.id and e2.required),
      (m.source = 'repdb'), m.sort_order, x.slug`);
  const curated = await db.execute<{ slug: string; url: string }>(sql`
    select distinct on (x.slug) x.slug, m.url
    from exercise x
    join exercise_media m on m.exercise_id = x.id and m.type = 'image'
    where x.slug in (${sql.join(Object.values(PHOTO_EXERCISE).map((s) => sql`${s}`), sql`, `)})
    order by x.slug, (m.role = 'end'), m.sort_order`);
  const byExercise = new Map(curated.rows.map((r) => [r.slug, r.url]));
  const photos = new Map(auto.rows.map((r) => [r.slug, r.url]));
  for (const [slug, exerciseSlug] of Object.entries(PHOTO_EXERCISE)) {
    const url = byExercise.get(exerciseSlug);
    if (url) photos.set(slug, url);
  }
  photoCache = { at: Date.now(), photos };
  return photos;
}

/** Catálogo de equipamiento con su foto de referencia, en el orden de la semilla. */
export async function listEquipmentWithPhotos(): Promise<EquipmentItem[]> {
  const [catalog, photos] = await Promise.all([listEquipment(), equipmentPhotos()]);
  return catalog.map((e) => ({ slug: e.slug, nameEs: e.nameEs, category: e.category, photoUrl: photos.get(e.slug) ?? null }));
}

export async function listGymProfiles(userId: string): Promise<GymProfileWithEquipment[]> {
  const db = getDb();
  const profiles = await db.select().from(gymProfile).where(eq(gymProfile.userId, userId)).orderBy(asc(gymProfile.createdAt));
  if (profiles.length === 0) return [];
  const rows = await db
    .select({ gymProfileId: gymProfileEquipment.gymProfileId, slug: equipment.slug, meta: gymProfileEquipment.meta })
    .from(gymProfileEquipment)
    .innerJoin(equipment, eq(equipment.id, gymProfileEquipment.equipmentId));
  return profiles.map((p) => ({
    ...p,
    equipment: rows.filter((r) => r.gymProfileId === p.id).map((r) => ({ slug: r.slug, meta: r.meta })),
  }));
}

export async function getActiveGymProfile(userId: string): Promise<GymProfileWithEquipment | null> {
  const all = await listGymProfiles(userId);
  return all.find((p) => p.active) ?? all[0] ?? null;
}

export async function getGymProfile(userId: string, id: string): Promise<GymProfileWithEquipment | null> {
  const all = await listGymProfiles(userId);
  return all.find((p) => p.id === id) ?? null;
}

/** Reemplaza el equipo de un perfil verificando que pertenece al usuario. */
export async function saveGymProfile(
  userId: string,
  input: { id?: string; name: string; kind: GymPreset; equipment: { slug: string; meta?: EquipmentMeta }[]; active?: boolean },
): Promise<string> {
  const db = getDb();
  let id = input.id;
  if (id) {
    const [own] = await db.select({ id: gymProfile.id }).from(gymProfile).where(and(eq(gymProfile.id, id), eq(gymProfile.userId, userId)));
    if (!own) throw new Error('Perfil de equipamiento no encontrado.');
    await db.update(gymProfile).set({ name: input.name, kind: input.kind, updatedAt: new Date() }).where(eq(gymProfile.id, id));
  } else {
    const existing = await db.select({ id: gymProfile.id }).from(gymProfile).where(eq(gymProfile.userId, userId));
    const [created] = await db
      .insert(gymProfile)
      .values({ userId, name: input.name, kind: input.kind, active: existing.length === 0 || Boolean(input.active) })
      .returning({ id: gymProfile.id });
    if (!created) throw new Error('No se pudo crear el perfil.');
    id = created.id;
  }
  const catalog = await db.select({ id: equipment.id, slug: equipment.slug }).from(equipment);
  const bySlug = new Map(catalog.map((e) => [e.slug, e.id]));
  await db.delete(gymProfileEquipment).where(eq(gymProfileEquipment.gymProfileId, id));
  const values = input.equipment
    .map((e) => ({ gymProfileId: id as string, equipmentId: bySlug.get(e.slug), meta: e.meta ?? DEFAULT_META[e.slug] ?? {} }))
    .filter((v): v is { gymProfileId: string; equipmentId: string; meta: EquipmentMeta } => Boolean(v.equipmentId));
  if (values.length > 0) await db.insert(gymProfileEquipment).values(values);
  if (input.active) await setActiveGymProfile(userId, id);
  return id;
}

export async function setActiveGymProfile(userId: string, id: string): Promise<void> {
  const db = getDb();
  await db.update(gymProfile).set({ active: false }).where(eq(gymProfile.userId, userId));
  await db.update(gymProfile).set({ active: true }).where(and(eq(gymProfile.userId, userId), eq(gymProfile.id, id)));
}

export async function deleteGymProfile(userId: string, id: string): Promise<void> {
  await getDb().delete(gymProfile).where(and(eq(gymProfile.userId, userId), eq(gymProfile.id, id)));
}

export async function createPresetProfile(userId: string, preset: GymPreset): Promise<string> {
  return saveGymProfile(userId, {
    name: PRESET_LABELS[preset].label,
    kind: preset,
    equipment: PRESET_EQUIPMENT[preset].map((slug) => ({ slug })),
    active: true,
  });
}

/** Incremento mínimo de carga según el equipo que usa un ejercicio y los metadatos del perfil. */
export function incrementsFor(exerciseEquipment: string[], gym: GymProfileWithEquipment | null) {
  const meta = new Map((gym?.equipment ?? []).map((e) => [e.slug, e.meta]));
  let loadKg = 2.5;
  if (exerciseEquipment.includes('dumbbells')) loadKg = meta.get('dumbbells')?.dumbbellStepKg ?? 2.5;
  else if (exerciseEquipment.includes('kettlebells')) loadKg = 4;
  else if (exerciseEquipment.some((e) => ['barbell', 'ez_bar', 'trap_bar', 'smith_machine'].includes(e))) loadKg = 2.5;
  else if (exerciseEquipment.some((e) => e.includes('machine') || e.startsWith('cable') || ['leg_press', 'hack_squat', 'leg_curl', 'leg_extension', 'lat_pulldown', 'seated_row', 'pec_deck'].includes(e))) loadKg = 5;
  const weighted = ['dip_belt', 'weight_vest', 'backpack'].map((s) => meta.get(s)).find((m) => m?.weightedStepKg);
  return { loadKg, assistanceKg: 5, addedKg: weighted?.weightedStepKg ?? 0 };
}
