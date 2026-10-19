/** Validación de pose y encuadre para fotos guiadas (sección 9.2, nivel 3) a partir de landmarks de MediaPipe. */

export type Landmark = { x: number; y: number; z?: number; visibility?: number };
export type PhotoPose = 'front' | 'side' | 'back';

export const PHOTO_POSE_LABELS_ES: Record<PhotoPose, string> = { front: 'Frente', side: 'Perfil', back: 'Espalda' };

// Índices del modelo Pose Landmarker (33 puntos).
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export type PoseCheck = { ok: boolean; issues: string[]; detected: PhotoPose | null };

const vis = (p: Landmark | undefined) => p?.visibility ?? 1;
const inFrame = (p: Landmark | undefined, margin = 0.02) => !!p && p.x > margin && p.x < 1 - margin && p.y > margin && p.y < 1 - margin;

export function evaluatePhotoPose(landmarks: Landmark[] | null | undefined, expected: PhotoPose): PoseCheck {
  if (!landmarks || landmarks.length < 33) return { ok: false, issues: ['No se detecta una persona en la imagen.'], detected: null };
  const g = (i: number) => landmarks[i];
  const issues: string[] = [];
  const key = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, LM.leftAnkle, LM.rightAnkle];
  const anklesVisible = [LM.leftAnkle, LM.rightAnkle].some((i) => vis(g(i)) > 0.5 && inFrame(g(i)));
  if (!anklesVisible) issues.push('Aléjate: deben verse los tobillos.');
  const head = g(LM.nose);
  if (!inFrame(head, 0.03)) issues.push('Deja espacio sobre la cabeza.');
  const topY = Math.min(...[LM.nose, LM.leftShoulder, LM.rightShoulder].map((i) => g(i)?.y ?? 1));
  const bottomY = Math.max(...[LM.leftAnkle, LM.rightAnkle].map((i) => g(i)?.y ?? 0));
  const height = bottomY - topY;
  if (anklesVisible && height < 0.55) issues.push('Acércate un poco: ocupa más altura de la imagen.');
  if (height > 0.95) issues.push('Aléjate un poco.');
  const hipX = ((g(LM.leftHip)?.x ?? 0.5) + (g(LM.rightHip)?.x ?? 0.5)) / 2;
  if (hipX < 0.35 || hipX > 0.65) issues.push('Colócate al centro de la imagen.');
  if (key.some((i) => vis(g(i)) < 0.3)) issues.push('Mejora la luz o quita obstáculos para que se vea todo el cuerpo.');

  const shoulderWidth = Math.abs((g(LM.leftShoulder)?.x ?? 0) - (g(LM.rightShoulder)?.x ?? 0));
  const ratio = height > 0 ? shoulderWidth / height : 0;
  const faceVisible = vis(head) > 0.6;
  let detected: PhotoPose;
  if (ratio < 0.09) detected = 'side';
  else detected = faceVisible ? 'front' : 'back';
  if (detected !== expected) {
    issues.push(
      expected === 'side' ? 'Gira de perfil (de lado a la cámara).' : expected === 'front' ? 'Ponte de frente a la cámara.' : 'Ponte de espaldas a la cámara.',
    );
  }
  // Brazos separados del torso para comparar contornos.
  if (expected !== 'side') {
    const lw = g(LM.leftWrist);
    const rw = g(LM.rightWrist);
    const lh = g(LM.leftHip);
    const rh = g(LM.rightHip);
    if (lw && rw && lh && rh && Math.abs(lw.x - lh.x) < 0.02 && Math.abs(rw.x - rh.x) < 0.02) issues.push('Separa un poco los brazos del cuerpo.');
  }
  return { ok: issues.length === 0, issues, detected };
}
