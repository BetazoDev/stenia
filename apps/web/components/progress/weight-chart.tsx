'use client';

import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';

const AXIS = { stroke: 'rgba(255,255,255,0.5)', fontSize: 12 } as const;
const short = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)).replace('.', '');

/** Pesajes (puntos) y tendencia suavizada con media móvil exponencial (línea). */
export function WeightChart({ raw, trend }: { raw: { date: string; value: number }[]; trend: { date: string; value: number }[] }) {
  const data = raw.map((r, i) => ({ label: short(r.date), weight: r.value, trend: trend[i]?.value ?? null }));
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center gap-4 text-sm text-text-2">
        <span className="flex items-center gap-2">
          <span className="size-2 rounded-pill bg-text-3" /> Pesaje
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-text" /> Tendencia
        </span>
      </figcaption>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={16} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} width={48} />
            <Tooltip
              contentStyle={{ background: '#161616', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 10, color: '#fff' }}
              labelStyle={{ color: 'rgba(255,255,255,0.72)' }}
            />
            <Scatter dataKey="weight" name="Pesaje (kg)" fill="rgba(255,255,255,0.5)" isAnimationActive={false} />
            <Line type="monotone" dataKey="trend" name="Tendencia (kg)" stroke="#ffffff" strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
