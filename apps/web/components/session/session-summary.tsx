'use client';

import {
  formatClock,
  formatDurationMinutes,
  kgToUnit,
  RECORD_LABELS_ES,
  sessionElapsedMs,
  sessionStats,
  type RecordType,
  type WeightUnit,
} from '@stenia/core';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Metric } from '@/components/ui/metric';
import type { LocalExercise, LocalSession, LocalSet } from '@/lib/local-db';
import { flushOutbox } from '@/lib/sync-client';
import { cn } from '@/lib/utils';

import { toLogged } from './session-actions';

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(n);

function Delta({
  value,
  unit,
  invert = false,
}: {
  value: number | null | undefined;
  unit: string;
  invert?: boolean;
}) {
  if (value === null || value === undefined || value === 0)
    return <span className="text-text-3">= vs. anterior</span>;
  const better = invert ? value < 0 : value > 0;
  return (
    <span className={cn('tnum', better ? 'text-up' : 'text-down')}>
      {value > 0 ? '+' : ''}
      {fmt(value)}
      {unit} vs. anterior
    </span>
  );
}

/** Resumen al terminar (sección 7): duración, volumen, récords y comparación con la sesión anterior del mismo día. */
export function SessionSummaryView({
  session,
  exercises,
  sets,
  unit = 'kg',
}: {
  session: LocalSession;
  exercises: LocalExercise[];
  sets: LocalSet[];
  unit?: WeightUnit;
}) {
  const w = (kg: number) => kgToUnit(kg, unit);
  const [syncState, setSyncState] = useState<'pending' | 'ok' | 'offline'>('pending');

  useEffect(() => {
    let alive = true;
    void flushOutbox().then((r) => {
      if (alive) setSyncState(r.ok && r.pending === 0 ? 'ok' : 'offline');
    });
    return () => {
      alive = false;
    };
  }, []);

  if (session.status === 'discarded') {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl">Sesión descartada</h1>
        <Button asChild>
          <Link href="/hoy">Volver a Hoy</Link>
        </Button>
      </div>
    );
  }

  const end = session.endedAt ?? session.updatedAt;
  const durationSec = Math.round(
    sessionElapsedMs(
      { startedAt: session.startedAt, pausedMs: session.pausedMs, pausedAt: null, endedAt: end },
      end,
    ) / 1000,
  );
  const done = sets.filter((s) => s.completedAt !== null);
  const stats = sessionStats(
    done.map((s) => ({ ...toLogged(s), restActualSeconds: s.restActualSeconds })),
    durationSec,
  );
  const summary = session.summary;
  const previous = summary?.previous ?? null;
  const records =
    summary?.records ??
    done
      .filter((s) => s.isRecord)
      .map((s) => ({
        exerciseId: exercises.find((e) => e.id === s.sessionExerciseId)?.exerciseId ?? '',
        type: 'max_e1rm',
        value: 0,
      }));
  const nameOf = (exerciseId: string) =>
    exercises.find((e) => e.exerciseId === exerciseId)?.snapshot.name ?? 'Ejercicio';

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">{session.dayName} · resumen</span>
        <h1 className="text-4xl md:text-5xl">Sesión completa</h1>
        <p className="text-sm text-text-3">
          {syncState === 'ok'
            ? 'Sincronizada.'
            : syncState === 'offline'
              ? 'Guardada en el teléfono; se sincroniza al volver la conexión.'
              : 'Sincronizando…'}
        </p>
      </header>

      <Card className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Metric label="Duración" value={formatDurationMinutes(durationSec / 60)} />
          {previous ? (
            <Delta
              value={Math.round((durationSec - previous.durationSec) / 60)}
              unit=" min"
              invert
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <Metric label="Volumen" value={fmt(w(stats.volumeKg))} unit={unit} />
          {previous ? (
            <Delta value={Math.round(w(stats.volumeKg - previous.volumeKg))} unit={` ${unit}`} />
          ) : null}
        </div>
        <Metric label="Series" value={stats.completedSets} />
        <div className="flex flex-col gap-1">
          <Metric
            label="Descanso medio"
            value={stats.avgRestSec !== null ? formatClock(stats.avgRestSec) : '—'}
          />
          {previous && stats.avgRestSec !== null && previous.avgRestSec !== null ? (
            <Delta value={stats.avgRestSec - previous.avgRestSec} unit=" s" invert />
          ) : null}
        </div>
      </Card>

      {records.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Récords</h2>
          <ul className="flex flex-col gap-2">
            {records.map((r, i) => (
              <li
                key={`${r.exerciseId}-${r.type}-${i}`}
                className="flex items-center justify-between gap-3 rounded-input border border-accent/50 px-4 py-3"
              >
                <span>{nameOf(r.exerciseId)}</span>
                <span className="text-sm text-text-2">
                  {RECORD_LABELS_ES[r.type as RecordType] ?? r.type}
                  {r.value && r.type !== 'new_variant'
                    ? r.type === 'longest_isometric'
                      ? ` · ${fmt(r.value)} s`
                      : r.type === 'max_reps_at_weight'
                        ? ` · ${fmt(r.value)} reps`
                        : ` · ${fmt(w(r.value))} ${unit}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Por ejercicio</h2>
        <ol className="flex flex-col divide-y divide-border rounded-card border border-border">
          {exercises.map((e, i) => {
            const es = done.filter((s) => s.sessionExerciseId === e.id);
            const dur = e.startedAt ? Math.round(((e.endedAt ?? end) - e.startedAt) / 1000) : 0;
            const vol = es.reduce(
              (acc, s) => acc + (s.weightKg ?? s.addedWeightKg ?? 0) * (s.reps ?? 0),
              0,
            );
            return (
              <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                <span className="label w-6 tnum">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{e.snapshot.name}</p>
                  <p className="text-sm text-text-3 tnum">
                    {es.length} series · {formatClock(dur)}
                    {vol > 0 ? ` · ${fmt(w(vol))} ${unit}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {session.effort || session.notes ? (
        <Card className="flex flex-col gap-2">
          {session.effort ? <p>Esfuerzo percibido: {session.effort}/10</p> : null}
          {session.notes ? <p className="text-text-2">{session.notes}</p> : null}
        </Card>
      ) : null}

      <Button asChild size="lg">
        <Link href="/hoy">Volver a Hoy</Link>
      </Button>
    </div>
  );
}
