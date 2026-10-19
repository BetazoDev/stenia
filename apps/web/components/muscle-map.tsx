import { MUSCLE_LABELS_ES, type MuscleGroup } from '@stenia/core';

import { cn } from '@/lib/utils';

type Region = { muscle: MuscleGroup; d: string };

/** Silueta esquemática (frente y espalda) con regiones por grupo muscular. */
const FRONT: Region[] = [
  { muscle: 'neck', d: 'M92 44h16v14H92z' },
  { muscle: 'traps', d: 'M78 58l22-6 22 6-6 8H84z' },
  { muscle: 'front_delts', d: 'M64 64c6-6 14-8 20-6l-2 22c-8 0-14-4-18-16z' },
  { muscle: 'front_delts', d: 'M136 64c-6-6-14-8-20-6l2 22c8 0 14-4 18-16z' },
  { muscle: 'side_delts', d: 'M58 70c2-6 4-8 6-8 2 10 6 16 12 18l-4 6c-8-2-14-8-14-16z' },
  { muscle: 'side_delts', d: 'M142 70c-2-6-4-8-6-8-2 10-6 16-12 18l4 6c8-2 14-8 14-16z' },
  { muscle: 'chest', d: 'M84 66h15v26c-8 2-16 0-20-6z' },
  { muscle: 'chest', d: 'M116 66h-15v26c8 2 16 0 20-6z' },
  { muscle: 'biceps', d: 'M60 90l12 2-2 26-12-2z' },
  { muscle: 'biceps', d: 'M140 90l-12 2 2 26 12-2z' },
  { muscle: 'forearms', d: 'M56 120l12 2-4 34-11-2z' },
  { muscle: 'forearms', d: 'M144 120l-12 2 4 34 11-2z' },
  { muscle: 'abs', d: 'M88 96h24v52H88z' },
  { muscle: 'obliques', d: 'M78 96l9 2v44l-8-6z' },
  { muscle: 'obliques', d: 'M122 96l-9 2v44l8-6z' },
  { muscle: 'hip_flexors', d: 'M82 148h14l-4 12H84z' },
  { muscle: 'hip_flexors', d: 'M118 148h-14l4 12h8z' },
  { muscle: 'quads', d: 'M80 162h18l-2 58H82z' },
  { muscle: 'quads', d: 'M120 162h-18l2 58h14z' },
  { muscle: 'adductors', d: 'M97 162h6l-2 40h-2z' },
  { muscle: 'calves', d: 'M82 230h13l-2 44h-9z' },
  { muscle: 'calves', d: 'M118 230h-13l2 44h9z' },
];

const BACK: Region[] = [
  { muscle: 'neck', d: 'M92 44h16v12H92z' },
  { muscle: 'traps', d: 'M76 58l24-8 24 8-8 22-16-6-16 6z' },
  { muscle: 'rear_delts', d: 'M60 66c4-6 10-8 16-8l2 18c-8 2-14-2-18-10z' },
  { muscle: 'rear_delts', d: 'M140 66c-4-6-10-8-16-8l-2 18c8 2 14-2 18-10z' },
  { muscle: 'upper_back', d: 'M84 80l16 6 16-6v14H84z' },
  { muscle: 'lats', d: 'M76 84l8 2v28l-8 12z' },
  { muscle: 'lats', d: 'M124 84l-8 2v28l8 12z' },
  { muscle: 'triceps', d: 'M60 88l12 2-2 28-12-2z' },
  { muscle: 'triceps', d: 'M140 88l-12 2 2 28 12-2z' },
  { muscle: 'forearms', d: 'M56 120l12 2-4 34-11-2z' },
  { muscle: 'forearms', d: 'M144 120l-12 2 4 34 11-2z' },
  { muscle: 'lower_back', d: 'M86 116h28v30H86z' },
  { muscle: 'glutes', d: 'M80 148h19v24H82z' },
  { muscle: 'glutes', d: 'M120 148h-19v24h17z' },
  { muscle: 'abductors', d: 'M76 150l4-2v20l-4-4z' },
  { muscle: 'abductors', d: 'M124 150l-4-2v20l4-4z' },
  { muscle: 'hamstrings', d: 'M81 176h17l-2 48H83z' },
  { muscle: 'hamstrings', d: 'M119 176h-17l2 48h13z' },
  { muscle: 'calves', d: 'M82 230h13l-1 46h-10z' },
  { muscle: 'calves', d: 'M118 230h-13l1 46h10z' },
];

const OUTLINE =
  'M100 8c10 0 16 8 16 18s-6 18-16 18-16-8-16-18 6-18 16-18zm-24 50c-8 2-16 6-20 14-4 10-4 22-6 36-2 18-6 34-8 48l12 2c4-14 8-30 10-46l2 22c-2 24-4 46-4 70 0 22 2 46 4 72h12l4-70h4l-2 70h12l4-72c0-24-2-46-4-70l2-22c2 16 6 32 10 46l12-2c-2-14-6-30-8-48-2-14-2-26-6-36-4-8-12-12-20-14';

type MuscleMapProps = {
  /** Intensidad 0–1 por grupo. */
  intensity: Partial<Record<MuscleGroup, number>>;
  /** Grupos secundarios (se muestran tenues). */
  secondary?: MuscleGroup[];
  className?: string;
  showLegend?: boolean;
};

function fillFor(value: number | undefined, secondary: boolean): string {
  if (value && value > 0) return `rgba(206, 0, 55, ${0.25 + Math.min(1, value) * 0.75})`;
  if (secondary) return 'rgba(255, 255, 255, 0.28)';
  return 'rgba(255, 255, 255, 0.06)';
}

function Figure({ regions, label, intensity, secondary }: { regions: Region[]; label: string; intensity: MuscleMapProps['intensity']; secondary: Set<MuscleGroup> }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="40 0 120 290" className="h-56 w-auto md:h-64" role="img" aria-label={label}>
        <path d={OUTLINE} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" strokeLinejoin="round" />
        {regions.map((r, i) => (
          <path key={`${r.muscle}-${i}`} d={r.d} fill={fillFor(intensity[r.muscle], secondary.has(r.muscle))} stroke="rgba(255,255,255,0.1)" strokeWidth="0.75">
            <title>{MUSCLE_LABELS_ES[r.muscle]}</title>
          </path>
        ))}
      </svg>
      <figcaption className="label">{label}</figcaption>
    </figure>
  );
}

/** Mapa muscular en SVG (ficha de ejercicio y mapa semanal de la sección 9.1). */
export function MuscleMap({ intensity, secondary = [], className, showLegend = false }: MuscleMapProps) {
  const sec = new Set(secondary);
  const active = (Object.entries(intensity) as [MuscleGroup, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex justify-center gap-6">
        <Figure regions={FRONT} label="Frente" intensity={intensity} secondary={sec} />
        <Figure regions={BACK} label="Espalda" intensity={intensity} secondary={sec} />
      </div>
      {showLegend && active.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {active.map(([m]) => (
            <li key={m} className="rounded-chip border border-border px-2.5 py-1 text-sm text-text-2">
              {MUSCLE_LABELS_ES[m]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
