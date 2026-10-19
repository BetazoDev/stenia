'use client';

import Dexie, { type EntityTable } from 'dexie';

import type { SessionSummary } from '@stenia/db';

import type { BootstrapExercise, ExerciseContext, SessionBootstrap } from './session-data';

/** Estado local de la sesión en vivo (IndexedDB). Sobrevive a recargas y cortes de red. */

export type RestState = {
  startedAt: number;
  targetSeconds: number;
  adjustSeconds: number;
  sessionExerciseId: string;
  setId: string;
  notifiedAt: number | null;
};

export type LocalBootstrap = { dayId: string; data: SessionBootstrap; savedAt: number };

export type LocalSession = {
  id: string;
  routineVersionId: string | null;
  routineDayId: string | null;
  dayName: string;
  gymProfileId: string | null;
  status: 'active' | 'completed' | 'discarded';
  startedAt: number;
  endedAt: number | null;
  pausedMs: number;
  pausedAt: number | null;
  effort: number | null;
  notes: string | null;
  currentIndex: number;
  rest: RestState | null;
  deload: boolean;
  blockWeek: number;
  blockWeeks: number;
  summary: SessionSummary | null;
  updatedAt: number;
};

export type ExerciseSnapshot = Pick<
  BootstrapExercise,
  'name' | 'slug' | 'loadType' | 'pattern' | 'primaryMuscles' | 'equipment' | 'media' | 'target' | 'targetText' | 'lastTime' | 'bestText' | 'bestE1rm' | 'bests' | 'ladder' | 'prescription' | 'alternatives' | 'notes'
>;

export type LocalExercise = {
  id: string;
  sessionId: string;
  routineExerciseId: string | null;
  exerciseId: string;
  sortOrder: number;
  startedAt: number | null;
  endedAt: number | null;
  substitutedFromExerciseId: string | null;
  notes: string | null;
  snapshot: ExerciseSnapshot;
  updatedAt: number;
};

export type LocalSet = {
  id: string;
  sessionExerciseId: string;
  sessionId: string;
  setNumber: number;
  weightKg: number | null;
  assistanceKg: number | null;
  addedWeightKg: number | null;
  reps: number | null;
  seconds: number | null;
  rir: number | null;
  target: Record<string, number | null> | null;
  startedAt: number | null;
  completedAt: number | null;
  restActualSeconds: number | null;
  restTargetSeconds: number | null;
  pain: boolean;
  notes: string | null;
  isRecord: boolean;
  updatedAt: number;
};

export type OutboxEntry = { seq?: number; entity: 'session' | 'exercise' | 'set'; entityId: string; queuedAt: number };

class SteniaLocalDb extends Dexie {
  bootstraps!: EntityTable<LocalBootstrap, 'dayId'>;
  sessions!: EntityTable<LocalSession, 'id'>;
  exercises!: EntityTable<LocalExercise, 'id'>;
  sets!: EntityTable<LocalSet, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;

  constructor() {
    super('stenia');
    this.version(1).stores({
      bootstraps: 'dayId, savedAt',
      sessions: 'id, status, startedAt',
      exercises: 'id, sessionId, [sessionId+sortOrder]',
      sets: 'id, sessionExerciseId, sessionId',
      outbox: '++seq, entity, entityId',
    });
  }
}

let instance: SteniaLocalDb | null = null;

export function localDb(): SteniaLocalDb {
  if (!instance) instance = new SteniaLocalDb();
  return instance;
}

export function snapshotFrom(ex: BootstrapExercise | (ExerciseContext & Pick<BootstrapExercise, 'prescription' | 'alternatives' | 'notes'>)): ExerciseSnapshot {
  return {
    name: ex.name,
    slug: ex.slug,
    loadType: ex.loadType,
    pattern: ex.pattern,
    primaryMuscles: ex.primaryMuscles,
    equipment: ex.equipment,
    media: ex.media,
    target: ex.target,
    targetText: ex.targetText,
    lastTime: ex.lastTime,
    bestText: ex.bestText,
    bestE1rm: ex.bestE1rm,
    bests: ex.bests,
    ladder: ex.ladder,
    prescription: ex.prescription,
    alternatives: ex.alternatives,
    notes: ex.notes,
  };
}

export async function enqueue(entity: OutboxEntry['entity'], entityId: string) {
  await localDb().outbox.add({ entity, entityId, queuedAt: Date.now() });
}
