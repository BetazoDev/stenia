import 'server-only';

import { routine, routineDay, workoutSession } from '@stenia/db';
import { and, desc, eq, sql } from 'drizzle-orm';

import { localDateString } from './dates';
import { getDb } from './db';
import { TIME_ZONE } from './time';

/** Una sesión activa con más de 12 horas se considera abandonada (se ofrece terminarla o descartarla). */
const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

export type PendingSession = {
  id: string;
  dayName: string | null;
  startedAt: Date;
  stale: boolean;
};

export type TodayState =
  /** Hay una sesión sin terminar: no se empieza otro día hasta cerrarla. */
  | { kind: 'active'; session: PendingSession }
  /** Hoy ya se entrenó: el siguiente día queda para mañana. */
  | { kind: 'done'; dayName: string | null }
  /** Hoy no está entre los días preferidos. */
  | { kind: 'rest' }
  | { kind: 'train' };

/** Día de la semana local (0 = domingo, como `Date.getDay()` y los días preferidos del cuestionario). */
export function localWeekday(date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(
    date,
  );
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

export async function latestActiveSession(userId: string): Promise<PendingSession | null> {
  const [row] = await getDb()
    .select({
      id: workoutSession.id,
      startedAt: workoutSession.startedAt,
      dayName: routineDay.name,
    })
    .from(workoutSession)
    .leftJoin(routineDay, eq(routineDay.id, workoutSession.routineDayId))
    .where(and(eq(workoutSession.userId, userId), eq(workoutSession.status, 'active')))
    .orderBy(desc(workoutSession.startedAt))
    .limit(1);
  if (!row) return null;
  return { ...row, stale: Date.now() - row.startedAt.getTime() > STALE_SESSION_MS };
}

const startedToday = (today: string) =>
  sql`to_char(${workoutSession.startedAt} at time zone ${TIME_ZONE}, 'YYYY-MM-DD') = ${today}`;

/** Qué toca hoy: continuar una sesión, nada (ya entrenó), descanso o entrenar. */
export async function todayTrainingState(
  userId: string,
  preferredDays: number[],
): Promise<TodayState> {
  const active = await latestActiveSession(userId);
  if (active) return { kind: 'active', session: active };
  const [done] = await getDb()
    .select({ dayName: routineDay.name })
    .from(workoutSession)
    .leftJoin(routineDay, eq(routineDay.id, workoutSession.routineDayId))
    .where(
      and(
        eq(workoutSession.userId, userId),
        eq(workoutSession.status, 'completed'),
        startedToday(localDateString()),
      ),
    )
    .orderBy(desc(workoutSession.startedAt))
    .limit(1);
  if (done) return { kind: 'done', dayName: done.dayName };
  if (preferredDays.length > 0 && !preferredDays.includes(localWeekday())) return { kind: 'rest' };
  return { kind: 'train' };
}

/** Pruebas: descarta las sesiones de hoy (y cualquiera sin terminar) para repetir el día. */
export async function restartToday(userId: string): Promise<void> {
  await getDb()
    .update(workoutSession)
    // clientUpdatedAt = ahora: un dispositivo con la sesión vieja no la revive al sincronizar.
    .set({ status: 'discarded', clientUpdatedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(workoutSession.userId, userId),
        sql`(${workoutSession.status} = 'active' or ${startedToday(localDateString())})`,
      ),
    );
}

/** Pruebas: la rotación vuelve al primer día de la rutina; con `cycle`, también la semana 1 del bloque. */
export async function restartRotation(userId: string, cycle: boolean): Promise<void> {
  await getDb()
    .update(routine)
    .set({
      rotationResetAt: new Date(),
      ...(cycle ? { startedOn: localDateString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(routine.userId, userId), eq(routine.status, 'active')));
}

/** Cierra una sesión pendiente desde el servidor (p. ej. empezada en otro dispositivo). */
export async function closePendingSession(
  userId: string,
  id: string,
  status: 'completed' | 'discarded',
): Promise<void> {
  await getDb()
    .update(workoutSession)
    .set({ status, endedAt: new Date(), clientUpdatedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(workoutSession.userId, userId),
        eq(workoutSession.id, id),
        eq(workoutSession.status, 'active'),
      ),
    );
}

const REST_MESSAGES = [
  'Hoy toca descansar: el músculo crece mientras te recuperas.',
  'Día de descanso. Duerme bien, come tu proteína y sal a caminar un rato.',
  'Descansar también es entrenar: mañana vas a rendir más.',
  'Tu cuerpo se adapta en el descanso. Disfrútalo sin culpa.',
  'Recupera hoy, rompe marcas mañana.',
  'Estira, hidrátate y prepara la mochila: el próximo entrenamiento te espera.',
  'La constancia gana. Un buen descanso es parte del plan.',
];

/** Mensaje del día de descanso (el mismo durante todo el día). */
export function restMessage(today = localDateString()): string {
  const n = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
  return REST_MESSAGES[n % REST_MESSAGES.length]!;
}
