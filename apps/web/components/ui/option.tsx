'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type OptionProps = {
  selected: boolean;
  onSelect: () => void;
  label: ReactNode;
  description?: ReactNode;
  multi?: boolean;
  className?: string;
};

/** Opción grande y táctil para cuestionarios y listas de selección. */
export function Option({ selected, onSelect, label, description, multi = false, className }: OptionProps) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-input border px-4 py-3 text-left transition-colors',
        selected ? 'border-text bg-card-hover' : 'border-border bg-card hover:bg-card-hover',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 shrink-0 place-items-center border',
          multi ? 'rounded-[5px]' : 'rounded-pill',
          selected ? 'border-text bg-text text-bg' : 'border-border-strong',
        )}
      >
        {selected ? <Check strokeWidth={2.5} className="size-3.5" /> : null}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-base">{label}</span>
        {description ? <span className="text-sm text-text-3">{description}</span> : null}
      </span>
    </button>
  );
}
