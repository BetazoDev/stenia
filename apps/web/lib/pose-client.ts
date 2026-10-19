'use client';

import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from '@stenia/core';

/**
 * Carga perezosa de MediaPipe Pose Landmarker (modelo "lite"). El análisis ocurre en el dispositivo: la imagen no sale
 * del navegador para detectar la pose (docs/decisions.md).
 */
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const cache: Partial<Record<'IMAGE' | 'VIDEO', Promise<PoseLandmarker>>> = {};

export function loadPoseLandmarker(mode: 'IMAGE' | 'VIDEO'): Promise<PoseLandmarker> {
  const existing = cache[mode];
  if (existing) return existing;
  const created = (async () => {
    const { FilesetResolver, PoseLandmarker: PL } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    try {
      return await PL.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }, runningMode: mode, numPoses: 1 });
    } catch {
      return PL.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' }, runningMode: mode, numPoses: 1 });
    }
  })();
  cache[mode] = created;
  created.catch(() => {
    delete cache[mode];
  });
  return created;
}

export function toLandmarks(points: { x: number; y: number; z?: number; visibility?: number }[] | undefined): Landmark[] | null {
  if (!points || points.length < 33) return null;
  return points.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 0 }));
}

/** Conexiones principales del esqueleto para dibujar sobre la imagen. */
export const SKELETON: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32],
];

export function drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number, color = 'rgba(255,255,255,0.85)') {
  ctx.save();
  ctx.lineWidth = Math.max(2, width / 300);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const [a, b] of SKELETON) {
    const p = landmarks[a];
    const q = landmarks[b];
    if (!p || !q || (p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * width, p.y * height);
    ctx.lineTo(q.x * width, q.y * height);
    ctx.stroke();
  }
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    const p = landmarks[i];
    if (!p || (p.visibility ?? 1) < 0.4) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, Math.max(3, width / 200), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
