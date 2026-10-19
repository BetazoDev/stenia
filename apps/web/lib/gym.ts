import 'server-only';

import { equipment, gymProfile, gymProfileEquipment, type EquipmentMeta } from '@stenia/db';
import { and, asc, eq } from 'drizzle-orm';

import { getDb } from './db';

export type GymPreset = 'gym' | 'home' | 'park';

export const PRESET_LABELS: Record<GymPreset, { label: string; description: string }> = {
  gym: { label: 'Gimnasio completo', description: 'Máquinas, peso libre, barras y paralelas.' },
  home: { label: 'Casa', description: 'Mancuernas, banco, bandas y barra de puerta.' },
  park: { label: 'Parque de calistenia', description: 'Barras, paralelas, suelo y espacio para saltos.' },
};

/** Equipo de cada preajuste (slugs de la semilla de `equipment`). */
export const PRESET_EQUIPMENT: Record<GymPreset, string[]> = {
  gym: [
    'leg_press', 'hack_squat', 'leg_extension', 'leg_curl', 'hip_adductor_abductor', 'cable_high', 'cable_low',
    'cable_crossover', 'lat_pulldown', 'seated_row', 'chest_press_machine', 'pec_deck', 'smith_machine', 'calf_machine',
    'assisted_dip_pullup_machine', 'machine_generic', 'dumbbells', 'barbell', 'ez_bar', 'plates', 'kettlebells',
    'bench_flat', 'bench_incline', 'rack', 'pull_up_bar', 'parallel_bars', 'dip_station', 'bands', 'floor_space',
    'jump_space', 'stability_ball', 'medicine_ball', 'ab_wheel', 'dip_belt',
  ],
  home: ['dumbbells', 'bench_flat', 'bands', 'pull_up_bar', 'floor_space', 'wall_handstand'],
  park: ['pull_up_bar', 'parallel_bars', 'dip_station', 'wall_bars', 'floor_space', 'jump_space', 'wall_handstand'],
};

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
