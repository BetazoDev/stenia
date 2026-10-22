'use client';

import { USERS_AI_MODE_LABELS, UsersAiMode } from '@stenia/ai/settings';
import { Users } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Option } from '@/components/ui/option';

import { setUsersModeAction } from './actions';

/** Qué IA reciben las cuentas que no son la tuya: la misma, un proveedor propio (Workers AI, OpenRouter…) o ninguna. */
export function UsersAiPanel({
  mode,
  ownerOnlyProvider,
}: {
  mode: UsersAiMode;
  ownerOnlyProvider: boolean;
}) {
  const [current, setCurrent] = useState(mode);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const choose = (next: UsersAiMode) => {
    if (next === current || pending) return;
    const previous = current;
    setCurrent(next);
    setError(null);
    start(async () => {
      const result = await setUsersModeAction(next);
      if (!result.ok) {
        setCurrent(previous);
        setError(result.message);
      }
    });
  };

  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0">
        <CardTitle className="flex items-center gap-2">
          <Users strokeWidth={1.5} className="size-5" /> IA para las demás cuentas
        </CardTitle>
        <CardDescription>
          Quienes prueban la app no configuran nada: usan lo que elijas aquí. Presupuesto, envío de
          fotos y registro de prompts son los de tu perfil.
        </CardDescription>
      </CardHeader>
      <div role="radiogroup" aria-label="IA para las demás cuentas" className="flex flex-col gap-2">
        {UsersAiMode.options.map((m) => (
          <Option
            key={m}
            selected={current === m}
            onSelect={() => choose(m)}
            label={USERS_AI_MODE_LABELS[m].label}
            description={USERS_AI_MODE_LABELS[m].help}
          />
        ))}
      </div>
      {current === 'same' && ownerOnlyProvider ? (
        <p className="rounded-input border border-border bg-surface px-3.5 py-3 text-sm text-text-2">
          Tu proveedor es la suscripción de Claude, que solo puede usar tu cuenta: con esta opción
          las demás cuentas se quedan sin IA. Elige «Proveedor propio» para darles Workers AI u
          OpenRouter.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
