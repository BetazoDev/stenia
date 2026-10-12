import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type MetricProps = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  accent?: boolean;
  className?: string;
};

/** Métrica grande con etiqueta pequeña (motivo de la sección 15 del PRD). */
export function Metric({ label, value, unit, hint, accent = false, className }: MetricProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="label">{label}</span>
      <span className={cn('font-display text-4xl leading-none tracking-display tnum', accent && 'text-accent')}>
        {value}
        {unit ? <span className="ml-1 text-lg text-text-3">{unit}</span> : null}
      </span>
      {hint ? <span className="text-sm text-text-3">{hint}</span> : null}
    </div>
  );
}
