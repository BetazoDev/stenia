/**
 * Cronómetros calculados siempre desde marcas de tiempo (sección 7 del PRD), nunca sumando ticks: así siguen
 * correctos aunque el navegador duerma la pestaña o se bloquee la pantalla.
 */

export type SessionClock = {
  startedAt: number;
  /** Pausa acumulada ya cerrada (ms). */
  pausedMs: number;
  /** Inicio de la pausa en curso, si la hay. */
  pausedAt: number | null;
  endedAt: number | null;
};

export function sessionElapsedMs(clock: SessionClock, now: number): number {
  const end = clock.endedAt ?? now;
  const openPause = clock.pausedAt !== null ? Math.max(0, end - clock.pausedAt) : 0;
  return Math.max(0, end - clock.startedAt - clock.pausedMs - openPause);
}

export function pauseClock(clock: SessionClock, now: number): SessionClock {
  if (clock.pausedAt !== null || clock.endedAt !== null) return clock;
  return { ...clock, pausedAt: now };
}

export function resumeClock(clock: SessionClock, now: number): SessionClock {
  if (clock.pausedAt === null) return clock;
  return { ...clock, pausedMs: clock.pausedMs + Math.max(0, now - clock.pausedAt), pausedAt: null };
}

export function endClock(clock: SessionClock, now: number): SessionClock {
  const resumed = resumeClock(clock, now);
  return { ...resumed, endedAt: now };
}

export type RestTimer = {
  startedAt: number;
  targetSeconds: number;
  /** Ajustes con ±15 s. */
  adjustSeconds: number;
};

export function restDurationMs(rest: RestTimer): number {
  return Math.max(0, (rest.targetSeconds + rest.adjustSeconds) * 1000);
}

export function restRemainingMs(rest: RestTimer, now: number): number {
  return Math.max(0, rest.startedAt + restDurationMs(rest) - now);
}

export function restEndsAt(rest: RestTimer): number {
  return rest.startedAt + restDurationMs(rest);
}

export function adjustRest(rest: RestTimer, deltaSeconds: number, now: number): RestTimer {
  const elapsedSeconds = Math.max(0, (now - rest.startedAt) / 1000);
  // Nunca deja el objetivo por debajo de lo ya transcurrido.
  const adjust = Math.max(-rest.targetSeconds + Math.ceil(elapsedSeconds), rest.adjustSeconds + deltaSeconds);
  return { ...rest, adjustSeconds: adjust };
}

/** Descanso real entre dos marcas (segundos enteros). */
export function actualRestSeconds(restStartedAt: number, nextSetStartedAt: number): number {
  return Math.max(0, Math.round((nextSetStartedAt - restStartedAt) / 1000));
}

/** Duración de un ejercicio: de la primera serie iniciada a la última marcada. */
export function exerciseDurationMs(startedAt: number | null, endedAt: number | null, now: number): number {
  if (startedAt === null) return 0;
  return Math.max(0, (endedAt ?? now) - startedAt);
}
