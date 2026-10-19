import { cn } from '@/lib/utils';

const fmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Adherencia semanal: una barra por semana (sesiones hechas / planeadas). */
export function AdherenceBars({ weeks }: { weeks: { weekStart: string; done: number; pct: number }[] }) {
  return (
    <ol className="grid h-32 grid-flow-col items-end gap-2" aria-label="Adherencia por semana">
      {weeks.map((w, i) => (
        <li key={w.weekStart} className="flex h-full flex-col items-center justify-end gap-1.5">
          <span className="text-[12px] text-text-3 tnum">{w.done}</span>
          <div className="flex w-full flex-1 items-end rounded-chip bg-card">
            <div
              className={cn('w-full rounded-chip', i === weeks.length - 1 ? 'bg-text' : 'bg-text-3')}
              style={{ height: `${Math.max(4, Math.round(w.pct * 100))}%` }}
              aria-label={`Semana del ${fmt.format(new Date(`${w.weekStart}T12:00:00Z`))}: ${Math.round(w.pct * 100)}%`}
            />
          </div>
          <span className="text-[11px] text-text-3">{fmt.format(new Date(`${w.weekStart}T12:00:00Z`)).replace('.', '')}</span>
        </li>
      ))}
    </ol>
  );
}
