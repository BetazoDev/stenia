import type { Goal, LoadType, MovementPattern, MuscleGroup } from '../schemas/common';
import type { InjuryZone, SkillGoal, TrainingLevel } from '../questionnaire';
import type { IntensityCap } from '../screening';

/** Ejercicio del catálogo en la forma compacta que usan el filtro, la plantilla y el validador. */
export type CatalogExercise = {
  id: string;
  slug: string;
  nameEs: string;
  nameEn: string;
  pattern: MovementPattern;
  category: string;
  loadType: LoadType;
  level: TrainingLevel;
  mechanic?: string | null;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  /** Slugs del equipo requerido (todos obligatorios). */
  equipment: string[];
  source: string;
  hasMedia: boolean;
  reviewed: boolean;
};

export type GenerationContext = {
  goal: Goal;
  level: TrainingLevel;
  daysPerWeek: number;
  minutesPerSession: number;
  /** 0 = solo calistenia, 100 = solo gimnasio. */
  gymRatio: number;
  skillGoals: SkillGoal[];
  intensityCap: IntensityCap;
  injuryZones: InjuryZone[];
  painfulMovements: string;
  banned: string[];
  favorites: string[];
  /** Slugs del equipo disponible en el perfil activo. */
  availableEquipment: string[];
};

export type DayType = 'full_a' | 'full_b' | 'full_c' | 'push' | 'pull' | 'legs' | 'upper' | 'lower';

export type SlotRole = 'skill' | 'main' | 'secondary' | 'accessory' | 'core';

export type Slot = {
  role: SlotRole;
  patterns: MovementPattern[];
  /** Para aislamientos: músculos objetivo (cualquiera de ellos). */
  focus?: MuscleGroup[];
  /** Habilidad asociada (solo slots de skill). */
  skill?: SkillGoal;
};

export type Prescription = {
  sets: number;
  repMin: number | null;
  repMax: number | null;
  targetSeconds: number | null;
  rirTarget: number;
  restSeconds: number;
};
