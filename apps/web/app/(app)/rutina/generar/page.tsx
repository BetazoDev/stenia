import type { Metadata } from 'next';

import { Headline } from '@/components/headline';
import { GenerationCard } from '@/components/routine/generation-card';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Generando rutina' };

export default async function GeneratePage() {
  await requireSession();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="label">Tu rutina</span>
        <Headline text="Armando tu plan" />
        <p className="text-text-2">El código decide la estructura y los límites; la IA elige ejercicios del catálogo y todo se valida antes de guardarse.</p>
      </header>
      <GenerationCard />
    </div>
  );
}
