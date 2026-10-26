'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { closePendingSessionAction } from '@/app/(app)/hoy/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/label';
import { localDb } from '@/lib/local-db';

import { updateSession } from './session-actions';

const fmt = new Intl.DateTimeFormat('es-MX', {
  weekday: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Mexico_City',
});

/**
 * Hay una sesión sin terminar: no se puede empezar otro día. Si está en este dispositivo se continúa; si se
 * empezó en otro (o en el navegador y no en la app instalada), se puede terminar o descartar desde aquí.
 */
export function PendingSession({
  id,
  dayName,
  startedAt,
  stale,
}: {
  id: string;
  dayName: string | null;
  startedAt: string;
  stale: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const local = useLiveQuery(() => localDb().sessions.get(id), [id]);
  const here = local?.status === 'active';

  const close = (status: 'completed' | 'discarded') =>
    start(async () => {
      setError(null);
      if (local) await updateSession(id, { status, endedAt: Date.now() });
      const result = await closePendingSessionAction(id, status);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="label">Sesión sin terminar</span>
        <p className="text-lg">{dayName ?? 'Entrenamiento'}</p>
        <p className="text-sm text-text-3">
          {stale
            ? `La empezaste el ${fmt.format(new Date(startedAt))} y quedó abierta. Termínala o descártala para seguir con tu rutina.`
            : 'Termina esta sesión antes de empezar otro día.'}
        </p>
      </div>
      {here && !stale ? (
        <Button size="lg" block onClick={() => router.push(`/entrenar?s=${id}`)}>
          <Play strokeWidth={1.5} /> Continuar sesión
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={here && !stale ? 'secondary' : 'primary'}
          disabled={pending}
          onClick={() => close('completed')}
        >
          Darla por terminada
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => close('discarded')}>
          Descartarla
        </Button>
      </div>
      <FieldError>{error}</FieldError>
    </Card>
  );
}
