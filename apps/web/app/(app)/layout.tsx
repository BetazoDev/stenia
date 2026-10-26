import type { ReactNode } from 'react';

import { weightUnitFrom } from '@stenia/core';

import { AppNav } from '@/components/app-nav';
import { WeightUnitSync } from '@/components/units/weight-unit';
import { pendingCheckins } from '@/lib/checkins';
import { requireSession } from '@/lib/session';

/** Todo el segmento depende de la sesión: nunca se prerenderiza. */
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const pending = await pendingCheckins(session.user.id).catch(() => []);
  return (
    <div className="min-h-dvh md:pl-60">
      <AppNav userName={session.user.name} pendingCheckins={pending.length} />
      <WeightUnitSync unit={weightUnitFrom(session.user.units)} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
        {children}
      </main>
    </div>
  );
}
