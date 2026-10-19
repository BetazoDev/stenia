'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';

import { startJobAction } from './actions';

type JobRow = { id: string; type: string; status: string; progress: number; total: number; message: string | null; startedAt: string; finishedAt: string | null };
type Counts = {
  foods: { total: number; usda: number; off: number; reviewed: number; ai: number } | undefined;
  exercises: { total: number; reviewed: number; english: number } | undefined;
};

const fmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mexico_City' });

/** Catálogos y traducciones: lanza tareas largas y muestra su avance. */
export function JobsPanel({ jobs, labels, counts, aiReady }: { jobs: JobRow[]; labels: Record<string, string>; counts: Counts; aiReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const running = jobs.some((j) => j.status === 'running');

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(t);
  }, [running, router]);

  const launch = (type: string) =>
    start(async () => {
      const r = await startJobAction(type);
      setMessage(r.ok ? null : r.message);
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl">Catálogos y traducciones</h2>
        <p className="text-sm text-text-2">
          Alimentos: {counts.foods?.usda ?? 0} USDA ({counts.foods?.reviewed ?? 0} revisados, {counts.foods?.ai ?? 0} refinados con IA) y {counts.foods?.off ?? 0} de Open Food Facts.
          Ejercicios: {counts.exercises?.total ?? 0} ({counts.exercises?.english ?? 0} con nombre aún en inglés).
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {Object.entries(labels).map(([type, label]) => (
          <Button key={type} variant="secondary" size="sm" disabled={pending || (!aiReady && type.endsWith('_ai'))} onClick={() => launch(type)}>
            {label}
          </Button>
        ))}
      </div>
      {!aiReady ? <p className="text-sm text-text-3">Las tareas con IA necesitan una API key configurada.</p> : null}
      {message ? (
        <p role="alert" className="text-sm text-down">
          {message}
        </p>
      ) : null}
      {jobs.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{labels[j.type] ?? j.type}</span>
                {j.status === 'running' ? (
                  <span className="flex items-center gap-2 text-sm text-text-2">
                    <Loader2 strokeWidth={1.5} className="size-4 animate-spin" />
                    {j.total > 0 ? `${j.progress}/${j.total}` : 'Iniciando'}
                  </span>
                ) : (
                  <Chip tone={j.status === 'done' ? 'up' : 'down'}>{j.status === 'done' ? 'Lista' : 'Error'}</Chip>
                )}
              </div>
              <span className="text-[12px] text-text-3">
                {fmt.format(new Date(j.startedAt))}
                {j.message ? ` · ${j.message}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
