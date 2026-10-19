import { CHECKIN_TYPE_LABELS_ES, RECORD_LABELS_ES, type CheckinType, type RecordType } from '@stenia/core';
import { ChevronRight, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BlockProgress } from '@/components/block-progress';
import { ExerciseMedia } from '@/components/exercise-media';
import { Headline } from '@/components/headline';
import { StartSessionButton } from '@/components/session/start-session';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Metric } from '@/components/ui/metric';
import { ensureScheduledCheckins, pendingCheckins } from '@/lib/checkins';
import { TRIGGER_LABELS_ES, type EarlyTrigger } from '@/lib/checkins-trigger';
import { blockWeek, localDateString } from '@/lib/dates';
import { doseText } from '@/lib/labels';
import { dayLog, getCurrentTarget, getNutritionState } from '@/lib/nutrition';
import { getProfile } from '@/lib/profile';
import { recentRecords } from '@/lib/progress';
import { getWeekSummary } from '@/lib/queries/sessions';
import { getActiveRoutine, nextRoutineDay } from '@/lib/routine';
import { requireSession } from '@/lib/session';
import { formatLongDate, greetingFor } from '@/lib/time';

export const metadata: Metadata = { title: 'Hoy' };

export default async function TodayPage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [week, profile, routine] = await Promise.all([getWeekSummary(userId), getProfile(userId), getActiveRoutine(userId)]);
  const firstName = session.user.name.trim().split(' ')[0] || session.user.name;
  const day = routine ? await nextRoutineDay(userId, routine) : null;
  if (profile?.onboardingCompletedAt) await ensureScheduledCheckins(userId);
  const [checkins, records, nutrition] = await Promise.all([pendingCheckins(userId), recentRecords(userId, 3), getNutritionState(userId)]);
  const [target, intake] = nutrition.status === 'ready' ? await Promise.all([getCurrentTarget(userId), dayLog(userId, localDateString())]) : [null, null];
  const checkin = checkins[0] ?? null;
  const planned = routine?.days.length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="label normal-case">{formatLongDate()}</span>
        <Headline text={`${greetingFor()}, ${firstName}`} />
      </header>

      <Card>
        <BlockProgress
          week={routine ? blockWeek(routine.startedOn, routine.blockWeeks) : 1}
          totalWeeks={routine?.blockWeeks ?? 8}
          trainedDays={week.days}
          todayIndex={week.todayIndex}
        />
      </Card>

      {checkin ? (
        <Link
          href={`/revision/${checkin.id}`}
          className="flex items-center gap-4 rounded-card border border-text bg-card p-4 transition-colors hover:bg-card-hover"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="label">Revisión pendiente</span>
            <span className="text-lg">{CHECKIN_TYPE_LABELS_ES[checkin.type as CheckinType]}</span>
            <span className="text-sm text-text-3">
              {checkin.trigger ? (TRIGGER_LABELS_ES[checkin.trigger as EarlyTrigger] ?? checkin.trigger) : 'Dos minutos para ajustar el plan con tus datos.'}
            </span>
          </span>
          <ChevronRight strokeWidth={1.5} className="size-5 text-text-2" />
        </Link>
      ) : null}

      {!profile?.onboardingCompletedAt ? (
        <EmptyState
          title="Empieza por tu cuestionario"
          description="Seguridad, datos corporales, objetivo y logística: con eso armamos tu primera rutina con el equipo real de tu gimnasio."
          action={
            <Button asChild>
              <Link href="/onboarding">Contestar cuestionario</Link>
            </Button>
          }
        />
      ) : !routine || !day ? (
        <EmptyState
          title="Tu rutina aún no está lista"
          description="Ya tenemos tus respuestas. Genera la rutina con tu equipamiento activo."
          action={
            <Button asChild>
              <Link href="/rutina/generar">Generar rutina</Link>
            </Button>
          }
        />
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="next-day">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="next-day" className="text-3xl">
              {day.name}
            </h2>
            <Link href="/rutina" className="text-sm text-text-2 underline underline-offset-4">
              Ver rutina
            </Link>
          </div>
          <ol className="flex flex-col divide-y divide-border rounded-card border border-border">
            {day.exercises.map((e, i) => (
              <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                <span className="label w-6 tnum">{String(i + 1).padStart(2, '0')}</span>
                <ExerciseMedia
                  start={e.media.find((m) => m.role === 'start')?.url ?? null}
                  end={e.media.find((m) => m.role === 'end')?.url ?? null}
                  main={e.media.find((m) => m.role === 'main')?.url ?? null}
                  alt={e.exercise.nameEs}
                  className="size-12"
                />
                <span className="line-clamp-2 min-w-0 flex-1 leading-snug">{e.exercise.nameEs}</span>
                <span className="font-display text-lg tracking-display tnum">{doseText(e)}</span>
              </li>
            ))}
          </ol>
          <StartSessionButton dayId={day.id} dayName={day.name} />
        </section>
      )}

      <section className="grid grid-cols-2 gap-4">
        <Card>
          <Metric label="Sesiones esta semana" value={week.thisWeek} unit={planned ? `/ ${planned}` : undefined} />
        </Card>
        <Card>
          <Metric label="Sesiones totales" value={week.total} />
        </Card>
        {target && intake ? (
          <Link href="/nutricion" className="col-span-2 rounded-card border border-border bg-card p-5 transition-colors hover:bg-card-hover">
            <Metric
              label="Calorías de hoy"
              value={Math.round(intake.totals.kcal).toLocaleString('es-MX')}
              unit={`/ ${target.kcal.toLocaleString('es-MX')} kcal`}
              hint={`${intake.totals.proteinG} de ${target.proteinG} g de proteína`}
            />
          </Link>
        ) : null}
      </section>

      {records.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="recent-records">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="recent-records" className="text-2xl">
              Récords recientes
            </h2>
            <Link href="/progreso" className="text-sm text-text-2 underline underline-offset-4">
              Ver progreso
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {records.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Trophy strokeWidth={1.5} className="size-4 shrink-0 text-text-2" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{r.name}</span>
                  <span className="text-sm text-text-3">{RECORD_LABELS_ES[r.type as RecordType] ?? r.type}</span>
                </span>
                <span className="font-display text-lg tracking-display tnum">{r.value.toLocaleString('es-MX')}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
