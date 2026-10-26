import type { Metadata } from 'next';

import { Headline } from '@/components/headline';
import { GenerationCard } from '@/components/routine/generation-card';
import { PendingSession } from '@/components/session/pending-session';
import { requireSession } from '@/lib/session';
import { latestActiveSession } from '@/lib/training-day';

export const metadata: Metadata = { title: 'Generando rutina' };

export default async function GeneratePage() {
  const { user } = await requireSession();
  // No se arma una rutina nueva con una sesión a medias: primero se termina o se descarta.
  const active = await latestActiveSession(user.id);
  if (active) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <span className="label">Tu rutina</span>
          <Headline text="Primero termina tu sesión" />
          <p className="text-text-2">
            Tienes un entrenamiento abierto. Termínalo o descártalo y después genera la rutina
            nueva.
          </p>
        </header>
        <PendingSession
          id={active.id}
          dayName={active.dayName}
          startedAt={active.startedAt.toISOString()}
          stale={active.stale}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="label">Tu rutina</span>
        <Headline text="Armando tu plan" />
        <p className="text-text-2">
          El código decide la estructura y los límites; la IA elige ejercicios del catálogo y todo
          se valida antes de guardarse.
        </p>
      </header>
      <GenerationCard />
    </div>
  );
}
