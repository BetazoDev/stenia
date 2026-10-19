import type { Metadata } from 'next';
import Link from 'next/link';

import { BlockProgress } from '@/components/block-progress';
import { ExerciseMedia } from '@/components/exercise-media';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { blockWeek } from '@/lib/dates';
import { getActiveGymProfile } from '@/lib/gym';
import { doseText, musclesText, restText } from '@/lib/labels';
import { getActiveRoutine, listRoutineVersions } from '@/lib/routine';
import { getWeekSummary } from '@/lib/queries/sessions';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Rutina' };

export default async function RoutinePage() {
  const { user } = await requireSession();
  const [routine, versions, gym, week] = await Promise.all([
    getActiveRoutine(user.id),
    listRoutineVersions(user.id),
    getActiveGymProfile(user.id),
    getWeekSummary(user.id),
  ]);

  if (!routine) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="label">Rutina</span>
          <h1 className="text-4xl">Tu plan</h1>
        </header>
        <EmptyState
          title="Aún no tienes rutina"
          description="Contesta el cuestionario inicial y elige tu equipamiento; la rutina se genera al terminar."
          action={
            <Button asChild>
              <Link href="/onboarding">Empezar cuestionario</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const meta = routine.version.meta as { generator?: string; warnings?: string[]; split?: string };
  const week1 = blockWeek(routine.startedOn, routine.blockWeeks);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="label">Rutina · versión {routine.version.version}</span>
        <h1 className="text-4xl md:text-5xl">{routine.days.length} días por semana</h1>
        <div className="flex flex-wrap gap-2">
          <Chip>{meta.generator === 'llm' ? 'Elegida por IA' : routine.version.author === 'user' ? 'Ajustada en revisión' : 'Plantilla determinista'}</Chip>
          {gym ? <Chip>{gym.name}</Chip> : null}
          <Chip>Desde {routine.startedOn ? formatShortDate(new Date(`${routine.startedOn}T12:00:00`)) : '—'}</Chip>
        </div>
      </header>

      <Card>
        <BlockProgress week={week1} totalWeeks={routine.blockWeeks} trainedDays={week.days} todayIndex={week.todayIndex} />
      </Card>

      {routine.version.rationale ? <p className="max-w-prose text-text-2">{routine.version.rationale}</p> : null}

      <div className="flex flex-col gap-6">
        {routine.days.map((day) => (
          <section key={day.id} className="flex flex-col gap-3">
            <h2 className="text-2xl">{day.name}</h2>
            <ol className="flex flex-col divide-y divide-border rounded-card border border-border">
              {day.exercises.map((e, i) => {
                const start = e.media.find((m) => m.role === 'start')?.url ?? null;
                const end = e.media.find((m) => m.role === 'end')?.url ?? null;
                const main = e.media.find((m) => m.role === 'main')?.url ?? null;
                return (
                  <li key={e.id}>
                    <Link href={`/ejercicios/${e.exercise.slug}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card-hover md:gap-4">
                      <span className="label w-6 shrink-0 tnum">{String(i + 1).padStart(2, '0')}</span>
                      <ExerciseMedia start={start} end={end} main={main} alt={e.exercise.nameEs} className="size-14 md:size-16" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 leading-snug">{e.exercise.nameEs}</p>
                        <p className="truncate text-sm text-text-3">{musclesText(e.exercise.primaryMuscles)}</p>
                        <p className="text-sm text-text-3 tnum md:hidden">
                          RIR {e.rirTarget} · {restText(e.restSeconds)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-lg tracking-display tnum">{doseText(e)}</p>
                        <p className="hidden text-sm text-text-3 tnum md:block">
                          RIR {e.rirTarget} · {restText(e.restSeconds)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      {meta.warnings && meta.warnings.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-xl">Avisos del validador</h2>
          <ul className="list-disc pl-5 text-sm text-text-2">
            {meta.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/rutina/generar">Regenerar rutina</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/equipo">Cambiar equipamiento</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/onboarding?resumen=1">Editar cuestionario</Link>
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Historial de versiones</h2>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span>
                  Versión {v.version} · {v.author === 'ai' ? ((v.meta as { generator?: string }).generator === 'llm' ? 'IA' : 'Plantilla') : 'Revisión'}
                </span>
                <span className="text-sm text-text-3">{formatShortDate(v.createdAt)}</span>
              </div>
              {v.id === v.current ? <span className="label">Vigente</span> : null}
              {v.rationale ? <p className="line-clamp-2 text-sm text-text-2">{v.rationale}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
