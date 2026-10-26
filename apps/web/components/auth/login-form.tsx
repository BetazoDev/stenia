'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { describeAuthError, signIn } from '@/lib/auth-client';

import { GoogleButton } from './google-button';

export function LoginForm({ googleEnabled, next }: { googleEnabled: boolean; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setError(null);
    startTransition(async () => {
      const { error } = await signIn.email({ email, password });
      if (error) {
        setError(describeAuthError(error));
        return;
      }
      router.push(next as Route);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl">Entra a tu entrenamiento</h1>
      {/* method="post": si se envía antes de que cargue el JS, la contraseña nunca queda en la URL. */}
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field>
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
        </Field>
        <FieldError>{error}</FieldError>
        <Button type="submit" block disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      {googleEnabled ? <GoogleButton callbackURL={next} label="Continuar con Google" /> : null}
      <p className="text-sm text-text-2">
        ¿Primera vez?{' '}
        <Link href="/registro" className="text-text underline underline-offset-4">
          Crea tu cuenta
        </Link>
      </p>
    </div>
  );
}
