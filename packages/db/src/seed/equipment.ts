import { equipment } from '../schema/equipment';
import type { Db } from '../client';

type EquipmentSeed = typeof equipment.$inferInsert;

/** Catálogo de equipamiento (sección 5 del PRD) más entradas de apoyo para mapear los catálogos importados. */
export const EQUIPMENT_SEED: EquipmentSeed[] = [
  // Máquinas
  { slug: 'leg_press', category: 'machine', nameEs: 'Prensa de pierna', nameEn: 'Leg press', sortOrder: 10 },
  { slug: 'hack_squat', category: 'machine', nameEs: 'Hack', nameEn: 'Hack squat', sortOrder: 11 },
  { slug: 'leg_extension', category: 'machine', nameEs: 'Extensión de pierna', nameEn: 'Leg extension', sortOrder: 12 },
  { slug: 'leg_curl', category: 'machine', nameEs: 'Curl femoral', nameEn: 'Leg curl', sortOrder: 13 },
  { slug: 'hip_adductor_abductor', category: 'machine', nameEs: 'Aductor / abductor', nameEn: 'Hip adductor/abductor', sortOrder: 14 },
  { slug: 'cable_high', category: 'machine', nameEs: 'Polea alta', nameEn: 'High cable', sortOrder: 15 },
  { slug: 'cable_low', category: 'machine', nameEs: 'Polea baja', nameEn: 'Low cable', sortOrder: 16 },
  { slug: 'cable_crossover', category: 'machine', nameEs: 'Cruce de poleas', nameEn: 'Cable crossover', sortOrder: 17 },
  { slug: 'lat_pulldown', category: 'machine', nameEs: 'Jalón', nameEn: 'Lat pulldown', sortOrder: 18 },
  { slug: 'seated_row', category: 'machine', nameEs: 'Remo sentado', nameEn: 'Seated row', sortOrder: 19 },
  { slug: 'chest_press_machine', category: 'machine', nameEs: 'Press de pecho', nameEn: 'Chest press machine', sortOrder: 20 },
  { slug: 'pec_deck', category: 'machine', nameEs: 'Pec deck', nameEn: 'Pec deck', sortOrder: 21 },
  { slug: 'smith_machine', category: 'machine', nameEs: 'Smith', nameEn: 'Smith machine', sortOrder: 22 },
  { slug: 'calf_machine', category: 'machine', nameEs: 'Pantorrilla', nameEn: 'Calf machine', sortOrder: 23 },
  { slug: 'assisted_dip_pullup_machine', category: 'machine', nameEs: 'Máquina asistida de dominadas y fondos', nameEn: 'Assisted dip/pull-up machine', sortOrder: 24 },
  { slug: 'machine_generic', category: 'machine', nameEs: 'Otras máquinas', nameEn: 'Other machines', sortOrder: 25 },
  { slug: 'cardio_machine', category: 'machine', nameEs: 'Máquinas de cardio', nameEn: 'Cardio machines', sortOrder: 26 },
  // Peso libre
  { slug: 'dumbbells', category: 'free_weight', nameEs: 'Mancuernas', nameEn: 'Dumbbells', sortOrder: 30 },
  { slug: 'barbell', category: 'free_weight', nameEs: 'Barra olímpica', nameEn: 'Olympic barbell', sortOrder: 31 },
  { slug: 'ez_bar', category: 'free_weight', nameEs: 'Barra Z', nameEn: 'EZ bar', sortOrder: 32 },
  { slug: 'plates', category: 'free_weight', nameEs: 'Discos', nameEn: 'Plates', sortOrder: 33 },
  { slug: 'kettlebells', category: 'free_weight', nameEs: 'Kettlebells', nameEn: 'Kettlebells', sortOrder: 34 },
  { slug: 'bench_flat', category: 'free_weight', nameEs: 'Banco plano', nameEn: 'Flat bench', sortOrder: 35 },
  { slug: 'bench_incline', category: 'free_weight', nameEs: 'Banco inclinable', nameEn: 'Incline bench', sortOrder: 36 },
  { slug: 'rack', category: 'free_weight', nameEs: 'Rack', nameEn: 'Rack', sortOrder: 37 },
  { slug: 'trap_bar', category: 'free_weight', nameEs: 'Barra hexagonal', nameEn: 'Trap bar', sortOrder: 38 },
  // Estructuras
  { slug: 'pull_up_bar', category: 'structure', nameEs: 'Barra de dominadas', nameEn: 'Pull-up bar', sortOrder: 40 },
  { slug: 'parallel_bars', category: 'structure', nameEs: 'Paralelas', nameEn: 'Parallel bars', sortOrder: 41 },
  { slug: 'dip_station', category: 'structure', nameEs: 'Estación de fondos', nameEn: 'Dip station', sortOrder: 42 },
  { slug: 'rings', category: 'structure', nameEs: 'Anillas', nameEn: 'Rings', sortOrder: 43 },
  { slug: 'trx', category: 'structure', nameEs: 'TRX / suspensión', nameEn: 'Suspension trainer', sortOrder: 44 },
  { slug: 'wall_bars', category: 'structure', nameEs: 'Espaldera', nameEn: 'Wall bars', sortOrder: 45 },
  { slug: 'parallettes', category: 'structure', nameEs: 'Paralettes', nameEn: 'Parallettes', sortOrder: 46 },
  { slug: 'bands', category: 'structure', nameEs: 'Bandas', nameEn: 'Resistance bands', sortOrder: 47 },
  // Espacio
  { slug: 'wall_handstand', category: 'space', nameEs: 'Pared para pino', nameEn: 'Wall for handstands', sortOrder: 50 },
  { slug: 'floor_space', category: 'space', nameEs: 'Suelo para L-sit / planche', nameEn: 'Floor space', sortOrder: 51 },
  { slug: 'jump_space', category: 'space', nameEs: 'Espacio para saltos', nameEn: 'Space for jumps', sortOrder: 52 },
  // Lastre
  { slug: 'dip_belt', category: 'weighted', nameEs: 'Cinturón con cadena', nameEn: 'Dip belt', sortOrder: 60 },
  { slug: 'weight_vest', category: 'weighted', nameEs: 'Chaleco con peso', nameEn: 'Weight vest', sortOrder: 61 },
  { slug: 'backpack', category: 'weighted', nameEs: 'Mochila con peso', nameEn: 'Weighted backpack', sortOrder: 62 },
  // Otros (para mapear catálogos externos)
  { slug: 'medicine_ball', category: 'other', nameEs: 'Balón medicinal', nameEn: 'Medicine ball', sortOrder: 70 },
  { slug: 'stability_ball', category: 'other', nameEs: 'Pelota de estabilidad', nameEn: 'Stability ball', sortOrder: 71 },
  { slug: 'foam_roller', category: 'other', nameEs: 'Rodillo de espuma', nameEn: 'Foam roller', sortOrder: 72 },
  { slug: 'ab_wheel', category: 'other', nameEs: 'Rueda abdominal', nameEn: 'Ab wheel', sortOrder: 73 },
  { slug: 'plyo_box', category: 'other', nameEs: 'Cajón pliométrico', nameEn: 'Plyo box', sortOrder: 74 },
  { slug: 'jump_rope', category: 'other', nameEs: 'Cuerda para saltar', nameEn: 'Jump rope', sortOrder: 75 },
  { slug: 'sled', category: 'other', nameEs: 'Trineo', nameEn: 'Sled', sortOrder: 76 },
  { slug: 'other_equipment', category: 'other', nameEs: 'Otro equipo', nameEn: 'Other equipment', sortOrder: 99 },
];

export async function seedEquipment(db: Db): Promise<number> {
  await db
    .insert(equipment)
    .values(EQUIPMENT_SEED)
    .onConflictDoUpdate({
      target: equipment.slug,
      set: {
        category: equipment.category,
        nameEs: equipment.nameEs,
        nameEn: equipment.nameEn,
        sortOrder: equipment.sortOrder,
      },
    });
  return EQUIPMENT_SEED.length;
}
