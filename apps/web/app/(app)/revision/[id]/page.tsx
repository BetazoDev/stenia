import { ADJUSTMENT_KIND_LABELS_ES, CHECKIN_TYPE_LABELS_ES, type CheckinType } from '@stenia/core';
import { ArrowLeft, Check, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { dismissCheckinAction } from '@/app/(app)/revision/actions';
import { CheckinFlow } from '@/components/checkin/checkin-flow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { weightSeries } from '@/lib/body';
import { getCheckin, type CheckinMetrics, type StoredProposal } from '@/lib/checkins';
import { TRIGGER_LABELS_ES, type EarlyTrigger } from '@/lib/checkins-trigger';
import { getProfile } from '@/lib/profile';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Revisión' };

function MetricsSummary({ m }: { m: Partial<CheckinMetrics> }) {
  const items = [
    m.weight?.trend ? { label: 'Peso (tendencia)', value: `${m.weight.trend.toLocaleString('es-MX')} kg` } : null,
    m.weight?.slopePctPerWeek !== null && m.weight?.slopePctPerWeek !== undefined
      ? { label: 'Cambio semanal', value: `${m.weight.slopePctPerWeek > 0 ? '+' : ''}${m.weight.slopePctPerWeek.toLocaleString('es-MX')}%` }
      : null,
    m.adherence && m.adherence.avgPct !== null ? { label: 'Adherencia', value: `${Math.round(m.adherence.avgPct * 100)}%` } : null,
    m.sessions ? { label: 'Sesiones (14 días)', value: String(m.sessions.count14d) } : null,
    m.sessions?.avgEffort ? { label: 'Esfuerzo medio', value: `${m.sessions.avgEffort}/10` } : null,
    m.records14d !== undefined ? { label: 'Récords (14 días)', value: String(m.records14d) } : null,
  ].filter((x): x is { label: string; value: string } => x !== null);
  if (items.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="label">{i.label}</dt>
          <dd className="mt-1 font-display text-2xl tracking-display tnum">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession();
  const { id } = await params;
  const [row, profile, weights] = await Promise.all([getCheckin(user.id, id), getProfile(user.id), weightSeries(user.id)]);
  if (!row) notFound();
  const type = row.type as CheckinType;
  const closed = Boolean(row.completedAt || row.dismissedAt);
  const proposals = row.proposedChanges as StoredProposal[];
  const metrics = row.metrics as Partial<CheckinMetrics> & { generator?: 'llm' | 'rules'; aiMessage?: string | null };
  const decision = row.decision as { accepted?: StoredProposal[]; rejected?: StoredProposal[]; version?: number | null };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/revision" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Revisiones
        </Link>
        <span className="label">{formatShortDate(new Date(`${row.scheduledFor}T12:00:00Z`))}</span>
        <h1 className="text-4xl">{CHECKIN_TYPE_LABELS_ES[type]}</h1>
        {row.trigger ? <p className="text-text-2">Motivo: {TRIGGER_LABELS_ES[row.trigger as EarlyTrigger] ?? row.trigger}</p> : null}
      </header>

      {row.aiSummary ? (
        <Card>
          <MetricsSummary m={metrics} />
        </Card>
      ) : null}

      {closed ? (
        <div className="flex flex-col gap-6">
          {row.dismissedAt ? <p className="text-text-2">Descartaste esta revisión.</p> : null}
          {row.aiSummary ? (
            <Card className="flex flex-col gap-2">
              <span className="label">Resumen</span>
              <p className="leading-relaxed">{row.aiSummary}</p>
            </Card>
          ) : null}
          {(decision.accepted?.length ?? 0) + (decision.rejected?.length ?? 0) > 0 ? (
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
              {[...(decision.accepted ?? []).map((a) => ({ a, ok: true })), ...(decision.rejected ?? []).map((a) => ({ a, ok: false }))].map(({ a, ok }, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  {ok ? <Check strokeWidth={1.5} className="mt-0.5 size-4 text-up" /> : <X strokeWidth={1.5} className="mt-0.5 size-4 text-text-3" />}
                  <span className="flex flex-col gap-1">
                    <span className={ok ? '' : 'text-text-3 line-through'}>{a.description}</span>
                    <Chip className="self-start">{ADJUSTMENT_KIND_LABELS_ES[a.kind]}</Chip>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {decision.version ? (
            <Button asChild className="self-start">
              <Link href="/rutina">Ver rutina v{decision.version}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <CheckinFlow
            id={row.id}
            type={type}
            trigger={row.trigger}
            sex={(profile?.sex as 'male' | 'female' | null) ?? null}
            weightAvg7d={weights.avg7d}
            lastWeight={weights.raw[weights.raw.length - 1]?.value ?? null}
            initial={row.aiSummary ? { summary: row.aiSummary, proposals, generator: metrics.generator ?? 'rules', aiMessage: metrics.aiMessage ?? null } : null}
          />
          {type === 'early' && !row.aiSummary ? (
            <form action={dismissCheckinAction.bind(null, row.id)}>
              <Button type="submit" variant="ghost">
                Descartar esta revisión
              </Button>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
