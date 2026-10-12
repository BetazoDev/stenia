import { cn } from '@/lib/utils';

type BlockProgressProps = {
  week: number;
  totalWeeks: number;
  /** 7 valores, lunes a domingo: true si hubo sesión. */
  trainedDays: boolean[];
  todayIndex: number;
};

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Barra del bloque: "Semana 6 de 12" con cada día entrenado marcado (sección 15 del PRD). */
export function BlockProgress({ week, totalWeeks, trainedDays, todayIndex }: BlockProgressProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="label">
          Semana {week} de {totalWeeks}
        </span>
        <span className="label tnum">{Math.round((week / totalWeeks) * 100)}%</span>
      </div>
      <div className="h-px w-full bg-border">
        <div className="h-px bg-text" style={{ width: `${Math.min(100, (week / totalWeeks) * 100)}%` }} />
      </div>
      <ol className="grid grid-cols-7 gap-2" aria-label="Días de la semana">
        {DAY_LABELS.map((label, index) => {
          const trained = trainedDays[index] ?? false;
          const isToday = index === todayIndex;
          return (
            <li key={label} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'size-2.5 rounded-pill border',
                  trained ? 'border-accent bg-accent' : 'border-border-strong bg-transparent',
                  isToday && !trained && 'border-text',
                )}
                aria-label={trained ? `${label}: entrenado` : label}
              />
              <span className={cn('text-[12px] text-text-3', isToday && 'text-text')}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
