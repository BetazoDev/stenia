'use client';

import {
  endClock,
  exerciseDurationMs,
  formatClock,
  pauseClock,
  restEndsAt,
  restRemainingMs,
  resumeClock,
  sessionElapsedMs,
  adjustRest,
  repExerciseFor,
  formatWeight,
  RECORD_LABELS_ES,
  type WeightUnit,
} from '@stenia/core';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRightLeft,
  Ban,
  Check,
  NotebookPen,
  Pause,
  Play,
  Plus,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ExerciseMedia } from '@/components/exercise-media';
import { useWeightUnit } from '@/components/units/weight-unit';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { localDb, type LocalExercise, type LocalSet } from '@/lib/local-db';
import { musclesText } from '@/lib/labels';
import { flushOutbox, startBackgroundSync } from '@/lib/sync-client';
import { cn } from '@/lib/utils';

import { restEndAlert, scheduleRestPush, unlockAudio, useNow, useWakeLock } from './device';
import { RestBar } from './rest-bar';
import {
  estimateActualRest,
  localRecords,
  stepSet,
  substituteExercise,
  updateExercise,
  updateSession,
  updateSet,
  uuid,
} from './session-actions';
import { RepCounter } from './rep-counter';
import { SessionSummaryView } from './session-summary';
import { SetRow } from './set-row';

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(iso));

function lastSetText(
  s: {
    weightKg: number | null;
    assistanceKg: number | null;
    addedWeightKg: number | null;
    reps: number | null;
    seconds: number | null;
    rir: number | null;
  },
  loadType: string,
  unit: WeightUnit,
) {
  const rir = s.rir !== null ? ` (RIR ${s.rir})` : '';
  if (loadType === 'isometric') return `${s.seconds ?? 0} s${rir}`;
  if (loadType === 'assisted')
    return `asist. ${formatWeight(s.assistanceKg ?? 0, unit)} × ${s.reps ?? 0}${rir}`;
  if (loadType === 'weighted_bw')
    return `+${formatWeight(s.addedWeightKg ?? 0, unit)} × ${s.reps ?? 0}${rir}`;
  if (loadType === 'bodyweight') return `${s.reps ?? 0} reps${rir}`;
  return `${formatWeight(s.weightKg ?? 0, unit)} × ${s.reps ?? 0}${rir}`;
}

type SheetKind = 'none' | 'finish' | 'substitute' | 'busy' | 'notes' | 'pain' | 'media' | 'camera';

export function LiveSession({ sessionId }: { sessionId: string }) {
  const db = localDb();
  const router = useRouter();
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const exercises = useLiveQuery(
    () => db.exercises.where('sessionId').equals(sessionId).sortBy('sortOrder'),
    [sessionId],
  );
  const sets = useLiveQuery(
    () => db.sets.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  );
  const now = useNow(250);
  const unit = useWeightUnit();
  const active = session?.status === 'active';
  const wakeLock = useWakeLock(active);
  const [sheet, setSheet] = useState<SheetKind>('none');
  const [iso, setIso] = useState<Record<string, number>>({});
  const [effort, setEffort] = useState<number | null>(null);
  const [finalNotes, setFinalNotes] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const alerted = useRef<string | null>(null);

  useEffect(() => {
    startBackgroundSync();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const current: LocalExercise | undefined =
    exercises?.[session?.currentIndex ?? 0] ?? exercises?.[0];
  const currentSets = useMemo(
    () =>
      (sets ?? [])
        .filter((s) => s.sessionExerciseId === current?.id)
        .sort((a, b) => a.setNumber - b.setNumber),
    [sets, current?.id],
  );
  const nextOpen = currentSets.find((s) => s.completedAt === null);

  // Fin del descanso: sonido, vibración y marca para no repetir el aviso.
  useEffect(() => {
    const rest = session?.rest;
    if (!rest || rest.notifiedAt) return;
    if (restRemainingMs(rest, now) <= 0 && alerted.current !== rest.setId) {
      alerted.current = rest.setId;
      restEndAlert();
      void db.sessions.update(sessionId, { rest: { ...rest, notifiedAt: now } });
    }
  }, [now, session?.rest, db, sessionId]);

  // Isométrico: se detiene solo al alcanzar el objetivo (comprobación en un intervalo, no en el render).
  const isoRef = useRef(iso);
  const setsRef = useRef(sets);
  const completeRef = useRef<(s: LocalSet, seconds?: number) => Promise<void>>(
    async () => undefined,
  );
  useEffect(() => {
    isoRef.current = iso;
    setsRef.current = sets;
    // `completeSet` es una declaración de función (elevada): se publica para el intervalo tras cada render.
    completeRef.current = completeSet;
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      for (const [setId, startedAt] of Object.entries(isoRef.current)) {
        const s = setsRef.current?.find((x) => x.id === setId);
        const target = s?.target?.seconds ?? s?.seconds ?? null;
        if (s && target && (t - startedAt) / 1000 >= target) {
          restEndAlert();
          setIso((m) => {
            const next = { ...m };
            delete next[setId];
            return next;
          });
          void completeRef.current(s, target);
        }
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  if (session === undefined || exercises === undefined || sets === undefined) {
    return <p className="text-text-3">Cargando sesión…</p>;
  }
  if (!session) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl">Sesión no encontrada en este dispositivo</h1>
        <Button asChild variant="secondary">
          <Link href="/hoy">Volver a Hoy</Link>
        </Button>
      </div>
    );
  }
  if (session.status !== 'active') {
    return <SessionSummaryView session={session} exercises={exercises} sets={sets} unit={unit} />;
  }

  const clock = {
    startedAt: session.startedAt,
    pausedMs: session.pausedMs,
    pausedAt: session.pausedAt,
    endedAt: session.endedAt,
  };
  const elapsed = sessionElapsedMs(clock, now);
  const paused = session.pausedAt !== null;
  const snapshot = current?.snapshot;
  const repExercise = snapshot
    ? repExerciseFor({ name: snapshot.name, slug: snapshot.slug, pattern: snapshot.pattern })
    : null;
  const weightStep = snapshot?.equipment.includes('dumbbells') ? 1 : 2.5;

  async function completeSet(set: LocalSet, isometricSeconds?: number) {
    unlockAudio();
    if (!current || !session) return;
    const t = Date.now();
    const all = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter(
      (s) => s.completedAt !== null,
    );
    const prevCompleted = all.length ? Math.max(...all.map((s) => s.completedAt ?? 0)) : null;
    const seconds = isometricSeconds ?? set.seconds;
    const exerciseSets = all.filter((s) => s.sessionExerciseId === set.sessionExerciseId);
    const withValues = { ...set, seconds, completedAt: t };
    const records = localRecords(withValues, current.snapshot, exerciseSets);
    await updateSet(set.id, {
      seconds,
      completedAt: t,
      startedAt: set.startedAt ?? t,
      restActualSeconds: estimateActualRest(
        prevCompleted,
        t,
        current.snapshot.loadType,
        set.reps,
        seconds,
      ),
      isRecord: records.length > 0,
    });
    if (records.length > 0) {
      setToast(`Récord: ${records.map((r) => RECORD_LABELS_ES[r.type].toLowerCase()).join(', ')}`);
      window.setTimeout(() => setToast(null), 3500);
    }
    const remaining = currentSets.filter((s) => s.id !== set.id && s.completedAt === null);
    await updateExercise(current.id, {
      startedAt: current.startedAt ?? set.startedAt ?? t,
      endedAt: remaining.length === 0 ? t : null,
    });
    const restSeconds = current.snapshot.prescription.restSeconds;
    const rest = {
      startedAt: t,
      targetSeconds: restSeconds,
      adjustSeconds: 0,
      sessionExerciseId: current.id,
      setId: set.id,
      notifiedAt: null,
    };
    const exIndex = exercises?.findIndex((e) => e.id === current.id) ?? 0;
    const nextIndex =
      remaining.length === 0 && exercises && exIndex < exercises.length - 1
        ? exIndex + 1
        : session.currentIndex;
    await updateSession(sessionId, { rest, currentIndex: nextIndex });
    void scheduleRestPush(restEndsAt(rest), `Descanso terminado · ${current.snapshot.name}`);
  }

  async function uncompleteSet(set: LocalSet) {
    await updateSet(set.id, { completedAt: null, isRecord: false, restActualSeconds: null });
    if (current) await updateExercise(current.id, { endedAt: null });
  }

  async function addSet() {
    if (!current) return;
    const last = currentSets[currentSets.length - 1];
    const t = Date.now();
    const row: LocalSet = {
      id: uuid(),
      sessionExerciseId: current.id,
      sessionId,
      setNumber: (last?.setNumber ?? 0) + 1,
      weightKg: last?.weightKg ?? null,
      assistanceKg: last?.assistanceKg ?? null,
      addedWeightKg: last?.addedWeightKg ?? null,
      reps: last?.reps ?? current.snapshot.prescription.repMin,
      seconds: last?.seconds ?? current.snapshot.prescription.targetSeconds,
      rir: null,
      target: last?.target ?? null,
      startedAt: null,
      completedAt: null,
      restActualSeconds: null,
      restTargetSeconds: current.snapshot.prescription.restSeconds,
      pain: false,
      notes: null,
      isRecord: false,
      updatedAt: t,
    };
    await db.sets.add(row);
    await updateSet(row.id, {});
    await updateExercise(current.id, { endedAt: null });
  }

  const togglePause = () => {
    const t = Date.now();
    const next = paused ? resumeClock(clock, t) : pauseClock(clock, t);
    void updateSession(sessionId, { pausedMs: next.pausedMs, pausedAt: next.pausedAt });
  };

  const finish = async () => {
    const t = Date.now();
    const ended = endClock(clock, t);
    await updateSession(sessionId, {
      status: 'completed',
      endedAt: ended.endedAt,
      pausedMs: ended.pausedMs,
      pausedAt: null,
      rest: null,
      effort,
      notes: finalNotes.trim() || null,
    });
    void scheduleRestPush(null, '');
    setSheet('none');
    void flushOutbox();
  };

  const discard = async () => {
    if (!window.confirm('¿Descartar esta sesión? Las series registradas no contarán.')) return;
    await updateSession(sessionId, { status: 'discarded', endedAt: Date.now(), rest: null });
    router.push('/hoy');
  };

  const busyEquipment = new Set(snapshot?.equipment ?? []);
  const alternatives = (snapshot?.alternatives ?? []).filter(
    (a) => a.exerciseId !== current?.exerciseId,
  );
  const busyAlternatives = alternatives.filter(
    (a) => !a.equipment.some((e) => busyEquipment.has(e)),
  );
  const completedCount = (sets ?? []).filter((s) => s.completedAt !== null).length;
  const exerciseElapsed = current ? exerciseDurationMs(current.startedAt, current.endedAt, now) : 0;

  return (
    <div className={cn('flex flex-col gap-5', session.rest ? 'pb-36' : 'pb-10')}>
      <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:-mx-10 md:px-10">
        <div className="flex flex-col">
          <span className="label">
            {session.dayName}
            {session.deload ? ' · descarga' : ''}
          </span>
          <span
            className={cn(
              'font-display text-4xl leading-none tracking-display tnum',
              paused && 'text-text-3',
            )}
            role="timer"
            aria-label="Tiempo de sesión"
          >
            {formatClock(Math.floor(elapsed / 1000))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            className="grid size-11 place-items-center rounded-pill border border-border"
            aria-label={paused ? 'Reanudar sesión' : 'Pausar sesión'}
          >
            {paused ? (
              <Play strokeWidth={1.5} className="size-5" />
            ) : (
              <Pause strokeWidth={1.5} className="size-5" />
            )}
          </button>
          <Button variant="secondary" size="sm" onClick={() => setSheet('finish')}>
            Terminar
          </Button>
        </div>
      </header>

      {!online ? (
        <p className="rounded-input border border-border px-3 py-2 text-sm text-text-2">
          Sin conexión: todo se guarda en el teléfono y se sincroniza al volver.
        </p>
      ) : null}
      {!wakeLock ? (
        <p className="text-sm text-text-3">
          Este navegador no permite mantener la pantalla encendida.
        </p>
      ) : null}

      <nav
        aria-label="Ejercicios de la sesión"
        className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        <ol className="flex gap-2">
          {exercises.map((e, i) => {
            const es = sets.filter((s) => s.sessionExerciseId === e.id);
            const done = es.length > 0 && es.every((s) => s.completedAt !== null);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => void updateSession(sessionId, { currentIndex: i })}
                  aria-current={e.id === current?.id ? 'step' : undefined}
                  className={cn(
                    'flex h-11 items-center gap-2 whitespace-nowrap rounded-pill border px-4 text-sm',
                    e.id === current?.id ? 'border-text text-text' : 'border-border text-text-2',
                    done && 'text-text-3',
                  )}
                >
                  <span className="tnum">{String(i + 1).padStart(2, '0')}</span>
                  <span className="max-w-36 truncate">{e.snapshot.name}</span>
                  {done ? <Check strokeWidth={2} className="size-4" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {current && snapshot ? (
        <section className="flex flex-col gap-5" aria-label={snapshot.name}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSheet('media')}
              aria-label={`Ver técnica de ${snapshot.name}`}
            >
              <ExerciseMedia
                start={snapshot.media.start}
                end={snapshot.media.end}
                main={snapshot.media.main}
                alt={snapshot.name}
                className="size-20"
              />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl leading-tight md:text-3xl">{snapshot.name}</h1>
              <p className="truncate text-sm text-text-3">{musclesText(snapshot.primaryMuscles)}</p>
              {current.substitutedFromExerciseId ? (
                <p className="text-sm text-text-3">Sustituto</p>
              ) : null}
            </div>
            <div className="text-right">
              <span className="label">Ejercicio</span>
              <p className="font-display text-xl tracking-display tnum">
                {formatClock(Math.floor(exerciseElapsed / 1000))}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-card border border-border p-4">
              <span className="label">Última vez</span>
              {snapshot.lastTime ? (
                <>
                  <p className="mt-1 text-sm text-text-3">
                    {fmtDate(snapshot.lastTime.date)}
                    {snapshot.lastTime.sameDay ? '' : ' · en otro día'}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1 tnum">
                    {snapshot.lastTime.sets.map((s, i) => (
                      <li key={i} className="text-text-2">
                        {lastSetText(s, snapshot.loadType, unit)}
                      </li>
                    ))}
                  </ul>
                  {snapshot.bestText ? (
                    <p className="mt-2 text-sm text-text-3">
                      Mejor: {snapshot.bestText}
                      {snapshot.bestE1rm
                        ? ` · 1RM est. ${formatWeight(snapshot.bestE1rm, unit)}`
                        : ''}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-text-3">Primera vez con este ejercicio.</p>
              )}
            </div>
            <div className="rounded-card border border-border p-4">
              <span className="label">Hoy</span>
              <p className="mt-1 font-display text-2xl tracking-display tnum">
                {snapshot.targetText}
              </p>
              <p className="mt-1 text-sm text-text-2">{snapshot.target.reason}</p>
              {snapshot.target.suggestedExerciseId ? (
                <p className="mt-2 text-sm text-text-2">
                  Sugerencia:{' '}
                  {snapshot.target.action === 'advance_variant'
                    ? snapshot.ladder.next?.name
                    : snapshot.ladder.previous?.name}
                </p>
              ) : null}
              {snapshot.notes ? <p className="mt-2 text-sm text-text-3">{snapshot.notes}</p> : null}
            </div>
          </div>

          <ol className="flex flex-col gap-2">
            {currentSets.map((s) => (
              <SetRow
                key={s.id}
                set={s}
                loadType={snapshot.loadType}
                last={snapshot.lastTime?.sets[s.setNumber - 1] ?? null}
                current={s.id === nextOpen?.id}
                isometricStartedAt={iso[s.id] ?? null}
                now={now}
                weightStep={weightStep}
                unit={unit}
                onChange={(patch) => void updateSet(s.id, patch, false)}
                onStep={(field, delta) =>
                  void stepSet(
                    s.id,
                    field,
                    delta,
                    0,
                    field === 'reps' ? 100 : field === 'seconds' ? 3600 : 1000,
                  )
                }
                onComplete={() => void completeSet(s)}
                onUncomplete={() => void uncompleteSet(s)}
                onIsometricStart={() => {
                  unlockAudio();
                  const t = Date.now();
                  setIso((m) => ({ ...m, [s.id]: t }));
                  void updateSet(s.id, { startedAt: t }, false);
                  if (!current.startedAt) void updateExercise(current.id, { startedAt: t });
                }}
                onIsometricStop={() => {
                  const started = iso[s.id];
                  if (!started) return;
                  const secs = Math.max(1, Math.round((Date.now() - started) / 1000));
                  setIso((m) => {
                    const next = { ...m };
                    delete next[s.id];
                    return next;
                  });
                  void completeSet(s, secs);
                }}
              />
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void addSet()}>
              <Plus strokeWidth={1.5} /> Serie
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNoteDraft(current.notes ?? '');
                setSheet('notes');
              }}
            >
              <NotebookPen strokeWidth={1.5} /> Nota
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSheet('substitute')}>
              <ArrowRightLeft strokeWidth={1.5} /> Sustituir
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSheet('busy')}>
              <Ban strokeWidth={1.5} /> Equipo ocupado
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSheet('pain')}>
              <AlertTriangle strokeWidth={1.5} /> Dolor
            </Button>
            {repExercise && nextOpen && snapshot.loadType !== 'isometric' ? (
              <Button variant="ghost" size="sm" onClick={() => setSheet('camera')}>
                <Video strokeWidth={1.5} /> Contar con cámara
              </Button>
            ) : null}
          </div>

          {!nextOpen && exercises.findIndex((e) => e.id === current.id) < exercises.length - 1 ? (
            <Button
              block
              onClick={() =>
                void updateSession(sessionId, {
                  currentIndex: exercises.findIndex((e) => e.id === current.id) + 1,
                })
              }
            >
              Siguiente ejercicio
            </Button>
          ) : null}
          {!nextOpen && exercises.findIndex((e) => e.id === current.id) === exercises.length - 1 ? (
            <Button block onClick={() => setSheet('finish')}>
              Terminar sesión
            </Button>
          ) : null}
        </section>
      ) : null}

      <p className="text-center text-sm text-text-3 tnum">{completedCount} series registradas</p>

      {toast ? (
        <div
          className="fixed inset-x-4 top-20 z-40 mx-auto max-w-md rounded-card border border-accent bg-surface px-4 py-3 text-center motion-safe:animate-[pop_400ms_ease-out]"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {session.rest ? (
        <RestBar
          rest={session.rest}
          now={now}
          onAdjust={(delta) => {
            const rest = session.rest;
            if (!rest) return;
            const next = {
              ...adjustRest(rest, delta, Date.now()),
              sessionExerciseId: rest.sessionExerciseId,
              setId: rest.setId,
              notifiedAt: null,
            };
            alerted.current = null;
            void updateSession(sessionId, { rest: next });
            void scheduleRestPush(restEndsAt(next), `Descanso terminado · ${snapshot?.name ?? ''}`);
          }}
          onSkip={() => {
            void updateSession(sessionId, { rest: null });
            void scheduleRestPush(null, '');
          }}
        />
      ) : null}

      <Sheet
        open={sheet === 'finish'}
        onOpenChange={(o) => setSheet(o ? 'finish' : 'none')}
        title="Terminar sesión"
        description="¿Qué tan dura fue? (1 = muy ligera, 10 = máximo esfuerzo)"
      >
        <div className="flex flex-col gap-4">
          <div
            className="grid grid-cols-5 gap-2"
            role="radiogroup"
            aria-label="Esfuerzo de la sesión"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={effort === n}
                onClick={() => setEffort(n)}
                className={cn(
                  'h-12 rounded-input border font-display text-xl tnum',
                  effort === n ? 'border-text bg-text text-bg' : 'border-border',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Notas de la sesión (opcional)"
            value={finalNotes}
            onChange={(e) => setFinalNotes(e.target.value)}
            maxLength={2000}
            aria-label="Notas de la sesión"
          />
          <Button block onClick={() => void finish()}>
            Guardar y ver resumen
          </Button>
          <Button variant="ghost" block onClick={() => void discard()}>
            Descartar sesión
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'notes'}
        onOpenChange={(o) => setSheet(o ? 'notes' : 'none')}
        title="Nota del ejercicio"
      >
        <div className="flex flex-col gap-3">
          <Textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            maxLength={1000}
            autoFocus
            aria-label="Nota"
          />
          <Button
            onClick={() => {
              if (current) void updateExercise(current.id, { notes: noteDraft.trim() || null });
              setSheet('none');
            }}
          >
            Guardar nota
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'substitute' || sheet === 'busy'}
        onOpenChange={(o) => setSheet(o ? sheet : 'none')}
        title={sheet === 'busy' ? 'Equipo ocupado' : 'Sustituir ejercicio'}
        description={
          sheet === 'busy'
            ? 'Alternativas del mismo patrón que no usan ese equipo. La rutina no se regenera.'
            : 'Alternativas del mismo patrón con tu equipo.'
        }
      >
        <ul className="flex flex-col gap-2">
          {(sheet === 'busy' ? busyAlternatives : alternatives).map((a) => (
            <li key={a.exerciseId}>
              <button
                type="button"
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-input border border-border px-4 text-left hover:bg-card-hover"
                onClick={() => {
                  if (current) void substituteExercise(current, a, session.routineDayId);
                  setSheet('none');
                }}
              >
                <span>{a.name}</span>
                <ArrowRightLeft strokeWidth={1.5} className="size-4 text-text-3" />
              </button>
            </li>
          ))}
          {(sheet === 'busy' ? busyAlternatives : alternatives).length === 0 ? (
            <p className="text-text-3">No hay alternativas con tu equipo.</p>
          ) : null}
        </ul>
      </Sheet>

      <Sheet
        open={sheet === 'pain'}
        onOpenChange={(o) => setSheet(o ? 'pain' : 'none')}
        title="¿Sentiste dolor?"
        description="El dolor agudo o punzante es señal de parar. Stenia no diagnostica: si persiste, consulta a un profesional."
      >
        <div className="flex flex-col gap-3">
          <p className="text-text-2">
            Marcaremos la serie y abriremos una revisión adelantada para ajustar tu rutina.
          </p>
          <Button
            onClick={() => {
              const target =
                [...currentSets].reverse().find((s) => s.completedAt !== null) ?? nextOpen;
              if (target) {
                void updateSet(target.id, {
                  pain: true,
                  completedAt: target.completedAt ?? Date.now(),
                });
              }
              setSheet('substitute');
            }}
          >
            Marcar dolor y ver sustitutos
          </Button>
          <Button variant="ghost" onClick={() => setSheet('none')}>
            Cancelar
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'camera'}
        onOpenChange={(o) => setSheet(o ? 'camera' : 'none')}
        title="Contar con cámara"
        className="md:max-w-2xl"
      >
        {repExercise && sheet === 'camera' ? (
          <RepCounter
            exercise={repExercise}
            onUse={(reps) => {
              if (nextOpen) void updateSet(nextOpen.id, { reps }, false);
              setSheet('none');
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={sheet === 'media'}
        onOpenChange={(o) => setSheet(o ? 'media' : 'none')}
        title={snapshot?.name ?? 'Técnica'}
      >
        {snapshot ? (
          <div className="flex flex-col gap-3">
            <ExerciseMedia
              start={snapshot.media.start}
              end={snapshot.media.end}
              main={snapshot.media.main}
              alt={snapshot.name}
              size="large"
            />
            {snapshot.slug ? (
              <Link
                href={`/ejercicios/${snapshot.slug}`}
                className="text-sm text-text-2 underline underline-offset-4"
              >
                Ver ficha completa
              </Link>
            ) : null}
            {snapshot.media.source ? (
              <p className="text-sm text-text-3">Imagen: {snapshot.media.source}</p>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
