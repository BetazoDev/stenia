import type { Metadata } from 'next';

import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Progreso' };

export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Progreso</span>
        <h1 className="text-4xl">Tus números</h1>
      </header>
      <EmptyState
        title="Sin datos todavía"
        description="Récords, volumen por semana, gráficas por ejercicio y mapa muscular aparecerán aquí en cuanto registres sesiones."
      />
    </div>
  );
}
