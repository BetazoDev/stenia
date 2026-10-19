import { CHECKIN_TYPE_LABELS_ES, type CheckinMode, type CheckinType } from '@stenia/core';
import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { openCheckinAction } from '@/app/(app)/revision/actions';
import { CheckinModeSelect } from '@/components/checkin/mode-select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ensureScheduledCheckins, getCheckinSettings, listCheckins } from '@/lib/checkins';
import { TRIGGER_LABELS_ES, type EarlyTrigger } from '@/lib/checkins-trigger';
import { getProfile } from '@/lib/profile';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Revisiones' };

const dateOf = (iso: string) => formatShortDate(new Date(`${iso}T12:00:00Z`));

export default async function CheckinsPage() {
  const { user } = await requireSession();
  const profile = await getProfile(user.id);
  if (!profile?.onboardingCompletedAt) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="label">Revisiones</span>
          <h1 className="text-4xl">Ajusta con datos</h1>
        </header>
        <EmptyState
          title="Primero el cuestionario"
          description="Las revisiones comparan tu progreso con tu objetivo; necesitan tu perfil y una rutina."
          action={
            <Button asChild>
              <Link href="/onboarding">Contestar cuestionario</Link>
            </Button>
          }
        />
      </div>
    );
  }
  await ensureScheduledCheckins(user.id);
  const [settings, rows] = await Promise.all([getCheckinSettings(user.id), listCheckins(user.id)]);
  const pending = rows.filter((r) => !r.completedAt && !r.dismissedAt);
  const history = rows.filter((r) => r.completedAt || r.dismissedAt);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Revisiones</span>
        <h1 className="text-4xl">Ajusta con datos</h1>
        <p className="max-w-prose text-text-2">
          El código calcula tendencias de peso, progreso y adherencia; el entrenador resume y propone ajustes dentro de las reglas.
          Tú aceptas, editas o rechazas cada uno.
        </p>
      </header>

      {pending.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="pending">
          <h2 id="pending" className="text-2xl">
            Pendientes
          </h2>
          <ul className="flex flex-col gap-3">
            {pending.map((c) => (
              <li key={c.id}>
                <Link href={`/revision/${c.id}`} className="flex items-center gap-4 rounded-card border border-text bg-card p-4 hover:bg-card-hover">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-lg">{CHECKIN_TYPE_LABELS_ES[c.type as CheckinType]}</span>
                    <span className="text-sm text-text-3">
                      {c.trigger ? (TRIGGER_LABELS_ES[c.trigger as EarlyTrigger] ?? c.trigger) : `Programada para el ${dateOf(c.scheduledFor)}`}
                    </span>
                  </span>
                  <ChevronRight strokeWidth={1.5} className="size-5 text-text-2" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Card className="flex flex-col gap-5">
        <h2 className="text-xl">Calendario</h2>
        <dl className="grid grid-cols-2 gap-4">
          {settings.nextLightAt ? (
            <div>
              <dt className="label">Próxima ligera</dt>
              <dd className="mt-1">{dateOf(settings.nextLightAt)}</dd>
            </div>
          ) : null}
          {settings.nextFullAt ? (
            <div>
              <dt className="label">Próxima completa</dt>
              <dd className="mt-1">{dateOf(settings.nextFullAt)}</dd>
            </div>
          ) : null}
        </dl>
        <CheckinModeSelect mode={settings.mode as CheckinMode} />
        <div className="flex flex-wrap gap-3">
          <form action={openCheckinAction.bind(null, 'light')}>
            <Button type="submit" variant="secondary">
              Revisión ligera ahora
            </Button>
          </form>
          <form action={openCheckinAction.bind(null, 'full')}>
            <Button type="submit" variant="secondary">
              Revisión completa ahora
            </Button>
          </form>
        </div>
      </Card>

      {history.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="history">
          <h2 id="history" className="text-2xl">
            Historial
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {history.map((c) => {
              const accepted = ((c.decision as { accepted?: unknown[] }).accepted ?? []).length;
              const version = (c.decision as { version?: number | null }).version ?? null;
              return (
                <li key={c.id}>
                  <Link href={`/revision/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-card-hover">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span>{CHECKIN_TYPE_LABELS_ES[c.type as CheckinType]}</span>
                      <span className="text-sm text-text-3">
                        {formatShortDate(c.completedAt ?? c.dismissedAt ?? new Date(`${c.scheduledFor}T12:00:00Z`))}
                        {c.dismissedAt ? ' · descartada' : ` · ${accepted} ajuste(s) aceptado(s)`}
                      </span>
                    </span>
                    {version ? <Chip>v{version}</Chip> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
