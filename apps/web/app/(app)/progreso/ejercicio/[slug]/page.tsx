import { RECORD_LABELS_ES, type RecordType } from '@stenia/core';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ExerciseCharts } from '@/components/progress/exercise-charts';
import { Delta } from '@/components/progress/delta';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Metric } from '@/components/ui/metric';
import { getExerciseProgress } from '@/lib/progress';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Progreso por ejercicio' };

export default async function ExerciseProgressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { user } = await requireSession();
  const { slug } = await params;
  const data = await getExerciseProgress(user.id, slug);
  if (!data) notFound();
  const { exercise: ex, points } = data;
  const mode = ex.loadType === 'isometric' ? 'seconds' : points.some((p) => p.bestWeight) ? 'load' : 'reps';
  const first = points[0];
  const last = points[points.length - 1];
  const headline =
    mode === 'load'
      ? { label: '1RM estimado', value: last?.e1rm ?? last?.bestWeight ?? null, from: first?.e1rm ?? first?.bestWeight ?? null, unit: 'kg' }
      : mode === 'reps'
        ? { label: 'Mejores reps', value: last?.bestReps ?? null, from: first?.bestReps ?? null, unit: 'reps' }
        : { label: 'Mejor tiempo', value: last?.bestSeconds ?? null, from: first?.bestSeconds ?? null, unit: 's' };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/progreso" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Progreso
        </Link>
        <h1 className="text-4xl leading-tight">{ex.nameEs}</h1>
        <Link href={`/ejercicios/${ex.slug}`} className="text-sm text-text-2 underline underline-offset-4">
          Ver ficha del ejercicio
        </Link>
      </header>

      {points.length === 0 ? (
        <EmptyState title="Sin series registradas" description="Cuando termines una sesión con este ejercicio verás aquí su evolución." />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col gap-2">
              <Metric label={headline.label} value={headline.value?.toLocaleString('es-MX') ?? '—'} unit={headline.unit} />
              {headline.value !== null && headline.from !== null && points.length > 1 ? (
                <span className="text-sm text-text-3">
                  Desde el inicio <Delta value={headline.value - headline.from} unit={` ${headline.unit}`} />
                </span>
              ) : null}
            </Card>
            <Card className="flex flex-col gap-2">
              <Metric label="Sesiones" value={points.length} />
              {last ? <span className="text-sm text-text-3">Última: {formatShortDate(new Date(`${last.date}T12:00:00Z`))}</span> : null}
            </Card>
          </section>
          <Card>
            <ExerciseCharts points={points} mode={mode} />
          </Card>
        </>
      )}

      {data.records.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="ex-records">
          <h2 id="ex-records" className="text-2xl">
            Récords
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {data.records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex flex-col">
                  <span>{RECORD_LABELS_ES[r.type as RecordType] ?? r.type}</span>
                  <span className="text-sm text-text-3">{formatShortDate(r.achievedAt)}</span>
                </span>
                <span className="font-display text-lg tracking-display tnum">{r.value.toLocaleString('es-MX')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
