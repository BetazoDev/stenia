import { cn } from '@/lib/utils';

/** Diferencia contra el periodo anterior: verde si sube, ámbar si baja. */
export function Delta({ value, unit = '', className, invert = false }: { value: number | null; unit?: string; className?: string; invert?: boolean }) {
  if (value === null || !Number.isFinite(value)) return null;
  if (value === 0) return <span className={cn('text-sm text-text-3 tnum', className)}>= igual</span>;
  const good = invert ? value < 0 : value > 0;
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className={cn('text-sm tnum', good ? 'text-up' : 'text-down', className)}>
      {value > 0 ? '+' : '−'}
      {Math.abs(rounded).toLocaleString('es-MX')}
      {unit}
    </span>
  );
}
