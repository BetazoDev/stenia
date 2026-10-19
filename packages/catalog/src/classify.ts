import type { LoadType, MovementPattern, MuscleGroup } from '@stenia/core';

const test = (re: RegExp, s: string) => re.test(s);

/** Patrón de movimiento a partir del nombre, mecánica y músculos. El orden importa: lo específico va primero. */
export function inferPattern(input: {
  name: string;
  mechanic?: string | null;
  category?: string | null;
  primaryMuscles: MuscleGroup[];
}): MovementPattern {
  const n = input.name.toLowerCase();
  const cat = (input.category ?? '').toLowerCase();
  if (cat === 'skill') return 'skill';
  if (/stretch|mobility|foam|roll/.test(cat) || test(/stretch|foam roll|mobility|rotation drill|circles?$/, n)) return 'mobility';
  if (cat === 'cardio' || test(/treadmill|rower|rowing machine|bike|jump rope|burpee|running|sprint|elliptical|stair|ski erg|battle rope|jumping jack|mountain climber/, n)) return 'cardio';
  if (/olympic|strongman/.test(cat) || test(/\bclean\b|snatch|\bjerk\b|power clean|hang clean|thruster|swing|tire flip|sled|yoke|atlas|log lift|keg/, n)) {
    return /strongman/.test(cat) || test(/farmer|yoke|sled/, n) ? 'carry' : 'explosive';
  }
  if (cat === 'plyometrics' || cat === 'explosive' || test(/box jump|broad jump|tuck jump|clap push|plyo|jump squat|jumping|bound|hop/, n)) return 'explosive';
  if (test(/farmer|carry|suitcase walk|waiter walk/, n)) return 'carry';
  if (test(/plank|crunch|sit-?up|leg raise|hollow|l-?sit|dragon flag|rollout|roll-?out|dead bug|bird dog|pallof|russian twist|v-?up|knee raise|ab wheel|toes to bar|knees to elbows|windshield|woodchop|side bend|flutter kick|scissor/, n)) {
    return 'core';
  }
  // Aislamientos con nombre de compuesto: antes de los patrones grandes.
  if (test(/lateral raise|front raise|side raise|upright row|y.?raise|rear delt|reverse fly|reverse flye|rear fly|face pull|pull.?apart|pullover|shrug|leg curl|hamstring curl|nordic|leg extension|calf|adduct|abduct|kickback|fly\b|flye|crossover|pec deck|butterfly|curl\b|curls\b|pushdown|push-?down|skull|triceps extension|tricep extension|overhead extension|french press|wrist|neck/, n)) {
    return 'isolation';
  }
  if (test(/lunge|split squat|step-?up|bulgarian/, n)) return 'lunge';
  if (test(/deadlift|rdl|romanian|stiff.?leg|hip thrust|glute bridge|good morning|back extension|hyperextension|pull-?through|reverse hyper/, n)) {
    return 'hinge';
  }
  if (test(/squat|leg press|hack|pistol|wall sit|sissy/, n)) return 'squat';
  if (test(/pull-?up|chin-?up|pulldown|pull-?down|front lever|back lever|muscle-?up|rope climb|lat pull/, n)) return 'vertical_pull';
  if (test(/\brow\b|rows\b|rowing/, n)) return 'horizontal_pull';
  if (test(/overhead press|shoulder press|military|handstand push|pike push|arnold|z press|push press|landmine press|overhead/, n)) {
    return 'vertical_push';
  }
  if (test(/handstand|planche|human flag|back lever/, n)) return 'skill';
  if (test(/push-?up|bench press|chest press|\bdips?\b|floor press|incline press|decline press|press/, n)) return 'horizontal_push';
  if (input.mechanic === 'isolation') return 'isolation';
  const m = input.primaryMuscles[0];
  switch (m) {
    case 'chest':
    case 'triceps':
    case 'front_delts':
      return 'horizontal_push';
    case 'lats':
    case 'upper_back':
    case 'rear_delts':
      return 'horizontal_pull';
    case 'biceps':
    case 'forearms':
    case 'side_delts':
    case 'calves':
      return 'isolation';
    case 'quads':
      return 'squat';
    case 'hamstrings':
    case 'glutes':
    case 'lower_back':
      return 'hinge';
    case 'abs':
    case 'obliques':
    case 'hip_flexors':
      return 'core';
    default:
      return 'isolation';
  }
}

/** Equipo que no aporta carga externa: el ejercicio se progresa por variante, asistencia o lastre. */
export const BODYWEIGHT_EQUIPMENT = new Set([
  'pull_up_bar', 'parallel_bars', 'dip_station', 'rings', 'trx', 'wall_bars', 'parallettes', 'ab_wheel', 'stability_ball',
  'floor_space', 'wall_handstand', 'jump_space', 'plyo_box', 'bench_flat', 'bench_incline',
]);

const ISOMETRIC_RE = /\b(plank|hold|holds|l-?sit|hollow body|hollow hold|wall sit|front lever|back lever|planche|human flag|v-?sit|support|dead hang|hang\b|crow|frog stand|bridge hold|iron cross|isometric)\b/i;
const DYNAMIC_RE = /push-?up|pull-?up|raise|row|press|walk|jack|climber|to\b|negative|tap|reach|dip/i;
const LOADED_NAME_RE = /barbell|dumbbell|kettlebell|cable|machine|smith|ez.?bar|trap bar|plate|weighted|band(ed)? resist|medicine ball|sandbag/i;

export function inferLoadType(input: { name: string; bodyweight: boolean; force?: string | null; equipment?: string[] }): LoadType {
  const n = input.name;
  const equipmentOnlyBodyweight = (input.equipment ?? []).every((e) => BODYWEIGHT_EQUIPMENT.has(e));
  const bodyweight = (input.bodyweight || equipmentOnlyBodyweight) && !LOADED_NAME_RE.test(n.replace(/weighted/i, ''));
  if (/weighted|lastr|with weight|vest/i.test(n) && (bodyweight || equipmentOnlyBodyweight)) return 'weighted_bw';
  if (/assisted|band-assisted|asistid|machine-assisted|negative/i.test(n) || (input.equipment ?? []).includes('assisted_dip_pullup_machine')) {
    return /negative/i.test(n) ? 'bodyweight' : 'assisted';
  }
  if (!bodyweight) return 'external';
  if ((ISOMETRIC_RE.test(n) && !DYNAMIC_RE.test(n)) || (input.force === 'static' && !DYNAMIC_RE.test(n))) return 'isometric';
  return 'bodyweight';
}

export function inferCategory(input: { loadType: LoadType; pattern: MovementPattern; bodyweight: boolean }): string {
  if (input.pattern === 'mobility') return 'mobility';
  if (input.pattern === 'cardio') return 'cardio';
  if (input.loadType !== 'external') return 'calisthenics';
  return 'gym';
}

export function normalizeLevel(raw: string | null | undefined): 'beginner' | 'intermediate' | 'advanced' {
  switch ((raw ?? '').toLowerCase()) {
    case 'intermediate':
      return 'intermediate';
    case 'advanced':
    case 'expert':
      return 'advanced';
    default:
      return 'beginner';
  }
}
