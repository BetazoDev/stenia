'use client';

import { restDurationMs, restRemainingMs, formatClock } from '@stenia/core';

import type { RestState } from '@/lib/local-db';

/** Cuenta regresiva del descanso recomendado con ±15 s y saltar. */
export function RestBar({ rest, now, onAdjust, onSkip }: { rest: RestState; now: number; onAdjust: (delta: number) => void; onSkip: () => void }) {
  const remaining = restRemainingMs(rest, now);
  const total = restDurationMs(rest);
  const pct = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100;
  const done = remaining <= 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 backdrop-blur md:left-60" role="timer" aria-live="off">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="h-1 w-full overflow-hidden rounded-pill bg-border">
          <div className="h-full bg-text transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="label">{done ? 'Descanso terminado' : 'Descanso'}</span>
            <span className={done ? 'font-display text-4xl tracking-display tnum text-up' : 'font-display text-4xl tracking-display tnum'}>{formatClock(Math.ceil(remaining / 1000))}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onAdjust(-15)} className="h-11 rounded-pill border border-border px-4 text-sm tnum" aria-label="Restar 15 segundos">
              −15 s
            </button>
            <button type="button" onClick={() => onAdjust(15)} className="h-11 rounded-pill border border-border px-4 text-sm tnum" aria-label="Sumar 15 segundos">
              +15 s
            </button>
            <button type="button" onClick={onSkip} className="h-11 rounded-pill border border-border-strong px-4 text-[13px] font-medium uppercase tracking-label">
              {done ? 'Listo' : 'Saltar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
