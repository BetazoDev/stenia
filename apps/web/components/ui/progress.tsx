import { cn } from '@/lib/utils';

export function ProgressBar({ value, max = 100, className, label }: { value: number; max?: number; className?: string; label?: string }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-pill bg-border', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="h-full bg-text transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
