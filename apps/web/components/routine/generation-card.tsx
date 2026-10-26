'use client';

import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isNetworkError } from '@/lib/network-error';
import { cn } from '@/lib/utils';

type Event = { stage: string; message: string; routineId?: string; generator?: 'llm' | 'template' };

const STAGES = [
  { key: 'profile', label: 'Leyendo tu perfil' },
  { key: 'choosing', label: 'Eligiendo ejercicios' },
  { key: 'validating', label: 'Validando' },
  { key: 'done', label: 'Listo' },
] as const;

const ORDER: Record<string, number> = {
  profile: 0,
  catalog: 0,
  choosing: 1,
  validating: 2,
  retry: 2,
  fallback: 2,
  saving: 3,
  done: 4,
};

/** Tarjeta de generación con estados en vivo (motivo de la sección 15 del PRD). */
export function GenerationCard() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [generator, setGenerator] = useState<'llm' | 'template' | null>(null);
  const [lost, setLost] = useState(false);
  const started = useRef(false);

  const run = useCallback(async () => {
    setError(null);
    setLost(false);
    setProgress(0);
    setDetail('');
    try {
      const response = await fetch('/api/routine/generate', { method: 'POST' });
      if (!response.ok || !response.body) throw new Error('No se pudo iniciar la generación.');
      const reader = response.body.getReader();
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
          const event = JSON.parse(line) as Event;
          if (event.stage === 'ping') continue;
          if (event.stage === 'error') {
            setError(event.message);
            return;
          }
          setProgress((p) => Math.max(p, ORDER[event.stage] ?? p));
          setDetail(event.message);
          if (event.stage === 'done') {
            setGenerator(event.generator ?? null);
            setTimeout(() => {
              router.replace('/rutina');
              router.refresh();
            }, 900);
          }
        }
      }
    } catch (e) {
      if (isNetworkError(e)) {
        // La rutina se sigue generando en el servidor; se puede ver en un momento.
        setLost(true);
        setError(
          'Se perdió la conexión (¿se bloqueó el teléfono?). Tu rutina se sigue armando: revísala en un minuto.',
        );
      } else setError(e instanceof Error ? e.message : 'Error de red al generar.');
    }
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  return (
    <Card className="flex flex-col gap-6 p-6">
      <ol className="flex flex-col gap-4" aria-live="polite">
        {STAGES.map((s, i) => {
          const state = progress > i ? 'done' : progress === i && !error ? 'active' : 'pending';
          return (
            <li key={s.key} className="flex items-center gap-4">
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-pill border',
                  state === 'done' && 'border-text bg-text text-bg',
                  state === 'active' && 'border-accent text-accent',
                  state === 'pending' && 'border-border text-text-3',
                )}
              >
                {state === 'done' ? (
                  <Check strokeWidth={2.5} className="size-4" />
                ) : state === 'active' ? (
                  <Loader2 strokeWidth={1.5} className="size-4 motion-safe:animate-spin" />
                ) : (
                  <span className="label">{i + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  'font-display text-2xl tracking-display',
                  state === 'pending' && 'text-text-3',
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {detail && !error ? <p className="text-sm text-text-3">{detail}</p> : null}
      {generator ? (
        <p className="text-sm text-text-2">
          {generator === 'llm'
            ? 'Rutina elegida por la IA y validada por las reglas.'
            : 'Rutina armada con la plantilla determinista (sin IA o tras fallar la validación).'}
        </p>
      ) : null}
      {error ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-down">
            {error}
          </p>
          <div className="flex gap-3">
            {lost ? (
              <Button onClick={() => router.push('/rutina')}>Ver mi rutina</Button>
            ) : (
              <Button onClick={() => void run()}>Reintentar</Button>
            )}
            <Button variant="secondary" onClick={() => router.push('/onboarding?resumen=1')}>
              Revisar respuestas
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
