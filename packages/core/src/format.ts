const LOCALE = 'es-MX';

const kgFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const intFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** Formatea kilogramos con la coma/punto de es-MX y sin ceros sobrantes: 62.5 → "62.5 kg". */
export function formatKg(kg: number): string {
  return `${kgFormatter.format(kg)} kg`;
}

export function formatCm(cm: number): string {
  return `${kgFormatter.format(cm)} cm`;
}

export function formatInt(value: number): string {
  return intFormatter.format(value);
}

/** Segundos → "m:ss" o "h:mm:ss"; nunca negativo. Pensado para cronómetros con cifras tabulares. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duración legible para resúmenes: 95 min → "1 h 35 min". */
export function formatDurationMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(m / 60);
  const minutes = m % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
