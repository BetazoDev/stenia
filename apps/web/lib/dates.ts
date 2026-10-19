import { TIME_ZONE } from './time';

/** Fecha local (America/Mexico_City) en formato AAAA-MM-DD. */
export function localDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T12:00:00Z`);
  const b = Date.parse(`${toIso}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Semana del bloque (1 = primera), acotada a la duración del bloque. */
export function blockWeek(startedOn: string | null, blockWeeks: number, today = localDateString()): number {
  if (!startedOn) return 1;
  const week = Math.floor(Math.max(0, daysBetween(startedOn, today)) / 7) + 1;
  return Math.min(Math.max(1, week), Math.max(1, blockWeeks));
}
