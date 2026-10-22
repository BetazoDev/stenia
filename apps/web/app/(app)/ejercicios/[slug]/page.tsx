import type { MuscleGroup } from '@stenia/core';
import { exercise } from '@stenia/db';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ViewTransition } from 'react';

import { ExerciseAdminTools } from '@/components/exercise/admin-tools';
import { TipCard } from '@/components/exercise/tip-card';
import { ExerciseMedia } from '@/components/exercise-media';
import { MuscleMap } from '@/components/muscle-map';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Metric } from '@/components/ui/metric';
import { aiStatus } from '@/lib/ai';
import { getDb } from '@/lib/db';
import { getExerciseDetail } from '@/lib/exercises';
import { LEVEL_LABELS, LOAD_TYPE_LABELS_ES, PATTERN_LABELS_ES, musclesText } from '@/lib/labels';
import { isAdmin, requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [row] = await getDb().select({ name: exercise.nameEs }).from(exercise).where(eq(exercise.slug, slug)).limit(1);
  return { title: row?.name ?? 'Ejercicio' };
}

const SOURCE_LABELS: Record<string, { label: string; url: string; license: string }> = {
  repdb: { label: 'Exercise data by RepDB (repdb.co)', url: 'https://repdb.co', license: 'RepDB Free · atribución obligatoria' },
  'free-exercise-db': { label: 'free-exercise-db', url: 'https://github.com/yuhonas/free-exercise-db', license: 'Unlicense (dominio público)' },
  calisthenics: { label: 'Martjn/calisthenics_exercises', url: 'https://huggingface.co/datasets/Martjn/calisthenics_exercises', license: 'Apache-2.0' },
};

export default async function ExerciseDetailPage({ params }: Props) {
  const { user } = await requireSession();
  const { slug } = await params;
  const [detail, status] = await Promise.all([getExerciseDetail(user.id, slug), aiStatus('exercise_tip', user.id)]);
  if (!detail) notFound();
  const { exercise: ex, media } = detail;
  const steps = ex.instructionsEs.length > 0 ? ex.instructionsEs : ex.instructionsEn;
  const translated = ex.instructionsEs.length > 0;
  const source = SOURCE_LABELS[ex.source];
  const intensity = Object.fromEntries(ex.primaryMuscles.map((m) => [m, 1])) as Partial<Record<MuscleGroup, number>>;

  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/ejercicios" className="label">
          ← Ejercicios
        </Link>
        <h1 className="text-4xl md:text-5xl">{ex.nameEs}</h1>
        {ex.nameEs !== ex.nameEn ? <p className="text-text-3">{ex.nameEn}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Chip>{PATTERN_LABELS_ES[ex.pattern] ?? ex.pattern}</Chip>
          <Chip>{LOAD_TYPE_LABELS_ES[ex.loadType]}</Chip>
          <Chip>{LEVEL_LABELS[ex.level]}</Chip>
          {!ex.reviewed ? <Chip tone="down">Texto sin revisar</Chip> : null}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <ViewTransition name={`exercise-${ex.id}`}>
          <ExerciseMedia start={media.start} end={media.end} main={media.main} alt={ex.nameEs} size="large" />
        </ViewTransition>
        <div className="flex flex-col gap-4">
          <MuscleMap intensity={intensity} secondary={ex.secondaryMuscles as MuscleGroup[]} />
          <p className="text-sm text-text-2">
            <span className="label mr-2">Principales</span>
            {musclesText(ex.primaryMuscles) || '—'}
          </p>
          {ex.secondaryMuscles.length > 0 ? (
            <p className="text-sm text-text-2">
              <span className="label mr-2">Secundarios</span>
              {musclesText(ex.secondaryMuscles)}
            </p>
          ) : null}
        </div>
      </div>

      {ex.videoId ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Video de técnica</h2>
          <div className="aspect-video overflow-hidden rounded-card border border-border">
            <iframe
              className="size-full"
              src={`https://www.youtube-nocookie.com/embed/${ex.videoId}`}
              title={`Video: ${ex.nameEs}`}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      ) : null}

      {steps.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Cómo se hace</h2>
          {!translated ? <p className="text-sm text-text-3">Instrucciones en inglés: la traducción está pendiente de revisión.</p> : null}
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="label w-6 shrink-0 pt-1 tnum">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-text-2">{s}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {ex.cuesEs.length > 0 || ex.commonErrorsEs.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {ex.cuesEs.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-xl">Claves de técnica</h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-text-2">
                {ex.cuesEs.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Card>
          ) : null}
          {ex.commonErrorsEs.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-xl">Errores comunes</h2>
              <ul className="flex list-disc flex-col gap-2 pl-5 text-text-2">
                {ex.commonErrorsEs.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      ) : null}

      <TipCard exerciseId={ex.id} tip={detail.tip?.text ?? null} aiAvailable={status.available} />

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Tu historial</h2>
        {detail.history.sessions === 0 ? (
          <p className="text-text-3">Aún no lo has registrado.</p>
        ) : (
          <Card className="grid grid-cols-2 gap-6">
            <Metric label="Mejor serie" value={<span className="text-2xl">{detail.history.bestText ?? '—'}</span>} />
            <Metric label="1RM estimado" value={detail.history.bestE1rm ?? '—'} unit={detail.history.bestE1rm ? 'kg' : undefined} />
            {detail.history.last ? (
              <div className="col-span-2 flex flex-col gap-1">
                <span className="label">Última vez · {formatShortDate(detail.history.last.date)}</span>
                <p className="text-text-2 tnum">{detail.history.last.sets.join(' · ')}</p>
              </div>
            ) : null}
            <Link href={`/progreso/ejercicio/${ex.slug}`} className="col-span-2 text-sm text-text-2 underline underline-offset-4">
              Ver gráficas de progreso
            </Link>
          </Card>
        )}
      </section>

      {detail.ladder.previous || detail.ladder.next ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Escalera de progresión</h2>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { label: 'Anterior', item: detail.ladder.previous },
              { label: 'Actual', item: { id: ex.id, slug: ex.slug, name: ex.nameEs, threshold: null } },
              { label: 'Siguiente', item: detail.ladder.next },
            ].map(({ label, item }) => (
              <li key={label} className="rounded-card border border-border p-4">
                <span className="label">{label}</span>
                {item ? (
                  label === 'Actual' ? (
                    <p className="mt-1">{item.name}</p>
                  ) : (
                    <Link href={`/ejercicios/${item.slug}`} className="mt-1 block underline-offset-4 hover:underline">
                      {item.name}
                    </Link>
                  )
                ) : (
                  <p className="mt-1 text-text-3">—</p>
                )}
                {label === 'Siguiente' && detail.ladder.next?.threshold ? (
                  <p className="mt-1 text-sm text-text-3">
                    Umbral: {detail.ladder.next.threshold.value} {detail.ladder.next.threshold.kind === 'reps' ? 'repeticiones' : 's'} en {detail.ladder.next.threshold.sessions} sesiones seguidas
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-xl">Equipo</h2>
          {detail.equipment.length === 0 ? (
            <p className="text-text-3">Sin equipo.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {detail.equipment.map((e) => (
                <li key={e.slug}>
                  <Chip tone={e.available ? 'neutral' : 'down'}>{e.nameEs}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-xl">Alternativas del mismo patrón</h2>
          {detail.alternatives.length === 0 ? (
            <p className="text-text-3">Completa tu perfil y equipamiento para ver alternativas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.alternatives.map((a) => (
                <li key={a.id}>
                  <Link href={`/ejercicios/${a.slug}`} className="underline-offset-4 hover:underline">
                    {a.nameEs}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {isAdmin(user) ? <ExerciseAdminTools exerciseId={ex.id} videoId={ex.videoId} reviewed={ex.reviewed} /> : null}

      <footer className="border-t border-border pt-4 text-sm text-text-3">
        {source ? (
          <p>
            Datos e imágenes:{' '}
            <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {source.label}
            </a>{' '}
            · {source.license}
            {media.source && media.source !== ex.source && media.attributionUrl ? (
              <>
                {' '}
                · Imagen:{' '}
                <a href={media.attributionUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  {media.source}
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </footer>
    </article>
  );
}
