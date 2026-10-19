'use client';

import { useEffect, useRef, useState } from 'react';

/** Re-render periódico para pintar cronómetros; el valor siempre se calcula desde marcas de tiempo. */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

type WakeLockSentinelLike = { release: () => Promise<void>; released: boolean };

/** Mantiene la pantalla encendida con Screen Wake Lock cuando el navegador lo permite. */
export function useWakeLock(active: boolean) {
  const sentinel = useRef<WakeLockSentinelLike | null>(null);
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  useEffect(() => {
    if (!active || !supported) return;
    let cancelled = false;
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
        const s = await nav.wakeLock?.request('screen');
        if (s && !cancelled) sentinel.current = s;
      } catch {
        // Batería baja o pestaña oculta: se reintenta al volver.
      }
    };
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel.current || sentinel.current.released)) void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel.current?.release().catch(() => undefined);
      sentinel.current = null;
    };
  }, [active, supported]);
  return supported;
}

let audioCtx: AudioContext | null = null;

/** Prepara el audio en un gesto del usuario (los navegadores lo exigen). */
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx && Ctx) audioCtx = new Ctx();
    if (audioCtx?.state === 'suspended') void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

/** Aviso de fin de descanso: dos tonos y vibración donde exista. */
export function restEndAlert() {
  try {
    if (audioCtx) {
      const t0 = audioCtx.currentTime;
      for (const [i, freq] of [880, 1175].entries()) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.22 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + i * 0.22);
        osc.stop(t0 + i * 0.22 + 0.2);
      }
    }
  } catch {
    // Sin audio disponible.
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Sin vibración.
  }
}

/** Programa (o cancela) la notificación push de fin de descanso para cuando la PWA está en segundo plano. */
export async function scheduleRestPush(endsAt: number | null, body: string) {
  try {
    await fetch('/api/push/rest', {
      method: endsAt ? 'POST' : 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: endsAt ? JSON.stringify({ endsAt, body }) : undefined,
      keepalive: true,
    });
  } catch {
    // Sin conexión: queda el aviso local al volver a la app.
  }
}
