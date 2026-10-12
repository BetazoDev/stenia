import type { Metadata } from 'next';

import { BlockProgress } from '@/components/block-progress';
import { Headline } from '@/components/headline';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Metric } from '@/components/ui/metric';
import { getWeekSummary } from '@/lib/queries/sessions';
import { requireSession } from '@/lib/session';
import { formatLongDate, greetingFor } from '@/lib/time';

export const metadata: Metadata = { title: 'Hoy' };

export default async function TodayPage() {
  const session = await requireSession();
  const week = await getWeekSummary(session.user.id);
  const firstName = session.user.name.trim().split(' ')[0] || session.user.name;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="label normal-case">{formatLongDate()}</span>
        <Headline text={`${greetingFor()}, ${firstName}`} />
      </header>

      <Card>
        <BlockProgress week={1} totalWeeks={12} trainedDays={week.days} todayIndex={week.todayIndex} />
      </Card>

      <EmptyState
        title="Aún no tienes rutina"
        description="Tu primera rutina saldrá del cuestionario inicial y del equipamiento real de tu gimnasio. Esa parte llega en la siguiente fase; por ahora puedes completar tu perfil y confirmar que el acceso funciona."
      />

      <section className="grid grid-cols-2 gap-4">
        <Card>
          <Metric label="Sesiones esta semana" value={week.thisWeek} />
        </Card>
        <Card>
          <Metric label="Sesiones totales" value={week.total} />
        </Card>
      </section>
    </div>
  );
}
