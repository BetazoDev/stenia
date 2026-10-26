'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { restartAction, type RestartKind } from '@/app/(app)/hoy/actions';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/label';
import { localDb } from '@/lib/local-db';

import { updateSession } from './session-actions';

const OPTIONS: { kind: RestartKind; label: string; help: string }[] = [
  {
    kind: 'day',
    label: 'Reiniciar el día',
    help: 'Descarta la sesión de hoy y puedes volver a empezarla.',
  },
  {
    kind: 'week',
    label: 'Reiniciar la semana',
    help: 'La rotación vuelve al primer día de la rutina.',
  },
  {
    kind: 'cycle',
    label: 'Reiniciar el ciclo',
    help: 'Vuelve a la semana 1 del bloque; los pesos parten de los actuales.',
  },
];

/** Controles de prueba para repetir el día, la semana o el ciclo. Piden confirmación con un segundo toque. */
export function RestartControls() {
  const router = useRouter();
  const [confirming, setConfirming] = useState<RestartKind | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (kind: RestartKind) =>
    start(async () => {
      setMessage(null);
      if (kind === 'day') {
        // Las sesiones locales sin terminar también se descartan, o el botón seguiría ofreciendo «Continuar».
        const active = await localDb().sessions.where('status').equals('active').toArray();
        for (const s of active)
          await updateSession(s.id, { status: 'discarded', endedAt: Date.now() });
      }
      const result = await restartAction(kind);
      setConfirming(null);
      setMessage(result.ok ? { ok: true, text: 'Listo.' } : { ok: false, text: result.message });
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0">
        <CardTitle className="flex items-center gap-2">
          <RotateCcw strokeWidth={1.5} className="size-5" /> Reiniciar (pruebas)
        </CardTitle>
        <CardDescription>Para probar la app: el historial se conserva.</CardDescription>
      </CardHeader>
      <ul className="flex flex-col gap-3">
        {OPTIONS.map((o) => (
          <li key={o.kind} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p>{o.label}</p>
              <p className="text-sm text-text-3">{o.help}</p>
            </div>
            <Button
              size="sm"
              variant={confirming === o.kind ? 'danger' : 'secondary'}
              disabled={pending}
              onClick={() => (confirming === o.kind ? run(o.kind) : setConfirming(o.kind))}
            >
              {confirming === o.kind ? '¿Seguro? Reiniciar' : 'Reiniciar'}
            </Button>
          </li>
        ))}
      </ul>
      {message ? (
        <FieldError className={message.ok ? 'text-up' : undefined}>{message.text}</FieldError>
      ) : null}
    </Card>
  );
}
