'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { authClient, describeAuthError } from '@/lib/auth-client';

export function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Borrar cuenta
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (confirm !== 'BORRAR') return setError('Escribe BORRAR para confirmar.');
        startTransition(async () => {
          const { error } = await authClient.deleteUser(hasPassword ? { password } : {});
          if (error) {
            setError(describeAuthError(error));
            return;
          }
          router.push('/login');
          router.refresh();
        });
      }}
    >
      <p className="text-text-2">
        Se borrarán tu cuenta, tu rutina, tus sesiones, medidas, fotos y registros. Esta acción no se puede deshacer.
      </p>
      <Field>
        <Label htmlFor="confirm-delete">Escribe BORRAR</Label>
        <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </Field>
      {hasPassword ? (
        <Field>
          <Label htmlFor="delete-password">Tu contraseña</Label>
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldHint>La pedimos para confirmar que eres tú.</FieldHint>
        </Field>
      ) : null}
      <FieldError>{error}</FieldError>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? 'Borrando…' : 'Borrar definitivamente'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
