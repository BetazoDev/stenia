/** Mapeo de equipo de cada catálogo externo a los slugs de `equipment` (semilla en @stenia/db). */

function fromName(name: string): string[] {
  const n = name.toLowerCase();
  const out = new Set<string>();
  if (/leg press/.test(n)) out.add('leg_press');
  if (/hack/.test(n)) out.add('hack_squat');
  if (/leg extension/.test(n)) out.add('leg_extension');
  if (/leg curl|hamstring curl/.test(n)) out.add('leg_curl');
  if (/adduct|abduct/.test(n) && /machine/.test(n)) out.add('hip_adductor_abductor');
  if (/pulldown|lat pull/.test(n)) out.add('lat_pulldown');
  if (/seated row|cable row|machine row/.test(n)) out.add('seated_row');
  if (/smith/.test(n)) out.add('smith_machine');
  if (/pec deck|butterfly|machine fly/.test(n)) out.add('pec_deck');
  if (/calf/.test(n) && /machine|raise/.test(n) && !/dumbbell|barbell|bodyweight|single/.test(n)) out.add('calf_machine');
  if (/chest press/.test(n) && /machine/.test(n)) out.add('chest_press_machine');
  if (/crossover|cable fly|cable crossover/.test(n)) out.add('cable_crossover');
  if (/pull-?up|chin-?up|muscle-?up|front lever|back lever|hanging|toes to bar|rope climb/.test(n)) out.add('pull_up_bar');
  if (/\bdip\b|dips\b/.test(n) && !/bench dip|chair dip/.test(n)) out.add('parallel_bars');
  if (/ring/.test(n)) out.add('rings');
  if (/handstand|wall walk|pike push|wall-assisted/.test(n)) out.add('wall_handstand');
  if (/parallette/.test(n)) out.add('parallettes');
  if (/trx|suspension/.test(n)) out.add('trx');
  if (/box jump|depth jump/.test(n)) out.add('plyo_box');
  if (/bench|incline|decline/.test(n) && !/bench dip/.test(n)) out.add(/incline|decline/.test(n) ? 'bench_incline' : 'bench_flat');
  if (/rack|squat \(barbell\)|back squat|front squat|rack pull/.test(n) && /barbell|squat|rack/.test(n)) out.add('rack');
  if (/kettlebell/.test(n)) out.add('kettlebells');
  if (/dumbbell/.test(n)) out.add('dumbbells');
  if (/barbell/.test(n)) out.add('barbell');
  if (/ez[- ]?bar|e-z/.test(n)) out.add('ez_bar');
  if (/band/.test(n)) out.add('bands');
  if (/weighted/.test(n)) out.add('dip_belt');
  return [...out];
}

export function mapFreeExerciseDbEquipment(equipmentRaw: string | null, name: string): string[] {
  const base = new Set<string>(fromName(name));
  switch (equipmentRaw) {
    case 'barbell':
      base.add('barbell');
      break;
    case 'dumbbell':
      base.add('dumbbells');
      break;
    case 'kettlebells':
      base.add('kettlebells');
      break;
    case 'cable':
      if (![...base].some((s) => s.startsWith('cable') || s === 'lat_pulldown' || s === 'seated_row')) {
        base.add(/curl|row|pull-?through|low/i.test(name) ? 'cable_low' : 'cable_high');
      }
      break;
    case 'machine':
      if (![...base].some((s) => s.endsWith('_machine') || ['leg_press', 'hack_squat', 'leg_extension', 'leg_curl', 'lat_pulldown', 'seated_row', 'pec_deck', 'hip_adductor_abductor'].includes(s))) {
        base.add('machine_generic');
      }
      break;
    case 'bands':
      base.add('bands');
      break;
    case 'e-z curl bar':
      base.add('ez_bar');
      break;
    case 'medicine ball':
      base.add('medicine_ball');
      break;
    case 'exercise ball':
      base.add('stability_ball');
      break;
    case 'foam roll':
      base.add('foam_roller');
      break;
    case 'other':
      if (base.size === 0) base.add('other_equipment');
      break;
    default:
      break; // 'body only' o null
  }
  return [...base];
}

const REPDB_MAP: Record<string, string> = {
  dumbbell: 'dumbbells',
  barbell: 'barbell',
  ez_bar: 'ez_bar',
  trap_bar: 'trap_bar',
  kettlebell: 'kettlebells',
  plates: 'plates',
  cable: 'cable_high',
  pull_up_bar: 'pull_up_bar',
  dip_station: 'dip_station',
  rings: 'rings',
  suspension_trainer: 'trx',
  resistance_band: 'bands',
  loop_band: 'bands',
  flat_bench: 'bench_flat',
  smith_machine: 'smith_machine',
  leg_press: 'leg_press',
  hack_squat: 'hack_squat',
  leg_curl: 'leg_curl',
  leg_extension: 'leg_extension',
  lat_pulldown_machine: 'lat_pulldown',
  seated_row_machine: 'seated_row',
  chest_press_machine: 'chest_press_machine',
  pec_deck: 'pec_deck',
  chest_fly_machine: 'pec_deck',
  hip_abduction_machine: 'hip_adductor_abductor',
  hip_adduction_machine: 'hip_adductor_abductor',
  standing_calf_raise_machine: 'calf_machine',
  seated_calf_raise_machine: 'calf_machine',
  donkey_calf_raise_machine: 'calf_machine',
  dip_machine: 'assisted_dip_pullup_machine',
  assisted_pullup_machine: 'assisted_dip_pullup_machine',
  plate_loaded_dip_machine: 'assisted_dip_pullup_machine',
  stability_ball: 'stability_ball',
  ab_wheel: 'ab_wheel',
  plyo_box: 'plyo_box',
  jump_rope: 'jump_rope',
  sled: 'sled',
  treadmill: 'cardio_machine',
  rower: 'cardio_machine',
  air_bike: 'cardio_machine',
  elliptical: 'cardio_machine',
  ski_erg: 'cardio_machine',
  stair_climber: 'cardio_machine',
  stationary_bike: 'cardio_machine',
};

export function mapRepDbEquipment(equipmentRaw: string | null | undefined, name: string): string[] {
  const base = new Set<string>(fromName(name));
  if (!equipmentRaw) return [...base];
  const mapped = REPDB_MAP[equipmentRaw];
  if (mapped) base.add(mapped);
  else if (equipmentRaw.endsWith('_machine') || /machine|developer/.test(equipmentRaw)) base.add('machine_generic');
  else base.add('other_equipment');
  return [...base];
}

export function inferCalisthenicsEquipment(name: string, category: string): string[] {
  const n = name.toLowerCase();
  const base = new Set<string>(fromName(name));
  if (/l-?sit|planche|plank|push-?up|squat|pistol|bridge|hollow|crow|frog|v-?up|burpee|lunge|nordic|sit-?up|crunch/.test(n) && base.size === 0) {
    base.add('floor_space');
  }
  if (/jump/.test(n)) base.add('jump_space');
  if (/inverted row|australian|body row/.test(n)) base.add('pull_up_bar');
  if (/bench dip|chair/.test(n)) base.add('bench_flat');
  if (category === 'mobility' && base.size === 0) base.add('floor_space');
  return [...base];
}
