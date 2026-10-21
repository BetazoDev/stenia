'use client';

import { Laptop } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';

import { approveBridgeAction, unpairBridgeAction } from './actions';

type State = { paired: boolean; online: boolean; lastSeenAt: string | null; worker: string | null; pending: number; pairingPending: { worker: string; expiresAt: number } | null };

const fmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Mexico_City' });

/** Puente de IA: estado de la Mac que resuelve las llamadas con la suscripción de Claude y vinculación por código. */
export function BridgePanel({ state, serverMode }: { state: State; serverMode: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!serverMode) return;
    const t = window.setInterval(() => router.refresh(), state.pairingPending ? 3000 : 15000);
    return () => window.clearInterval(t);
  }, [router, serverMode, state.pairingPending]);

  if (!serverMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Suscripción de Claude</CardTitle>
          <CardDescription>
            Esta instancia corre en tu Mac: las llamadas van directo a tu cuenta de Claude (pnpm claude auth status para comprobar el login).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Laptop strokeWidth={1.5} className="size-5" /> Puente con tu Mac
          </CardTitle>
          <Chip tone={state.online ? 'up' : 'down'}>{state.online ? 'Conectada' : state.paired ? 'Desconectada' : 'Sin vincular'}</Chip>
        </div>
        <CardDescription>
          El servidor no usa tu suscripción: encola cada petición y tu Mac la resuelve con tu cuenta de Claude. Si la Mac está apagada, la app usa
          las versiones sin IA.
        </CardDescription>
      </CardHeader>

      {state.paired ? (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="label">Equipo</dt>
            <dd className="mt-1">{state.worker ?? '—'}</dd>
          </div>
          <div>
            <dt className="label">Último contacto</dt>
            <dd className="mt-1 tnum">{state.lastSeenAt ? fmt.format(new Date(state.lastSeenAt)) : 'Nunca'}</dd>
          </div>
          <div>
            <dt className="label">En cola</dt>
            <dd className="mt-1 tnum">{state.pending}</dd>
          </div>
        </dl>
      ) : (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-text-2">
          <li>
            En tu Mac, dentro de la carpeta de Stenia: <code className="text-text">pnpm ai:bridge setup</code>
          </li>
          <li>Escribe aquí el código que aparece.</li>
          <li>
            Deja corriendo <code className="text-text">pnpm ai:bridge</code> (o instálalo como servicio con <code className="text-text">pnpm ai:bridge install</code>).
          </li>
        </ol>
      )}

      {state.pairingPending || !state.paired ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await approveBridgeAction(code);
              setMessage({ ok: r.ok, text: r.ok ? (r.message ?? 'Vinculada.') : r.message });
              if (r.ok) setCode('');
              router.refresh();
            });
          }}
        >
          <Field>
            <Label htmlFor="bridge-code">Código de vinculación</Label>
            <Input id="bridge-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD-EF23" autoComplete="off" spellCheck={false} maxLength={9} />
            {state.pairingPending ? <FieldHint>Solicitud de «{state.pairingPending.worker}» esperando confirmación.</FieldHint> : null}
          </Field>
          <Button type="submit" variant="secondary" className="self-start" disabled={pending || code.length < 9}>
            Vincular
          </Button>
        </form>
      ) : null}

      {message ? message.ok ? <p className="text-sm text-up">{message.text}</p> : <FieldError>{message.text}</FieldError> : null}

      {state.paired ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('¿Desvincular la Mac? Tendrás que volver a correr pnpm ai:bridge setup.')) return;
            start(async () => {
              await unpairBridgeAction();
              router.refresh();
            });
          }}
        >
          Desvincular
        </Button>
      ) : null}
    </Card>
  );
}
