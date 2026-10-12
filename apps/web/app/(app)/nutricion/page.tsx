import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Nutrición' };

export default function NutritionPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Nutrición</span>
        <h1 className="text-4xl">Metas y comidas</h1>
      </header>
      <EmptyState
        title="Nutrición en camino"
        description="Las metas calóricas, el plan semanal con alimentos verificados y el registro diario se activan en la Fase 3."
      />
    </div>
  );
}
