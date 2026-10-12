export const TIME_ZONE = 'America/Mexico_City';

/** Hora local (0–23) en la zona horaria del usuario. */
export function localHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE }).format(date);
  return Number(hour) % 24;
}

export function greetingFor(date = new Date()): string {
  const hour = localHour(date);
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "lunes, 12 de octubre" con solo la inicial en mayúscula. */
export function formatLongDate(date = new Date()): string {
  const text = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIME_ZONE,
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE }).format(date);
}

/** Índice del día en la semana local, 0 = lunes … 6 = domingo. */
export function weekdayIndex(date: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TIME_ZONE }).format(date);
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return Math.max(0, order.indexOf(weekday));
}

/** Inicio (lunes 00:00 local) y fin (lunes siguiente) de la semana actual, en instantes UTC. */
export function currentWeekBounds(now = new Date()): { start: Date; end: Date; todayIndex: number } {
  const todayIndex = weekdayIndex(now);
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TIME_ZONE,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Medianoche local aproximada a partir de la fecha local; el desfase de zona se corrige con el offset actual.
  const localMidnightUtc = Date.UTC(get('year'), get('month') - 1, get('day'));
  const offsetMs = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: TIME_ZONE })).getTime();
  const todayStart = new Date(localMidnightUtc + offsetMs);
  const start = new Date(todayStart.getTime() - todayIndex * 86_400_000);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { start, end, todayIndex };
}
