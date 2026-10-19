import type { Macros } from '@stenia/core';

import { cn } from '@/lib/utils';

const fmt = (n: number) => Math.round(n).toLocaleString('es-MX');

function Bar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target > 0 && value > target * 1.05;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        <span className={cn('text-sm tnum', over ? 'text-down' : 'text-text-2')}>
          {fmt(value)} / {fmt(target)} {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-card-hover" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(target)}>
        <div className={cn('h-full rounded-pill', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Progreso del día contra las metas (kcal grande, macros en barras con tonos apagados). */
export function MacroBars({ totals, target }: { totals: Macros; target: Macros }) {
  const remaining = target.kcal - totals.kcal;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="label">Calorías</span>
          <span className="font-display text-5xl leading-none tracking-display tnum">
            {fmt(totals.kcal)}
            <span className="ml-1 text-lg text-text-3">/ {fmt(target.kcal)}</span>
          </span>
        </div>
        <span className={cn('text-right text-sm tnum', remaining < -target.kcal * 0.05 ? 'text-down' : 'text-text-2')}>
          {remaining >= 0 ? `Faltan ${fmt(remaining)}` : `Te pasaste ${fmt(-remaining)}`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-pill bg-card-hover">
        <div className="h-full rounded-pill bg-text" style={{ width: `${Math.min(100, target.kcal > 0 ? (totals.kcal / target.kcal) * 100 : 0)}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Bar label="Proteína" value={totals.proteinG} target={target.proteinG} unit="g" color="bg-protein" />
        <Bar label="Carbohidratos" value={totals.carbsG} target={target.carbsG} unit="g" color="bg-carbs" />
        <Bar label="Grasa" value={totals.fatG} target={target.fatG} unit="g" color="bg-fat" />
      </div>
    </div>
  );
}
