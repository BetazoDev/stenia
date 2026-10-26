import { MUSCLE_LABELS_ES, type MuscleGroup } from '@stenia/core';

import { cn } from '@/lib/utils';

/**
 * Silueta esquemática (frente y espalda). Cada región se dibuja del lado izquierdo de la imagen y se refleja al
 * derecho (`mirror`), así ambos lados coinciden siempre y cada músculo queda sobre su parte del cuerpo.
 */
type Region = { muscle: MuscleGroup | null; d: string; mirror?: boolean };

const HEAD = 'M100 8c8 0 13 7 13 16s-5 17-13 17-13-8-13-17 5-16 13-16z';
const HAND = 'M60 144c3-1 8-1 10 0l1 11c-2 3-9 3-12 0z';
const KNEE = 'M84 197h12l-1 9H85z';
const FOOT = 'M85 254h10l2 9H82z';

const FRONT: Region[] = [
  { muscle: null, d: HEAD },
  { muscle: 'neck', d: 'M93 39h14l1 8H92z' },
  { muscle: 'traps', d: 'M92 47l-12 7h14z', mirror: true },
  { muscle: 'side_delts', d: 'M78 54c-9 0-15 5-17 13l-1 10 5-4c1-7 5-12 13-15z', mirror: true },
  { muscle: 'front_delts', d: 'M79 55c-8 3-12 8-13 15l-1 6c4-3 8-4 12-3l3-10z', mirror: true },
  { muscle: 'chest', d: 'M81 55h18v27c-7 4-14 3-20-2l-2-8z', mirror: true },
  { muscle: 'biceps', d: 'M64 79c4-3 9-4 13-3l-1 14-2 15h-10c-2-8-2-17 0-26z', mirror: true },
  { muscle: 'forearms', d: 'M63 108h11c0 12-2 24-4 35h-9c-1-12-1-24 2-35z', mirror: true },
  { muscle: null, d: HAND, mirror: true },
  { muscle: 'abs', d: 'M90 86h20v40c-6 5-14 5-20 0z' },
  { muscle: 'obliques', d: 'M78 82c4 3 8 5 11 5v40l-7-5c-2-13-3-27-4-40z', mirror: true },
  { muscle: 'hip_flexors', d: 'M82 124l7 5 6 10H83z', mirror: true },
  { muscle: 'quads', d: 'M81 141h14c1 18 1 37-1 55H84c-3-18-4-37-3-55z', mirror: true },
  { muscle: 'adductors', d: 'M96 141h3.5v32l-3 4z', mirror: true },
  { muscle: null, d: KNEE, mirror: true },
  { muscle: 'calves', d: 'M84 208h12c1 15 0 30-3 44h-7c-3-14-3-29-2-44z', mirror: true },
  { muscle: null, d: FOOT, mirror: true },
];

const BACK: Region[] = [
  { muscle: null, d: HEAD },
  { muscle: 'neck', d: 'M93 39h14l1 6H92z' },
  { muscle: 'traps', d: 'M100 44l22 11-12 6-10 25-10-25-12-6z' },
  { muscle: 'rear_delts', d: 'M78 54c-9 0-15 5-17 13l-1 10c5-4 11-6 17-5l3-11z', mirror: true },
  { muscle: 'upper_back', d: 'M80 57l10 5 7 22-13-3-5-11z', mirror: true },
  { muscle: 'lats', d: 'M78 73c2 5 4 8 6 9l14 4v10l-8 9-8 15c-2-15-4-31-4-47z', mirror: true },
  { muscle: 'lower_back', d: 'M90 106l9-9h2l9 9 1 22c-7 4-15 4-22 0z' },
  { muscle: 'triceps', d: 'M64 79c4-3 9-4 13-3l-1 14-2 15h-10c-2-8-2-17 0-26z', mirror: true },
  { muscle: 'forearms', d: 'M63 108h11c0 12-2 24-4 35h-9c-1-12-1-24 2-35z', mirror: true },
  { muscle: null, d: HAND, mirror: true },
  { muscle: 'abductors', d: 'M78 124l3 5-1 20-3-5z', mirror: true },
  { muscle: 'glutes', d: 'M81 132c5-5 13-5 18-1v22c-5 5-13 5-18 0z', mirror: true },
  {
    muscle: 'hamstrings',
    d: 'M81 157c5 2 12 2 18 0 0 13-1 26-4 39H85c-3-13-4-26-4-39z',
    mirror: true,
  },
  { muscle: null, d: KNEE, mirror: true },
  { muscle: 'calves', d: 'M84 208h12c2 12 1 25-2 36l-1 8h-7l-1-8c-3-11-3-24-1-36z', mirror: true },
  { muscle: null, d: FOOT, mirror: true },
];

/** Divisiones del abdomen: solo dibujo, no son regiones. */
const ABS_LINES = 'M100 87v39M90 99h20M90 111h20';

type MuscleMapProps = {
  /** Intensidad 0–1 por grupo. */
  intensity: Partial<Record<MuscleGroup, number>>;
  /** Grupos secundarios (se muestran tenues). */
  secondary?: MuscleGroup[];
  className?: string;
  showLegend?: boolean;
};

function fillFor(
  muscle: MuscleGroup | null,
  intensity: MuscleMapProps['intensity'],
  secondary: Set<MuscleGroup>,
): string {
  if (!muscle) return 'rgba(255, 255, 255, 0.05)';
  const value = intensity[muscle] ?? intensity.full_body;
  if (value && value > 0) return `rgba(206, 0, 55, ${0.25 + Math.min(1, value) * 0.75})`;
  if (secondary.has(muscle) || secondary.has('full_body')) return 'rgba(255, 255, 255, 0.3)';
  return 'rgba(255, 255, 255, 0.08)';
}

const MIRROR = 'matrix(-1 0 0 1 200 0)';

function Figure({
  regions,
  label,
  intensity,
  secondary,
  absLines,
}: {
  regions: Region[];
  label: string;
  intensity: MuscleMapProps['intensity'];
  secondary: Set<MuscleGroup>;
  absLines?: boolean;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="52 4 96 262" className="h-56 w-auto md:h-64" role="img" aria-label={label}>
        {regions.map((r, i) =>
          (r.mirror ? [undefined, MIRROR] : [undefined]).map((transform) => (
            <path
              key={`${i}-${transform ?? 'l'}`}
              d={r.d}
              transform={transform}
              fill={fillFor(r.muscle, intensity, secondary)}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="0.6"
              strokeLinejoin="round"
            >
              {r.muscle ? <title>{MUSCLE_LABELS_ES[r.muscle]}</title> : null}
            </path>
          )),
        )}
        {absLines ? (
          <path
            d={ABS_LINES}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.8"
            fill="none"
            pointerEvents="none"
          />
        ) : null}
      </svg>
      <figcaption className="label">{label}</figcaption>
    </figure>
  );
}

/** Mapa muscular en SVG (ficha de ejercicio y mapa semanal de la sección 9.1). */
export function MuscleMap({
  intensity,
  secondary = [],
  className,
  showLegend = false,
}: MuscleMapProps) {
  const sec = new Set(secondary);
  const active = (Object.entries(intensity) as [MuscleGroup, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex justify-center gap-6">
        <Figure regions={FRONT} label="Frente" intensity={intensity} secondary={sec} absLines />
        <Figure regions={BACK} label="Espalda" intensity={intensity} secondary={sec} />
      </div>
      {showLegend && active.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {active.map(([m]) => (
            <li
              key={m}
              className="rounded-chip border border-border px-2.5 py-1 text-sm text-text-2"
            >
              {MUSCLE_LABELS_ES[m]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
