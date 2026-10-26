/** Preajustes de equipamiento (compartidos por el servidor y el cuestionario inicial). */
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

/** Elemento del catálogo de equipamiento tal como lo muestra la lista con fotos. */
export type EquipmentItem = { slug: string; nameEs: string; category: string; photoUrl: string | null };
