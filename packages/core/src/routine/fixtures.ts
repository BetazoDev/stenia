import type { LoadType, MovementPattern, MuscleGroup } from '../schemas/common';
import type { TrainingLevel } from '../questionnaire';
import type { CatalogExercise, GenerationContext } from './types';

/** Catálogo mínimo para pruebas: cubre todos los patrones con equipo de gimnasio y de calistenia. */
function ex(
  slug: string,
  name: string,
  pattern: MovementPattern,
  primary: MuscleGroup[],
  equipment: string[],
  loadType: LoadType = 'external',
  extra: Partial<CatalogExercise> = {},
): CatalogExercise {
  return {
    id: `id-${slug}`,
    slug,
    nameEs: name,
    nameEn: name,
    pattern,
    category: loadType === 'external' ? 'gym' : 'calisthenics',
    loadType,
    level: 'beginner' as TrainingLevel,
    mechanic: pattern === 'isolation' ? 'isolation' : 'compound',
    primaryMuscles: primary,
    secondaryMuscles: [],
    equipment,
    source: 'repdb',
    hasMedia: true,
    reviewed: true,
    ...extra,
  };
}

export const FIXTURE_CATALOG: CatalogExercise[] = [
  ex('back-squat', 'Back Squat', 'squat', ['quads', 'glutes'], ['barbell', 'rack']),
  ex('goblet-squat', 'Goblet Squat', 'squat', ['quads'], ['dumbbells']),
  ex('leg-press', 'Leg Press', 'squat', ['quads'], ['leg_press']),
  ex('bodyweight-squat', 'Bodyweight Squat', 'squat', ['quads'], [], 'bodyweight'),
  ex('romanian-deadlift', 'Romanian Deadlift', 'hinge', ['hamstrings', 'glutes'], ['barbell'], 'external', { secondaryMuscles: ['lower_back'] }),
  ex('hip-thrust', 'Hip Thrust', 'hinge', ['glutes'], ['barbell', 'bench_flat']),
  ex('glute-bridge', 'Glute Bridge', 'hinge', ['glutes'], [], 'bodyweight'),
  ex('walking-lunge', 'Walking Lunge', 'lunge', ['quads', 'glutes'], ['dumbbells']),
  ex('split-squat', 'Split Squat', 'lunge', ['quads'], [], 'bodyweight'),
  ex('bench-press', 'Bench Press', 'horizontal_push', ['chest'], ['barbell', 'bench_flat', 'rack'], 'external', { secondaryMuscles: ['triceps', 'front_delts'] }),
  ex('dumbbell-press', 'Dumbbell Bench Press', 'horizontal_push', ['chest'], ['dumbbells', 'bench_flat']),
  ex('push-up', 'Push-Up', 'horizontal_push', ['chest'], [], 'bodyweight', { secondaryMuscles: ['triceps'] }),
  ex('dips', 'Parallel Bar Dips', 'horizontal_push', ['chest', 'triceps'], ['parallel_bars'], 'bodyweight'),
  ex('overhead-press', 'Overhead Press', 'vertical_push', ['front_delts'], ['barbell'], 'external', { secondaryMuscles: ['triceps'] }),
  ex('pike-push-up', 'Pike Push-Up', 'vertical_push', ['front_delts'], [], 'bodyweight'),
  ex('pull-up', 'Pull-Up', 'vertical_pull', ['lats'], ['pull_up_bar'], 'bodyweight', { secondaryMuscles: ['biceps'] }),
  ex('lat-pulldown', 'Lat Pulldown', 'vertical_pull', ['lats'], ['lat_pulldown']),
  ex('barbell-row', 'Bent-Over Barbell Row', 'horizontal_pull', ['upper_back', 'lats'], ['barbell']),
  ex('seated-row', 'Seated Cable Row', 'horizontal_pull', ['upper_back'], ['seated_row']),
  ex('inverted-row', 'Inverted Row', 'horizontal_pull', ['upper_back'], ['pull_up_bar'], 'bodyweight'),
  ex('plank', 'Plank', 'core', ['abs'], [], 'isometric'),
  ex('hanging-knee-raise', 'Hanging Knee Raise', 'core', ['abs'], ['pull_up_bar'], 'bodyweight'),
  ex('biceps-curl', 'Dumbbell Biceps Curl', 'isolation', ['biceps'], ['dumbbells']),
  ex('triceps-pushdown', 'Triceps Pushdown', 'isolation', ['triceps'], ['cable_high']),
  ex('lateral-raise', 'Lateral Raise', 'isolation', ['side_delts'], ['dumbbells']),
  ex('leg-curl', 'Leg Curl', 'isolation', ['hamstrings'], ['leg_curl']),
  ex('leg-extension', 'Leg Extension', 'isolation', ['quads'], ['leg_extension']),
  ex('calf-raise', 'Standing Calf Raise', 'isolation', ['calves'], [], 'bodyweight'),
  ex('face-pull', 'Face Pull', 'isolation', ['rear_delts'], ['cable_high']),
  ex('cable-fly', 'Cable Fly', 'isolation', ['chest'], ['cable_crossover']),
  ex('handstand-hold', 'Wall Handstand Hold', 'skill', ['front_delts'], ['wall_handstand'], 'isometric'),
  ex('jumping-jack', 'Jumping Jack', 'cardio', ['full_body'], [], 'bodyweight'),
];

export const FULL_GYM = [
  'barbell', 'rack', 'dumbbells', 'leg_press', 'bench_flat', 'parallel_bars', 'pull_up_bar', 'lat_pulldown',
  'seated_row', 'cable_high', 'leg_curl', 'leg_extension', 'cable_crossover', 'wall_handstand',
];

export function fixtureContext(overrides: Partial<GenerationContext> = {}): GenerationContext {
  return {
    goal: 'hypertrophy',
    level: 'intermediate',
    daysPerWeek: 4,
    minutesPerSession: 60,
    gymRatio: 70,
    skillGoals: [],
    intensityCap: 'vigorous',
    injuryZones: [],
    painfulMovements: '',
    banned: [],
    favorites: [],
    availableEquipment: FULL_GYM,
    ...overrides,
  };
}
