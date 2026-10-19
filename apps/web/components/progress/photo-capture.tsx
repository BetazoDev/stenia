'use client';

import { PHOTO_POSE_LABELS_ES, evaluatePhotoPose, type Landmark, type PhotoPose } from '@stenia/core';
import { Camera, CheckCircle2, ImageUp, RotateCcw, SwitchCamera, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { uploadPhotoAction } from '@/app/(app)/progreso/actions';
import { Button } from '@/components/ui/button';
import { drawSkeleton, loadPoseLandmarker, toLandmarks } from '@/lib/pose-client';
import { cn } from '@/lib/utils';

const GUIDES: Record<PhotoPose, string> = {
  front: 'De frente, brazos ligeramente separados del cuerpo, pies a la anchura de la cadera.',
  side: 'De perfil (lado derecho a la cámara), brazos relajados al frente, mirada al frente.',
  back: 'De espaldas, brazos ligeramente separados, pies a la anchura de la cadera.',
};

const MAX_SIDE = 1280;

type Captured = { blob: Blob; url: string; landmarks: Landmark[] | null; issues: string[]; ok: boolean; modelError: boolean };

async function analyze(canvas: HTMLCanvasElement, pose: PhotoPose): Promise<Pick<Captured, 'landmarks' | 'issues' | 'ok' | 'modelError'>> {
  try {
    const landmarker = await loadPoseLandmarker('IMAGE');
    const result = landmarker.detect(canvas);
    const landmarks = toLandmarks(result.landmarks[0]);
    const check = evaluatePhotoPose(landmarks, pose);
    return { landmarks, issues: check.issues, ok: check.ok, modelError: false };
  } catch {
    return { landmarks: null, issues: ['No se pudo cargar el detector de pose; revisa el encuadre a ojo.'], ok: false, modelError: true };
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.85));
}

/** Captura guiada (cámara con cuenta regresiva o archivo) con validación de pose y encuadre en el dispositivo. */
export function PhotoCapture() {
  const router = useRouter();
  const [pose, setPose] = useState<PhotoPose>('front');
  const [cameraOn, setCameraOn] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => {
        setError('No se pudo abrir la cámara. Revisa los permisos o sube una foto.');
        setCameraOn(false);
      });
    // Precarga el detector mientras el usuario se acomoda.
    void loadPoseLandmarker('IMAGE').catch(() => undefined);
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOn, facing]);

  useEffect(() => () => window.clearInterval(timerRef.current ?? undefined), []);

  async function finish(source: CanvasImageSource, width: number, height: number) {
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    setAnalyzing(true);
    const result = await analyze(canvas, pose);
    const blob = await canvasToBlob(canvas);
    setAnalyzing(false);
    setCaptured((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { blob, url: URL.createObjectURL(blob), ...result };
    });
    const preview = previewRef.current;
    if (preview) {
      preview.width = canvas.width;
      preview.height = canvas.height;
      const pctx = preview.getContext('2d');
      if (pctx) {
        pctx.drawImage(canvas, 0, 0);
        if (result.landmarks) drawSkeleton(pctx, result.landmarks, canvas.width, canvas.height, result.ok ? 'rgba(63,191,127,0.9)' : 'rgba(224,165,38,0.9)');
      }
    }
  }

  async function captureFromVideo() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    await finish(video, video.videoWidth, video.videoHeight);
    setCameraOn(false);
  }

  /** Cuenta regresiva de 5 s para alejarse del teléfono. */
  function startCountdown() {
    let n = 5;
    setCountdown(n);
    timerRef.current = window.setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        return;
      }
      window.clearInterval(timerRef.current ?? undefined);
      setCountdown(null);
      void captureFromVideo();
    }, 1000);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      await finish(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
    } catch {
      setError('No se pudo leer la imagen.');
    }
  }

  function save() {
    if (!captured) return;
    const form = new FormData();
    form.set('pose', pose);
    form.set('file', new File([captured.blob], `${pose}.jpg`, { type: 'image/jpeg' }));
    if (captured.landmarks) form.set('landmarks', JSON.stringify(captured.landmarks));
    startSaving(async () => {
      const result = await uploadPhotoAction(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      URL.revokeObjectURL(captured.url);
      setCaptured(null);
      const order: PhotoPose[] = ['front', 'side', 'back'];
      const next = order[order.indexOf(pose) + 1];
      if (next) setPose(next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pose">
        {(['front', 'side', 'back'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={pose === p}
            onClick={() => {
              setPose(p);
              setCaptured(null);
            }}
            className={cn('h-11 rounded-pill border text-sm transition-colors', pose === p ? 'border-text bg-text text-bg' : 'border-border-strong text-text-2 hover:text-text')}
          >
            {PHOTO_POSE_LABELS_ES[p]}
          </button>
        ))}
      </div>
      <p className="text-sm text-text-2">
        {GUIDES[pose]} Cuerpo completo de la cabeza a los pies, cámara a la altura del ombligo a unos 2–3 m, misma luz y ropa
        en cada toma.
      </p>

      {cameraOn ? (
        <div className="relative overflow-hidden rounded-card border border-border bg-surface">
          <video ref={videoRef} playsInline muted className={cn('aspect-[3/4] w-full object-cover', facing === 'user' && '-scale-x-100')} />
          <div className="pointer-events-none absolute inset-x-[18%] inset-y-[4%] rounded-card border border-dashed border-white/40" aria-hidden />
          {countdown !== null ? (
            <span className="absolute inset-0 grid place-items-center font-display text-8xl tracking-display text-white tnum" aria-live="assertive">
              {countdown}
            </span>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 p-4">
            <Button variant="secondary" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Cambiar cámara">
              <SwitchCamera strokeWidth={1.5} />
            </Button>
            <Button onClick={startCountdown} disabled={countdown !== null}>
              <Camera strokeWidth={1.5} /> Tomar en 5 s
            </Button>
            <Button variant="secondary" onClick={() => setCameraOn(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setError(null);
              setCaptured(null);
              setCameraOn(true);
            }}
          >
            <Camera strokeWidth={1.5} /> Usar cámara
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <ImageUp strokeWidth={1.5} /> Subir foto
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} aria-label="Elegir foto" />
        </div>
      )}

      {analyzing ? <p className="text-sm text-text-2">Revisando pose y encuadre…</p> : null}

      <canvas ref={previewRef} className={cn('h-auto max-h-[70vh] w-auto max-w-full self-center rounded-card border border-border', !captured && 'hidden')} />

      {captured ? (
        <div className="flex flex-col gap-4">
          {captured.ok ? (
            <p className="flex items-center gap-2 text-up">
              <CheckCircle2 strokeWidth={1.5} className="size-5" /> Pose y encuadre correctos.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {captured.issues.map((issue) => (
                <li key={issue} className="flex items-start gap-2 text-down">
                  <TriangleAlert strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" /> {issue}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={save} disabled={saving || (!captured.ok && !captured.modelError)}>
              {saving ? 'Guardando…' : `Guardar ${PHOTO_POSE_LABELS_ES[pose].toLowerCase()}`}
            </Button>
            <Button variant="secondary" onClick={() => setCaptured(null)}>
              <RotateCcw strokeWidth={1.5} /> Repetir
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}
