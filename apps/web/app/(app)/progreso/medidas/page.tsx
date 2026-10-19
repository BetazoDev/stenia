import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { deleteMeasurementAction } from '@/app/(app)/progreso/actions';
import { DeleteButton } from '@/components/progress/delete-button';
import { Delta } from '@/components/progress/delta';
import { MeasurementForm } from '@/components/progress/measurement-form';
import { WeightChart } from '@/components/progress/weight-chart';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Metric } from '@/components/ui/metric';
import { latestBodyComposition, listMeasurements, weightSeries } from '@/lib/body';
import { localDateString } from '@/lib/dates';
import { getProfile } from '@/lib/profile';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Medidas' };

const METHOD_LABELS: Record<string, string> = {
  navy: 'Marina',
  bia: 'Bioimpedancia',
  inbody: 'InBody',
  dexa: 'DEXA',
  photo_estimate: 'Foto (aprox.)',
  manual: 'Manual',
};

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('es-MX'));

export default async function MeasurementsPage() {
  const { user } = await requireSession();
  const [rows, series, latest, profile] = await Promise.all([listMeasurements(user.id), weightSeries(user.id), latestBodyComposition(user.id), getProfile(user.id)]);
  const trendNow = series.trend[series.trend.length - 1]?.value ?? null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/progreso" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Progreso
        </Link>
        <span className="label">Escaneo corporal · nivel 1</span>
        <h1 className="text-4xl">Medidas</h1>
        <p className="max-w-prose text-text-2">
          Peso y circunferencias con cinta métrica. Con cuello y cintura (y cadera en mujeres) calculamos tu % de grasa con la
          fórmula de la Marina de EE.UU. Es una estimación: compárala contra ti mismo, no contra otros.
        </p>
        <Link href="/progreso/inbody" className="text-sm text-text-2 underline underline-offset-4">
          ¿Tienes un ticket de InBody, bioimpedancia o DEXA? Cárgalo aquí
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col gap-2">
          <Metric label="Tendencia de peso" value={trendNow !== null ? n(trendNow) : '—'} unit="kg" />
          {series.trendChange4w !== null ? (
            <span className="text-sm text-text-3">
              4 semanas <Delta value={series.trendChange4w} unit=" kg" invert={profile?.goal === 'fat_loss'} />
            </span>
          ) : null}
        </Card>
        <Card className="flex flex-col gap-2">
          <Metric label="Grasa corporal" value={latest.bodyFatPct !== null ? n(latest.bodyFatPct) : '—'} unit="%" />
          {latest.bodyFatMethod ? <span className="text-sm text-text-3">{METHOD_LABELS[latest.bodyFatMethod] ?? latest.bodyFatMethod}</span> : null}
        </Card>
      </section>

      {series.raw.length >= 2 ? (
        <Card>
          <WeightChart raw={series.raw} trend={series.trend} />
        </Card>
      ) : null}

      <Card className="flex flex-col gap-5">
        <h2 className="text-xl">Nueva medición</h2>
        <MeasurementForm today={localDateString()} sex={(profile?.sex as 'male' | 'female' | null) ?? null} />
      </Card>

      {rows.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="m-history">
          <h2 id="m-history" className="text-2xl">
            Historial
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{formatShortDate(new Date(`${r.measuredAt}T12:00:00Z`))}</span>
                    {r.approximate ? <Chip tone="down">Aproximado</Chip> : null}
                    {r.source !== 'manual' ? <Chip>{r.source === 'checkin' ? 'Revisión' : r.source}</Chip> : null}
                  </span>
                  <span className="text-sm text-text-3 tnum">
                    {[
                      r.weightKg !== null ? `${n(r.weightKg)} kg` : null,
                      r.waistCm !== null ? `cintura ${n(r.waistCm)}` : null,
                      r.neckCm !== null ? `cuello ${n(r.neckCm)}` : null,
                      r.hipCm !== null ? `cadera ${n(r.hipCm)}` : null,
                      r.armCm !== null ? `brazo ${n(r.armCm)}` : null,
                      r.thighCm !== null ? `muslo ${n(r.thighCm)}` : null,
                      r.bodyFatPct !== null ? `${n(r.bodyFatPct)}% grasa (${METHOD_LABELS[r.bodyFatMethod ?? 'manual'] ?? ''})` : null,
                      r.leanMassKg !== null ? `magra ${n(r.leanMassKg)} kg` : null,
                      r.bmrMeasured !== null ? `TMB ${r.bmrMeasured} kcal` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
                <DeleteButton action={deleteMeasurementAction.bind(null, r.id)} label="Borrar medición" confirm="¿Borrar esta medición?" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
