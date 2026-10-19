'use client';

import { REP_CAMERA_TIPS_ES, REP_EXERCISE_LABELS_ES, createCounter, frameMetrics, stepCounter, type CounterState, type RepExercise } from '@stenia/core';
import { Camera, Check, RotateCcw, SwitchCamera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { drawSkeleton, loadPoseLandmarker, toLandmarks } from '@/lib/pose-client';
import { cn } from '@/lib/utils';

/**
 * Conteo de repeticiones con la cámara (MediaPipe en el dispositivo; el video nunca sale del teléfono).
 * Al terminar, las repeticiones contadas se pasan a la serie actual para confirmarlas.
 */
export function RepCounter({ exercise, onUse }: { exercise: RepExercise; onUse: (reps: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const counterRef = useRef<CounterState>(createCounter(exercise));
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [view, setView] = useState<{ reps: number; partials: number; cue: string | null; angle: number | null; tracking: boolean }>({ reps: 0, partials: 0, cue: null, angle: null, tracking: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let lastUi = 0;
    (async () => {
      try {
        const [landmarker, media] = await Promise.all([
          loadPoseLandmarker('VIDEO'),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 720 } }, audio: false }),
        ]);
        stream = media;
        const video = videoRef.current;
        if (stopped || !video) return;
        video.srcObject = media;
        await video.play();
        setStatus('running');
        const loop = () => {
          if (stopped) return;
          const canvas = canvasRef.current;
          if (video.readyState >= 2 && canvas) {
            const now = performance.now();
            const result = landmarker.detectForVideo(video, now);
            const lm = toLandmarks(result.landmarks[0]);
            const aspect = video.videoWidth / Math.max(1, video.videoHeight);
            const before = counterRef.current.reps;
            counterRef.current = stepCounter(counterRef.current, frameMetrics(exercise, lm, aspect), now);
            if (counterRef.current.reps > before) navigator.vibrate?.(40);
            if (canvas.width !== video.videoWidth) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              if (lm) drawSkeleton(ctx, lm, canvas.width, canvas.height);
            }
            if (now - lastUi > 120) {
              lastUi = now;
              const c = counterRef.current;
              setView({ reps: c.reps, partials: c.partials, cue: c.cue, angle: c.smoothed, tracking: lm !== null });
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch {
        setStatus('error');
        setError('No se pudo abrir la cámara o cargar el detector. Revisa los permisos.');
        setActive(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, facing, exercise]);

  const start = () => {
    counterRef.current = createCounter(exercise);
    setView({ reps: 0, partials: 0, cue: null, angle: null, tracking: false });
    setError(null);
    setStatus('loading');
    setActive(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-2">{REP_CAMERA_TIPS_ES[exercise]} El video se analiza en tu teléfono y no se guarda.</p>
      <div className="relative overflow-hidden rounded-card border border-border bg-black">
        <video ref={videoRef} playsInline muted className={cn('aspect-[3/4] w-full object-cover md:aspect-video', facing === 'user' && '-scale-x-100', !active && 'opacity-0')} />
        <canvas ref={canvasRef} className={cn('pointer-events-none absolute inset-0 h-full w-full object-cover', facing === 'user' && '-scale-x-100')} aria-hidden />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <div className="flex flex-col">
            <span className="label text-white/80">{REP_EXERCISE_LABELS_ES[exercise]}</span>
            <span className="font-display text-7xl leading-none tracking-display text-white tnum" aria-live="polite">
              {view.reps}
            </span>
            {view.partials > 0 ? <span className="text-sm text-white/70">{view.partials} incompleta(s)</span> : null}
          </div>
          {active ? <span className={cn('mt-1 size-3 rounded-pill', view.tracking ? 'bg-up' : 'bg-down')} aria-label={view.tracking ? 'Te detecta' : 'No te detecta'} /> : null}
        </div>
        {view.cue && active ? <p className="absolute inset-x-4 bottom-4 rounded-input bg-black/70 px-3 py-2 text-sm text-white">{view.cue}</p> : null}
        {!active ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">{status === 'loading' ? 'Cargando detector…' : 'Pulsa «Empezar» y colócate en cuadro.'}</div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {!active ? (
          <Button variant={view.reps > 0 ? 'secondary' : 'primary'} onClick={start}>
            <Camera strokeWidth={1.5} /> {view.reps > 0 ? 'Reanudar' : 'Empezar'}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => setActive(false)}>
            Pausar
          </Button>
        )}
        <Button variant="ghost" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Cambiar cámara">
          <SwitchCamera strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            counterRef.current = createCounter(exercise);
            setView({ reps: 0, partials: 0, cue: null, angle: null, tracking: view.tracking });
          }}
        >
          <RotateCcw strokeWidth={1.5} /> Reiniciar
        </Button>
        <Button
          className="ml-auto"
          variant={view.reps > 0 ? 'primary' : 'secondary'}
          disabled={view.reps === 0}
          onClick={() => {
            setActive(false);
            onUse(view.reps);
          }}
        >
          <Check strokeWidth={1.5} /> Usar {view.reps} reps
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      ) : null}
      <p className="text-[12px] text-text-3">El conteo es orientativo: revisa el número antes de guardar la serie.</p>
    </div>
  );
}
