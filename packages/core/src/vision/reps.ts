import { LM, type Landmark } from '../progress/pose';
import { normalizeText } from '../routine/catalog';

/**
 * Conteo de repeticiones por cámara (Fase 4) a partir de landmarks de MediaPipe. Máquina de estados con
 * suavizado y histéresis: una repetición cuenta al completar el ciclo y las incompletas se reportan aparte.
 */

export type RepExercise = 'squat' | 'pushup' | 'pullup';

export const REP_EXERCISE_LABELS_ES: Record<RepExercise, string> = {
  squat: 'Sentadilla',
  pushup: 'Lagartija',
  pullup: 'Dominada',
};

export const REP_CAMERA_TIPS_ES: Record<RepExercise, string> = {
  squat: 'Ponte de perfil a 2–3 m, con todo el cuerpo en cuadro.',
  pushup: 'Teléfono en el piso, de lado, a 1.5–2 m; que se vean hombros, codos y tobillos.',
  pullup: 'De frente o de perfil, que se vean la barra, la cabeza y los codos.',
};

type Thresholds = { top: number; bottom: number; partial: number };

/** Ángulo articular en grados (rodilla en sentadilla, codo en lagartija y dominada). */
export const THRESHOLDS: Record<RepExercise, Thresholds> = {
  // Arriba = rodilla extendida; abajo = cerca de paralelo.
  squat: { top: 160, bottom: 100, partial: 135 },
  // Arriba = brazos extendidos; abajo = codo ≤ 90°.
  pushup: { top: 155, bottom: 90, partial: 120 },
  // En dominada «abajo» es colgado (codo extendido) y «arriba» es codo flexionado con la barbilla sobre las manos.
  pullup: { top: 150, bottom: 75, partial: 110 },
};

/** Detecta si un ejercicio de la rutina se puede contar con cámara. */
export function repExerciseFor(input: { name: string; slug?: string; pattern?: string }): RepExercise | null {
  const text = normalizeText(`${input.name} ${input.slug ?? ''}`);
  if (/handstand|parada de manos|pike|en pica|pino/.test(text)) return null;
  if (/push ?up|lagartija|flexion/.test(text)) return 'pushup';
  if (/pull ?up|chin ?up|dominada/.test(text)) return 'pullup';
  if (input.pattern === 'squat' && /squat|sentadilla/.test(text) && !/split|dividida|bulgara|pistol|hack|prensa|press/.test(text)) return 'squat';
  return null;
}

export function jointAngle(a: Landmark, b: Landmark, c: Landmark, aspect = 1): number {
  const abx = (a.x - b.x) * aspect;
  const aby = a.y - b.y;
  const cbx = (c.x - b.x) * aspect;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

export type FrameMetrics = { angle: number | null; chinAboveHands?: boolean; hipSag?: boolean };

const visible = (p: Landmark | undefined, min = 0.5): p is Landmark => !!p && (p.visibility ?? 1) >= min;

function sideAngle(lm: Landmark[], idx: [number, number, number][], aspect: number): number | null {
  // Lado más visible (la cámara suele ver uno de perfil).
  const scored = idx
    .map(([a, b, c]) => ({ pts: [lm[a], lm[b], lm[c]] as const, score: Math.min(...[lm[a], lm[b], lm[c]].map((p) => p?.visibility ?? 1)) }))
    .filter((s) => s.pts.every((p) => visible(p, 0.4)))
    .sort((x, y) => y.score - x.score);
  const best = scored[0];
  if (!best) return null;
  const [a, b, c] = best.pts as [Landmark, Landmark, Landmark];
  return jointAngle(a, b, c, aspect);
}

export function frameMetrics(exercise: RepExercise, lm: Landmark[] | null, aspect = 1): FrameMetrics {
  if (!lm || lm.length < 33) return { angle: null };
  if (exercise === 'squat') {
    return {
      angle: sideAngle(
        lm,
        [
          [LM.leftHip, LM.leftKnee, LM.leftAnkle],
          [LM.rightHip, LM.rightKnee, LM.rightAnkle],
        ],
        aspect,
      ),
    };
  }
  const elbow = sideAngle(
    lm,
    [
      [LM.leftShoulder, LM.leftElbow, LM.leftWrist],
      [LM.rightShoulder, LM.rightElbow, LM.rightWrist],
    ],
    aspect,
  );
  if (exercise === 'pushup') {
    const body = sideAngle(
      lm,
      [
        [LM.leftShoulder, LM.leftHip, LM.leftAnkle],
        [LM.rightShoulder, LM.rightHip, LM.rightAnkle],
      ],
      aspect,
    );
    return { angle: elbow, hipSag: body !== null && body < 150 };
  }
  const nose = lm[LM.nose];
  const wrists = [lm[LM.leftWrist], lm[LM.rightWrist]].filter((p): p is Landmark => visible(p, 0.4));
  const handsY = wrists.length ? wrists.reduce((a, p) => a + p.y, 0) / wrists.length : null;
  return { angle: elbow, chinAboveHands: visible(nose, 0.4) && handsY !== null ? nose.y < handsY + 0.02 : undefined };
}

export type CounterState = {
  exercise: RepExercise;
  reps: number;
  partials: number;
  phase: 'start' | 'moving' | 'end';
  smoothed: number | null;
  /** Extremo alcanzado en el ciclo actual (mínimo del ángulo en sentadilla y lagartija; en dominada también). */
  extreme: number | null;
  pending: 'start' | 'end' | null;
  pendingFrames: number;
  cue: string | null;
  lastRepAt: number | null;
};

export function createCounter(exercise: RepExercise): CounterState {
  return { exercise, reps: 0, partials: 0, phase: 'start', smoothed: null, extreme: null, pending: null, pendingFrames: 0, cue: null, lastRepAt: null };
}

const CUES: Record<RepExercise, string> = {
  squat: 'Baja más: rodillas a unos 90°.',
  pushup: 'Baja hasta que el codo llegue a 90°.',
  pullup: 'Sube hasta pasar la barbilla sobre la barra.',
};

/**
 * Avanza un cuadro. En las tres variantes el ciclo es: posición inicial (ángulo alto) → extremo (ángulo bajo) →
 * posición inicial. Se exige `confirmFrames` cuadros seguidos para cambiar de fase.
 */
export function stepCounter(state: CounterState, metrics: FrameMetrics, now = 0, options: { alpha?: number; confirmFrames?: number } = {}): CounterState {
  if (metrics.angle === null) return state;
  const alpha = options.alpha ?? 0.5;
  const confirm = options.confirmFrames ?? 2;
  const t = THRESHOLDS[state.exercise];
  const smoothed = state.smoothed === null ? metrics.angle : state.smoothed + alpha * (metrics.angle - state.smoothed);
  const next: CounterState = { ...state, smoothed, extreme: state.extreme === null ? smoothed : Math.min(state.extreme, smoothed) };
  if (state.exercise === 'pushup' && metrics.hipSag) next.cue = 'Cadera alineada: aprieta abdomen y glúteos.';

  const atStart = smoothed >= t.top;
  const reachedEnd = smoothed <= t.bottom && (state.exercise !== 'pullup' || metrics.chinAboveHands !== false);
  const want: 'start' | 'end' | null = atStart ? 'start' : reachedEnd ? 'end' : null;

  if (want && want !== (state.phase === 'moving' ? null : state.phase)) {
    next.pendingFrames = state.pending === want ? state.pendingFrames + 1 : 1;
    next.pending = want;
    if (next.pendingFrames >= confirm) {
      next.pending = null;
      next.pendingFrames = 0;
      if (want === 'end') {
        next.phase = 'end';
      } else {
        if (state.phase === 'end') {
          next.reps = state.reps + 1;
          next.lastRepAt = now;
          next.cue = null;
        } else if (state.phase === 'moving' && (next.extreme ?? 180) <= t.partial) {
          next.partials = state.partials + 1;
          next.cue = CUES[state.exercise];
        }
        next.phase = 'start';
        next.extreme = smoothed;
      }
    }
  } else {
    next.pending = null;
    next.pendingFrames = 0;
    if (state.phase === 'start' && smoothed < t.top - 5) next.phase = 'moving';
  }
  return next;
}
