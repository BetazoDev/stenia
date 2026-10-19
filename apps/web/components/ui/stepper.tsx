'use client';

import { Minus, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';

type StepperProps = {
  value: number | null;
  onChange: (value: number) => void;
  /** Si se pasa, los botones envían el incremento (suma atómica) en lugar del valor absoluto. */
  onStep?: (delta: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  label: string;
  size?: 'md' | 'lg';
  className?: string;
};

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n);

/** Selector numérico con +/− de 44 px mínimo (se usa con manos sudadas). */
export function Stepper({ value, onChange, onStep, step = 1, min = 0, max = 9999, unit, label, size = 'md', className }: StepperProps) {
  const current = value ?? 0;
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label={label}>
      <button
        type="button"
        className={cn('grid shrink-0 place-items-center rounded-pill border border-border text-text-2 transition-colors active:bg-card-hover', size === 'lg' ? 'size-13' : 'size-11')}
        onClick={() => (onStep ? onStep(-step) : set(current - step))}
        aria-label={`Restar ${step} a ${label}`}
      >
        <Minus strokeWidth={1.5} className="size-4" />
      </button>
      <output className={cn('min-w-14 flex-1 text-center font-display tracking-display tnum', size === 'lg' ? 'text-3xl' : 'text-xl')} aria-live="polite">
        {value === null ? '—' : fmt(current)}
        {unit ? <span className="ml-0.5 text-sm text-text-3">{unit}</span> : null}
      </output>
      <button
        type="button"
        className={cn('grid shrink-0 place-items-center rounded-pill border border-border text-text-2 transition-colors active:bg-card-hover', size === 'lg' ? 'size-13' : 'size-11')}
        onClick={() => (onStep ? onStep(step) : set(current + step))}
        aria-label={`Sumar ${step} a ${label}`}
      >
        <Plus strokeWidth={1.5} className="size-4" />
      </button>
    </div>
  );
}
