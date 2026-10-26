'use client';

import { Check, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { isNetworkError } from '@/lib/network-error';
import { cn } from '@/lib/utils';

const STAGES = [
  { key: 'targets', label: 'Calculando tus metas' },
  { key: 'choosing', label: 'Armando el menú' },
  { key: 'scaling', label: 'Ajustando porciones' },
  { key: 'done', label: 'Listo' },
] as const;
const ORDER: Record<string, number> = {
  targets: 0,
  foods: 0,
  choosing: 1,
  fallback: 1,
  scaling: 2,
  saving: 3,
  done: 4,
};

/** Genera el plan semanal mostrando el avance (NDJSON). */
export function PlanGenerator({
  label = 'Generar plan semanal',
  autoStart = false,
}: {
  label?: string;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const auto = useRef(false);

  const run = useCallback(async () => {
    setRunning(true);
    setStarted(true);
    setError(null);
    setProgress(0);
    try {
      const res = await fetch('/api/nutrition/plan', { method: 'POST' });
      if (!res.ok || !res.body) throw new Error('No se pudo iniciar la generación.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as { stage: string; message: string };
          if (e.stage === 'ping') continue;
          if (e.stage === 'error') {
            setError(e.message);
            continue;
          }
          setProgress((p) => Math.max(p, ORDER[e.stage] ?? p));
          setDetail(e.message);
        }
      }
      router.replace('/nutricion/plan');
      router.refresh();
    } catch (e) {
      if (isNetworkError(e)) {
        // El servidor sigue armando el plan aunque se haya cortado la conexión: se revisa solo cada pocos segundos.
        setError(
          'Se perdió la conexión (¿se bloqueó el teléfono?). El plan se sigue armando; esta pantalla se actualiza sola.',
        );
        setWaiting(true);
      } else setError(e instanceof Error ? e.message : 'Error de red.');
    } finally {
      setRunning(false);
    }
  }, [router]);

  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const t = window.setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 24) window.clearInterval(t);
    }, 8_000);
    return () => window.clearInterval(t);
  }, [waiting, router]);

  // Con ?generar=1 arranca solo (una vez, aun con el doble montaje de desarrollo).
  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(() => {
      if (auto.current) return;
      auto.current = true;
      void run();
    }, 0);
    return () => window.clearTimeout(t);
  }, [autoStart, run]);

  if (!started) {
    return (
      <Button onClick={() => void run()} disabled={running}>
        <Sparkles strokeWidth={1.5} /> {label}
      </Button>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
      aria-live="polite"
    >
      <ol className="flex flex-col gap-3">
        {STAGES.map((s, i) => {
          const state = progress > i ? 'done' : progress === i && running ? 'active' : 'pending';
          return (
            <li
              key={s.key}
              className={cn('flex items-center gap-3', state === 'pending' && 'text-text-3')}
            >
              {state === 'done' ? (
                <Check strokeWidth={1.5} className="size-5 text-up" />
              ) : state === 'active' ? (
                <Loader2 strokeWidth={1.5} className="size-5 animate-spin" />
              ) : (
                <span className="size-5" />
              )}
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>
      {detail && running ? <p className="text-sm text-text-3">{detail}</p> : null}
      {error ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-sm text-down">
            {error}
          </p>
          <Button variant="secondary" onClick={() => void run()}>
            Reintentar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
