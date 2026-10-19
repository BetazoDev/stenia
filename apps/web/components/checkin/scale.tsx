'use client';

import { cn } from '@/lib/utils';

/** Escala 1–5 con botones táctiles de 44 px. */
export function Scale({ label, value, onChange, low, high }: { label: string; value: number | null; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label mb-2">{label}</legend>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cn(
              'h-11 rounded-input border font-display text-lg tracking-display tnum transition-colors',
              value === n ? 'border-text bg-text text-bg' : 'border-border bg-card text-text-2 hover:bg-card-hover',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[12px] text-text-3">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
