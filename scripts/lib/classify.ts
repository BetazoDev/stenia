import type { LoadType, MovementPattern, MuscleGroup } from '@stenia/core';

const test = (re: RegExp, s: string) => re.test(s);

/** Patrón de movimiento a partir del nombre, mecánica y músculos. */
export function inferPattern(input: {
  name: string;
  mechanic?: string | null;
  category?: string | null;
  primaryMuscles: MuscleGroup[];
}): MovementPattern {
  const n = input.name.toLowerCase();
  const cat = (input.category ?? '').toLowerCase();
  if (cat === 'skill') return 'skill';
  if (/stretch|mobility|foam|roll/.test(cat) || test(/stretch|foam roll|mobility/, n)) return 'mobility';
  if (cat === 'cardio' || test(/treadmill|rower|bike|jump rope|burpee|running|sprint|elliptical/, n)) return 'cardio';
  if (cat === 'plyometrics' || cat === 'explosive' || test(/box jump|broad jump|tuck jump|clap push|plyo|jump squat/, n)) {
    return 'explosive';
  }
  if (test(/farmer|carry|suitcase walk/, n)) return 'carry';
  if (test(/plank|crunch|sit-?up|leg raise|hollow|l-?sit|dragon flag|rollout|dead bug|bird dog|pallof|russian twist|v-?up|knee raise|ab wheel|toes to bar|hanging/, n)) {
    return 'core';
  }
  if (test(/lunge|split squat|step-?up|bulgarian/, n)) return 'lunge';
  if (test(/deadlift|rdl|romanian|hip thrust|glute bridge|good morning|nordic|swing|back extension|hyperextension|pull-?through|leg curl|hamstring curl|reverse hyper/, n)) {
    return 'hinge';
  }
  if (test(/squat|leg press|hack|pistol|wall sit|sissy/, n)) return 'squat';
  if (test(/pull-?up|chin-?up|pulldown|lever|muscle-?up|rope climb|lat pull/, n)) return 'vertical_pull';
  if (test(/\brow\b|rows|face pull|rear delt|reverse fly|rear fly|pullover/, n)) return 'horizontal_pull';
  if (test(/overhead|shoulder press|military|handstand|pike push|arnold|z press|push press|jerk|lateral raise|front raise|upright row/, n)) {
    return 'vertical_push';
  }
  if (test(/push-?up|bench|chest press|dip|fly|flye|crossover|pec deck|floor press|planche/, n)) return 'horizontal_push';
  if (test(/curl|pushdown|extension|kickback|skull|calf|raise|shrug|wrist|neck/, n)) return 'isolation';
  if (input.mechanic === 'isolation') return 'isolation';
  const m = input.primaryMuscles[0];
  switch (m) {
    case 'chest':
    case 'triceps':
    case 'front_delts':
      return 'horizontal_push';
    case 'lats':
    case 'upper_back':
    case 'biceps':
    case 'rear_delts':
      return 'horizontal_pull';
    case 'side_delts':
      return 'vertical_push';
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

const ISOMETRIC_RE = /plank|hold|l-?sit|hollow|wall sit|lever|planche|handstand|flag|v-?sit|support|bridge hold|iron cross|crow|frog stand|tuck/i;

export function inferLoadType(input: { name: string; bodyweight: boolean; force?: string | null }): LoadType {
  const n = input.name;
  if (/weighted|lastr/i.test(n) && input.bodyweight) return 'weighted_bw';
  if (/assisted|band-assisted|asistid/i.test(n) && input.bodyweight) return 'assisted';
  if (input.bodyweight && (ISOMETRIC_RE.test(n) || input.force === 'static')) return 'isometric';
  if (input.bodyweight) return 'bodyweight';
  return 'external';
}

export function inferCategory(input: { loadType: LoadType; pattern: MovementPattern; bodyweight: boolean }): string {
  if (input.pattern === 'mobility') return 'mobility';
  if (input.pattern === 'cardio') return 'cardio';
  if (input.bodyweight) return 'calisthenics';
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
