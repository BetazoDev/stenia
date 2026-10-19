import { TARGET_METHOD_LABELS_ES, type TargetMethod } from '@stenia/core';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { RefreshTargetsButton } from '@/components/nutrition/refresh-targets';
import { Card } from '@/components/ui/card';
import { Metric } from '@/components/ui/metric';
import { computeUserTargets, getCurrentTarget, getNutritionState, targetHistory } from '@/lib/nutrition';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Metas de nutrición' };

const n = (v: number) => Math.round(v).toLocaleString('es-MX');

export default async function TargetsPage() {
  const { user } = await requireSession();
  const state = await getNutritionState(user.id);
  if (state.status !== 'ready') redirect('/nutricion');
  const [current, computed, history] = await Promise.all([getCurrentTarget(user.id), computeUserTargets(user.id), targetHistory(user.id)]);
  const changed = computed && current && (computed.kcal !== current.kcal || computed.proteinG !== current.proteinG || computed.method !== current.method);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/nutricion" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Nutrición
        </Link>
        <h1 className="text-4xl">Tus metas</h1>
      </header>

      {current ? (
        <section className="grid grid-cols-2 gap-4">
          <Card>
            <Metric label="Calorías" value={n(current.kcal)} unit="kcal" />
          </Card>
          <Card>
            <Metric label="Proteína" value={n(current.proteinG)} unit="g" />
          </Card>
          <Card>
            <Metric label="Carbohidratos" value={n(current.carbsG)} unit="g" />
          </Card>
          <Card>
            <Metric label="Grasa" value={n(current.fatG)} unit="g" />
          </Card>
        </section>
      ) : null}

      {computed ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl">Cómo se calculan</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="label">Método</dt>
              <dd className="mt-1">{TARGET_METHOD_LABELS_ES[computed.method as TargetMethod]}</dd>
            </div>
            <div>
              <dt className="label">Metabolismo basal</dt>
              <dd className="mt-1 tnum">{n(computed.bmr)} kcal</dd>
            </div>
            <div>
              <dt className="label">Gasto diario</dt>
              <dd className="mt-1 tnum">{n(computed.tdee)} kcal</dd>
            </div>
            <div>
              <dt className="label">Ajuste de revisiones</dt>
              <dd className="mt-1 tnum">{computed.kcalAdjustment ? `${computed.kcalAdjustment > 0 ? '+' : ''}${computed.kcalAdjustment} kcal` : 'Ninguno'}</dd>
            </div>
          </dl>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-2">
            {computed.rationale.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-sm text-text-3">
            {computed.adaptive
              ? `Gasto adaptativo con ${computed.adaptive.days} días de registro: ingesta promedio ${n(computed.adaptive.avgIntake)} kcal y cambio de ${computed.adaptive.changeKgPerWeek} kg/semana.`
              : 'Con 14 días de registro completo y pesajes frecuentes, el gasto se calcula con tus datos reales (gasto adaptativo).'}
          </p>
          {changed ? <p className="text-sm text-text-2">Con tus datos actuales las metas cambiarían a {n(computed.kcal)} kcal y {n(computed.proteinG)} g de proteína.</p> : null}
          <RefreshTargetsButton />
        </Card>
      ) : null}

      {history.length > 1 ? (
        <section className="flex flex-col gap-3" aria-labelledby="target-history">
          <h2 id="target-history" className="text-2xl">
            Historial
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex flex-col">
                  <span>{formatShortDate(h.createdAt)}</span>
                  <span className="text-sm text-text-3">{TARGET_METHOD_LABELS_ES[h.method as TargetMethod] ?? h.method}</span>
                </span>
                <span className="text-sm tnum">
                  {n(h.kcal)} kcal · {n(h.proteinG)} g P
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-[12px] text-text-3">Proteína según la ISSN; piso de calorías y ritmo de pérdida configurables en Ajustes. No es un dispositivo médico.</p>
    </div>
  );
}
