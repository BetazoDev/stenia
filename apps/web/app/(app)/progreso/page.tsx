import { MUSCLE_LABELS_ES, RECORD_LABELS_ES, type MuscleGroup, type RecordType } from '@stenia/core';
import { CalendarCheck, Camera, ChevronRight, Ruler } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { MuscleMap } from '@/components/muscle-map';
import { AdherenceBars } from '@/components/progress/adherence-bars';
import { Delta } from '@/components/progress/delta';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Metric } from '@/components/ui/metric';
import { latestBodyComposition } from '@/lib/body';
import { getProgressOverview } from '@/lib/progress';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Progreso' };

const fmtKg = (v: number) => `${Math.round(v).toLocaleString('es-MX')}`;
const fmtDuration = (s: number) => `${Math.round(s / 60)} min`;

function recordValue(type: string, value: number) {
  if (type === 'longest_isometric') return `${value} s`;
  if (type === 'max_volume') return `${fmtKg(value)} kg`;
  if (type === 'max_reps_at_weight') return `${value} reps`;
  if (type === 'new_variant') return `nivel ${value}`;
  return `${value.toLocaleString('es-MX')} kg`;
}

export default async function ProgressPage() {
  const { user } = await requireSession();
  const [data, body] = await Promise.all([getProgressOverview(user.id), latestBodyComposition(user.id)]);
  const muscles = [...new Set([...Object.keys(data.thisWeek), ...Object.keys(data.lastWeek)])] as MuscleGroup[];
  const max = Math.max(10, ...Object.values(data.thisWeek));
  const intensity = Object.fromEntries(Object.entries(data.thisWeek).map(([m, v]) => [m, v / max])) as Partial<Record<MuscleGroup, number>>;
  const hasData = data.sessions.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Progreso</span>
        <h1 className="text-4xl">Tus números</h1>
      </header>

      <nav className="grid grid-cols-3 gap-3" aria-label="Secciones de progreso">
        {[
          { href: '/progreso/medidas', label: 'Medidas', icon: Ruler },
          { href: '/progreso/fotos', label: 'Fotos', icon: Camera },
          { href: '/revision', label: 'Revisiones', icon: CalendarCheck },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href as '/revision'}
            className="flex min-h-16 flex-col items-start justify-between gap-2 rounded-card border border-border bg-card p-3 transition-colors hover:bg-card-hover"
          >
            <Icon strokeWidth={1.5} className="size-5 text-text-2" />
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </nav>

      {!hasData ? (
        <EmptyState
          title="Sin sesiones todavía"
          description="Récords, volumen por semana, gráficas por ejercicio y mapa muscular aparecen en cuanto termines tu primera sesión."
          action={
            <Button asChild>
              <Link href="/hoy">Ir a Hoy</Link>
            </Button>
          }
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4" aria-label="Semana contra semana">
            <Card className="flex flex-col gap-2">
              <Metric label="Sesiones" value={data.sessionsThisWeek} unit={data.planned ? `/ ${data.planned}` : undefined} />
              <span className="text-sm text-text-3">
                Semana pasada: {data.sessionsLastWeek} <Delta value={data.sessionsThisWeek - data.sessionsLastWeek} />
              </span>
            </Card>
            <Card className="flex flex-col gap-2">
              <Metric label="Volumen" value={fmtKg(data.volume.thisWeek)} unit="kg" />
              <span className="text-sm text-text-3">
                Semana pasada: {fmtKg(data.volume.lastWeek)} <Delta value={data.volume.lastWeek ? ((data.volume.thisWeek - data.volume.lastWeek) / data.volume.lastWeek) * 100 : null} unit="%" />
              </span>
            </Card>
            {body.weightKg ? (
              <Card className="flex flex-col gap-2">
                <Metric label="Peso" value={body.weightKg.toLocaleString('es-MX')} unit="kg" />
                {body.bodyFatPct ? <span className="text-sm text-text-3">{body.bodyFatPct.toLocaleString('es-MX')}% grasa</span> : null}
              </Card>
            ) : null}
            <Card className="flex flex-col gap-2">
              <Metric label="Récords" value={data.records.length} />
              <span className="text-sm text-text-3">Últimos registrados</span>
            </Card>
          </section>

          <Card className="flex flex-col gap-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-xl">Mapa muscular de la semana</h2>
              <p className="text-sm text-text-2">Series efectivas por grupo (las secundarias cuentan como media serie).</p>
            </header>
            <MuscleMap intensity={intensity} />
            {muscles.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border">
                {muscles
                  .sort((a, b) => (data.thisWeek[b] ?? 0) - (data.thisWeek[a] ?? 0))
                  .map((m) => (
                    <li key={m} className="flex items-center justify-between gap-3 py-2.5">
                      <span>{MUSCLE_LABELS_ES[m]}</span>
                      <span className="flex items-baseline gap-3">
                        <span className="font-display text-lg tracking-display tnum">{(data.thisWeek[m] ?? 0).toLocaleString('es-MX')}</span>
                        <Delta value={(data.thisWeek[m] ?? 0) - (data.lastWeek[m] ?? 0)} className="w-14 text-right" />
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm text-text-3">Aún no hay series esta semana.</p>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <header className="flex items-baseline justify-between">
              <h2 className="text-xl">Adherencia</h2>
              <span className="label">8 semanas</span>
            </header>
            <AdherenceBars weeks={data.adherence} />
          </Card>

          {data.records.length > 0 ? (
            <section className="flex flex-col gap-3" aria-labelledby="records">
              <h2 id="records" className="text-2xl">
                Récords recientes
              </h2>
              <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
                {data.records.map((r) => (
                  <li key={r.id}>
                    <Link href={`/progreso/ejercicio/${r.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-card-hover">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{r.name}</span>
                        <span className="text-sm text-text-3">
                          {RECORD_LABELS_ES[r.type as RecordType] ?? r.type} · {formatShortDate(r.achievedAt)}
                        </span>
                      </span>
                      <span className="font-display text-lg tracking-display tnum">{recordValue(r.type, r.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="by-exercise">
            <h2 id="by-exercise" className="text-2xl">
              Por ejercicio
            </h2>
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
              {data.trained.slice(0, 20).map((t) => (
                <li key={t.id}>
                  <Link href={`/progreso/ejercicio/${t.slug}`} className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-card-hover">
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="text-sm text-text-3 tnum">{t.sessions} ses.</span>
                    <ChevronRight strokeWidth={1.5} className="size-4 text-text-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="history">
            <h2 id="history" className="text-2xl">
              Historial
            </h2>
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
              {data.sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{s.dayName ?? 'Sesión libre'}</span>
                    <span className="text-sm text-text-3">
                      {formatShortDate(s.startedAt)}
                      {s.summary ? ` · ${fmtDuration(s.summary.durationSec)} · ${s.summary.completedSets} series` : ''}
                      {s.summary?.records.length ? ` · ${s.summary.records.length} récord(s)` : ''}
                    </span>
                  </span>
                  {s.summary ? (
                    <span className="flex flex-col items-end">
                      <span className="font-display text-lg tracking-display tnum">{fmtKg(s.summary.volumeKg)} kg</span>
                      {s.summary.previous ? <Delta value={s.summary.volumeKg - s.summary.previous.volumeKg} unit=" kg" /> : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
