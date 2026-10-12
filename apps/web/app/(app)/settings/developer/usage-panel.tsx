import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Metric } from '@/components/ui/metric';
import { budgetLevel, type MonthlyUsage } from '@/lib/ai-settings';

const usd = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
const int = new Intl.NumberFormat('es-MX');

const TASK_LABELS: Record<string, string> = {
  connection_test: 'Prueba de conexión',
  routine_generation: 'Generación de rutina',
  checkin_summary: 'Resumen de revisión',
  meal_plan: 'Plan de comidas',
};

export function UsagePanel({ usage, budgetUsd }: { usage: MonthlyUsage; budgetUsd: number }) {
  const { level, ratio } = budgetLevel(usage.totalUsd, budgetUsd);
  const month = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(usage.since);

  return (
    <Card className="flex flex-col gap-6">
      <CardHeader className="mb-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Uso de {month}</CardTitle>
          {level === 'blocked' ? <Chip tone="down">Presupuesto agotado</Chip> : null}
          {level === 'warn' ? <Chip tone="down">80% del presupuesto</Chip> : null}
          {level === 'ok' ? <Chip tone="up">Dentro del presupuesto</Chip> : null}
        </div>
        <CardDescription>Tokens y costo estimado por función. Los modelos sin tarifa conocida se cuentan con costo 0.</CardDescription>
      </CardHeader>

      <div className="grid grid-cols-2 gap-4">
        <Metric label="Costo estimado" value={usd.format(usage.totalUsd)} accent={level !== 'ok'} />
        <Metric label="Llamadas" value={int.format(usage.totalCalls)} hint={usage.unpricedCalls > 0 ? `${usage.unpricedCalls} sin tarifa` : undefined} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="label">Presupuesto mensual</span>
          <span className="label tnum">
            {usd.format(usage.totalUsd)} / {usd.format(budgetUsd)}
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-pill bg-border">
          <div
            className={level === 'ok' ? 'h-full bg-text' : 'h-full bg-accent'}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
          <span className="absolute inset-y-0 left-[80%] w-px bg-text-3" aria-hidden="true" />
        </div>
      </div>

      {usage.byTask.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="label text-left">
            <tr>
              <th className="pb-2 font-medium">Función</th>
              <th className="pb-2 text-right font-medium">Llamadas</th>
              <th className="pb-2 text-right font-medium">Entrada</th>
              <th className="pb-2 text-right font-medium">Salida</th>
              <th className="pb-2 text-right font-medium">Costo</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {usage.byTask.map((row) => (
              <tr key={row.task} className="border-t border-border">
                <td className="py-2">{TASK_LABELS[row.task] ?? row.task}</td>
                <td className="py-2 text-right">{int.format(row.calls)}</td>
                <td className="py-2 text-right">{int.format(row.inputTokens)}</td>
                <td className="py-2 text-right">{int.format(row.outputTokens)}</td>
                <td className="py-2 text-right">{usd.format(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-text-3">Todavía no hay llamadas este mes.</p>
      )}
    </Card>
  );
}
