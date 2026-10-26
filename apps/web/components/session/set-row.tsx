'use client';

import {
  compareSet,
  kgToUnit,
  unitToKg,
  weightStepIn,
  type LoadType,
  type WeightUnit,
} from '@stenia/core';
import { Check, Play, Square } from 'lucide-react';

import { Stepper } from '@/components/ui/stepper';
import type { LocalSet } from '@/lib/local-db';
import type { HistorySet } from '@/lib/session-data';
import { cn } from '@/lib/utils';

import { toLogged } from './session-actions';

type SetRowProps = {
  set: LocalSet;
  loadType: LoadType;
  last: HistorySet | null;
  current: boolean;
  isometricStartedAt: number | null;
  now: number;
  weightStep: number;
  /** Unidad en que se muestra y se captura el peso (se guarda en kg). */
  unit: WeightUnit;
  onChange: (patch: Partial<LocalSet>) => void;
  onStep: (
    field: 'weightKg' | 'assistanceKg' | 'addedWeightKg' | 'reps' | 'seconds',
    delta: number,
  ) => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onIsometricStart: () => void;
  onIsometricStop: () => void;
};

const DELTA_CLASS = { up: 'text-up', same: 'text-text-3', down: 'text-down' } as const;

function deltaText(d: ReturnType<typeof compareSet>, loadType: LoadType, unit: WeightUnit): string {
  if (!d) return '';
  const sign = (n: number | null, label: string) =>
    n === null || n === 0 ? null : `${n > 0 ? '+' : ''}${n}${label}`;
  const w = (kg: number | null) => (kg === null ? null : kgToUnit(kg, unit));
  const parts =
    loadType === 'isometric'
      ? [sign(d.seconds, ' s')]
      : loadType === 'assisted'
        ? [
            sign(d.assistanceKg !== null ? -(w(d.assistanceKg) ?? 0) : null, ` ${unit} menos`),
            sign(d.reps, ' reps'),
          ]
        : [sign(w(d.weightKg), ` ${unit}`), sign(d.reps, ' reps')];
  const text = parts.filter(Boolean).join(' · ');
  return text || '=';
}

/** Fila de serie precargada: +/− y ✓. El delta frente a la última vez se pinta verde, gris o ámbar. */
export function SetRow(props: SetRowProps) {
  const { set, loadType, last, current, now, weightStep, unit } = props;
  // En libras el selector muestra lb con pasos redondos (5, 10…) y guarda el equivalente en kg.
  const weight = (
    kg: number | null,
    kgStep: number,
    field: 'weightKg' | 'assistanceKg' | 'addedWeightKg',
  ) => {
    if (unit === 'kg')
      return {
        value: kg,
        step: kgStep,
        unit: 'kg',
        onChange: (v: number) => props.onChange({ [field]: v }),
        onStep: (d: number) => props.onStep(field, d),
      };
    const step = weightStepIn(kgStep, 'lb');
    const lb = kg === null ? null : kgToUnit(kg, 'lb');
    const apply = (value: number) =>
      props.onChange({ [field]: unitToKg(Math.max(0, value), 'lb') });
    return {
      value: lb,
      step,
      unit: 'lb',
      onChange: apply,
      onStep: (d: number) => {
        const cur = lb ?? 0;
        apply(
          d > 0
            ? Math.floor(cur / step + 1e-9) * step + step
            : Math.ceil(cur / step - 1e-9) * step - step,
        );
      },
    };
  };
  const done = set.completedAt !== null;
  const delta = last
    ? compareSet(
        { ...toLogged(set), completed: true },
        {
          weightKg: last.weightKg,
          assistanceKg: last.assistanceKg,
          addedWeightKg: last.addedWeightKg,
          reps: last.reps,
          seconds: last.seconds,
          rir: last.rir,
          completed: true,
        },
        loadType,
      )
    : null;
  const running = props.isometricStartedAt !== null && !done;
  const elapsed = running ? Math.floor((now - (props.isometricStartedAt ?? now)) / 1000) : null;

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-input border p-3 transition-colors',
        current && !done ? 'border-border-strong bg-card-hover' : 'border-border',
        done && 'opacity-90',
      )}
      aria-label={`Serie ${set.setNumber}${done ? ', registrada' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label">Serie {set.setNumber}</span>
        <span className="flex items-center gap-2 text-sm">
          {set.isRecord ? (
            <span className="rounded-chip border border-accent px-1.5 text-[11px] uppercase tracking-label text-accent motion-safe:animate-[pop_400ms_ease-out]">
              Récord
            </span>
          ) : null}
          {set.pain ? <span className="text-down">Dolor</span> : null}
          {delta ? (
            <span className={cn('tnum', DELTA_CLASS[delta.direction])}>
              {deltaText(delta, loadType, unit)}
            </span>
          ) : null}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {loadType === 'external' ? (
          <Stepper
            label={`Peso de la serie ${set.setNumber}`}
            {...weight(set.weightKg, weightStep, 'weightKg')}
          />
        ) : null}
        {loadType === 'weighted_bw' ? (
          <Stepper
            label={`Lastre de la serie ${set.setNumber}`}
            {...weight(set.addedWeightKg, weightStep, 'addedWeightKg')}
          />
        ) : null}
        {loadType === 'assisted' ? (
          <Stepper
            label={`Asistencia de la serie ${set.setNumber}`}
            {...weight(set.assistanceKg, 5, 'assistanceKg')}
          />
        ) : null}
        {loadType === 'isometric' ? (
          running ? (
            <output
              className="col-span-2 py-1 text-center font-display text-4xl tracking-display tnum text-accent"
              aria-live="polite"
            >
              {elapsed} / {set.target?.seconds ?? set.seconds} s
            </output>
          ) : (
            <Stepper
              label={`Segundos de la serie ${set.setNumber}`}
              value={set.seconds}
              step={5}
              unit="s"
              onChange={(v) => props.onChange({ seconds: v })}
              onStep={(d) => props.onStep('seconds', d)}
            />
          )
        ) : (
          <Stepper
            className={loadType === 'bodyweight' ? 'col-span-2 justify-center' : undefined}
            label={`Repeticiones de la serie ${set.setNumber}`}
            value={set.reps}
            step={1}
            max={100}
            unit="reps"
            onChange={(v) => props.onChange({ reps: v })}
            onStep={(d) => props.onStep('reps', d)}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        {!done ? (
          <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label="Repeticiones en reserva"
          >
            <span className="label mr-1">RIR</span>
            {[0, 1, 2, 3, 4].map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={set.rir === r}
                onClick={() => props.onChange({ rir: set.rir === r ? null : r })}
                className={cn(
                  'h-10 min-w-9 rounded-chip border px-2 text-sm tnum',
                  set.rir === r ? 'border-text bg-text text-bg' : 'border-border text-text-2',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-text-3">
            {set.rir !== null ? `RIR ${set.rir}` : 'Registrada'}
          </span>
        )}
        <div className="flex items-center gap-2">
          {loadType === 'isometric' && !done ? (
            running ? (
              <button
                type="button"
                onClick={props.onIsometricStop}
                className="grid size-13 place-items-center rounded-pill border border-accent text-accent"
                aria-label="Detener isométrico"
              >
                <Square strokeWidth={1.5} className="size-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={props.onIsometricStart}
                className="grid size-13 place-items-center rounded-pill border border-border-strong text-text"
                aria-label="Iniciar isométrico"
              >
                <Play strokeWidth={1.5} className="size-5" />
              </button>
            )
          ) : null}
          <button
            type="button"
            onClick={done ? props.onUncomplete : props.onComplete}
            aria-pressed={done}
            aria-label={
              done ? `Desmarcar serie ${set.setNumber}` : `Registrar serie ${set.setNumber}`
            }
            className={cn(
              'grid size-13 place-items-center rounded-pill border transition-colors',
              done
                ? 'border-text bg-text text-bg'
                : current
                  ? 'border-accent bg-accent text-white'
                  : 'border-border-strong text-text-2',
            )}
          >
            <Check strokeWidth={2.25} className="size-6" />
          </button>
        </div>
      </div>
    </li>
  );
}
