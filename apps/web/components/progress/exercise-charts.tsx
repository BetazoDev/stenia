'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { kgToUnit, type WeightUnit } from '@stenia/core';

import type { ExerciseSeriesPoint } from '@/lib/progress';

const AXIS = { stroke: 'rgba(255,255,255,0.5)', fontSize: 12 } as const;
const GRID = 'rgba(255,255,255,0.08)';
const short = (iso: string) =>
  new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${iso}T12:00:00Z`))
    .replace('.', '');

const tooltipStyle = {
  contentStyle: {
    background: '#161616',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 10,
    color: '#fff',
  },
  labelStyle: { color: 'rgba(255,255,255,0.72)' },
  cursor: { stroke: 'rgba(255,255,255,0.16)', fill: 'rgba(255,255,255,0.04)' },
} as const;

type Mode = 'load' | 'reps' | 'seconds';

/** Línea de mejor serie y 1RM estimado + barras de volumen (sección 9.1). */
export function ExerciseCharts({
  points,
  mode,
  unit = 'kg',
}: {
  points: ExerciseSeriesPoint[];
  mode: Mode;
  unit?: WeightUnit;
}) {
  const w = (kg: number | null) => (kg === null ? null : kgToUnit(kg, unit));
  const data = points.map((p) => ({
    ...p,
    bestWeight: w(p.bestWeight),
    e1rm: w(p.e1rm),
    volume: Math.round(kgToUnit(p.volume, unit)),
    label: short(p.date),
  }));
  const primaryKey = mode === 'load' ? 'bestWeight' : mode === 'reps' ? 'bestReps' : 'bestSeconds';
  const primaryLabel =
    mode === 'load'
      ? `Mejor serie (${unit})`
      : mode === 'reps'
        ? 'Mejores reps'
        : 'Mejor tiempo (s)';
  return (
    <div className="flex flex-col gap-8">
      <figure className="flex flex-col gap-3">
        <figcaption className="flex flex-wrap items-center gap-4 text-sm text-text-2">
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-text" /> {primaryLabel}
          </span>
          {mode === 'load' ? (
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-accent" /> 1RM estimado
            </span>
          ) : null}
        </figcaption>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tick={AXIS}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                width={48}
              />
              <Tooltip {...tooltipStyle} />
              <Line
                type="monotone"
                dataKey={primaryKey}
                name={primaryLabel}
                stroke="#ffffff"
                strokeWidth={1.75}
                dot={{ r: 2.5 }}
                connectNulls
                isAnimationActive={false}
              />
              {mode === 'load' ? (
                <Line
                  type="monotone"
                  dataKey="e1rm"
                  name="1RM estimado"
                  stroke="#ce0037"
                  strokeWidth={1.75}
                  dot={{ r: 2.5 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
      {mode === 'load' ? (
        <figure className="flex flex-col gap-3">
          <figcaption className="text-sm text-text-2">
            Volumen por sesión ({unit} × reps)
          </figcaption>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={AXIS}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} />
                <Tooltip {...tooltipStyle} />
                <Bar
                  dataKey="volume"
                  name={`Volumen (${unit})`}
                  fill="rgba(255,255,255,0.5)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      ) : null}
    </div>
  );
}
