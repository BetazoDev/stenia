import type { MuscleGroup } from '@stenia/core';

const MAP: Record<string, MuscleGroup> = {
  // free-exercise-db
  abdominals: 'abs',
  hamstrings: 'hamstrings',
  adductors: 'adductors',
  quadriceps: 'quads',
  biceps: 'biceps',
  shoulders: 'side_delts',
  chest: 'chest',
  'middle back': 'upper_back',
  calves: 'calves',
  glutes: 'glutes',
  'lower back': 'lower_back',
  lats: 'lats',
  triceps: 'triceps',
  traps: 'traps',
  forearms: 'forearms',
  neck: 'neck',
  abductors: 'abductors',
  // RepDB (slugs anatómicos)
  rectus_abdominis: 'abs',
  transverse_abdominis: 'abs',
  latissimus_dorsi: 'lats',
  pectoralis_major: 'chest',
  anterior_deltoid: 'front_delts',
  lateral_deltoid: 'side_delts',
  posterior_deltoid: 'rear_delts',
  triceps_brachii: 'triceps',
  erector_spinae: 'lower_back',
  obliques: 'obliques',
  gastrocnemius: 'calves',
  soleus: 'calves',
  tibialis_anterior: 'calves',
  gluteus_medius: 'glutes',
  gluteus_maximus: 'glutes',
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  brachioradialis: 'forearms',
  forearm_flexors: 'forearms',
  forearm_extensors: 'forearms',
  rhomboids: 'upper_back',
  trapezius: 'traps',
  hip_flexors: 'hip_flexors',
  quadratus_lumborum: 'lower_back',
  // calisthenics dataset
  'anterior deltoids': 'front_delts',
  'lateral deltoids': 'side_delts',
  'posterior deltoids': 'rear_delts',
  'rear deltoids': 'rear_delts',
  'front deltoids': 'front_delts',
  deltoids: 'side_delts',
  core: 'abs',
  abs: 'abs',
  'lower abs': 'abs',
  'upper back': 'upper_back',
  'erector spinae': 'lower_back',
  'hip flexors': 'hip_flexors',
  'serratus anterior': 'chest',
  serratus: 'chest',
  'rotator cuff': 'rear_delts',
  'full body': 'full_body',
  'lower body': 'quads',
  'upper body': 'chest',
};

export function normalizeMuscle(raw: string): MuscleGroup | null {
  const key = raw.trim().toLowerCase();
  if (MAP[key]) return MAP[key];
  const simplified = key.replace(/[_-]+/g, ' ');
  if (MAP[simplified]) return MAP[simplified];
  if (/delt/.test(simplified)) return 'side_delts';
  if (/pec|chest/.test(simplified)) return 'chest';
  if (/lat\b|lats/.test(simplified)) return 'lats';
  if (/trap/.test(simplified)) return 'traps';
  if (/tricep/.test(simplified)) return 'triceps';
  if (/bicep/.test(simplified)) return 'biceps';
  if (/forearm|grip|wrist/.test(simplified)) return 'forearms';
  if (/oblique/.test(simplified)) return 'obliques';
  if (/abdom|core|abs/.test(simplified)) return 'abs';
  if (/quad/.test(simplified)) return 'quads';
  if (/hamstring/.test(simplified)) return 'hamstrings';
  if (/glute/.test(simplified)) return 'glutes';
  if (/calf|calves/.test(simplified)) return 'calves';
  if (/adductor|inner thigh/.test(simplified)) return 'adductors';
  if (/abductor|outer thigh/.test(simplified)) return 'abductors';
  if (/lower back|lumbar|spinae/.test(simplified)) return 'lower_back';
  if (/back|rhomboid/.test(simplified)) return 'upper_back';
  if (/hip/.test(simplified)) return 'hip_flexors';
  if (/neck/.test(simplified)) return 'neck';
  return null;
}

export function normalizeMuscles(list: readonly string[] | undefined): MuscleGroup[] {
  const out = new Set<MuscleGroup>();
  for (const raw of list ?? []) {
    const m = normalizeMuscle(raw);
    if (m) out.add(m);
  }
  return [...out];
}
