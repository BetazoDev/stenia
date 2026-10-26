'use client';

import { checkEmailAddress } from '@stenia/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { describeAuthError, signUp } from '@/lib/auth-client';

import { GoogleButton } from './google-button';

export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const privacy = form.get('privacy') === 'on';
    setError(null);
    setSuggestion(null);
    if (name.length < 2) return setError('Escribe tu nombre.');
    const emailCheck = checkEmailAddress(email);
    if (!emailCheck.ok) {
      setSuggestion(emailCheck.suggestion);
      return setError(emailCheck.message);
    }
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    if (!privacy) return setError('Para crear la cuenta debes aceptar el aviso de privacidad.');
    startTransition(async () => {
      const { error } = await signUp.email({ name, email: emailCheck.email, password });
      if (error) {
        setError(describeAuthError(error));
        return;
      }
      router.push('/hoy');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl">Crea tu cuenta</h1>
      {/* method="post": si se envía antes de que cargue el JS, la contraseña nunca queda en la URL. */}
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field>
          <Label htmlFor="email">Correo</Label>
          <Input ref={emailRef} id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field>
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <FieldHint>Mínimo 8 caracteres.</FieldHint>
        </Field>
        <Field>
          <Label htmlFor="confirm">Confirma la contraseña</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <label htmlFor="privacy" className="flex items-start gap-3 text-sm text-text-2">
          <input id="privacy" type="checkbox" name="privacy" className="mt-1 size-4 accent-accent" required />
          <span>
            Acepto el{' '}
            <Link href="/privacidad" className="text-text underline underline-offset-4" target="_blank">
              aviso de privacidad
            </Link>{' '}
            y el tratamiento de mis datos de salud para generar mi rutina y seguimiento.
          </span>
        </label>
        <FieldError>{error}</FieldError>
        {suggestion ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              if (emailRef.current) emailRef.current.value = suggestion;
              setSuggestion(null);
              setError(null);
            }}
          >
            Usar {suggestion}
          </Button>
        ) : null}
        <Button type="submit" block disabled={pending}>
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
      {googleEnabled ? <GoogleButton callbackURL="/hoy" label="Registrarme con Google" /> : null}
      <p className="text-sm text-text-2">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-text underline underline-offset-4">
          Entra
        </Link>
      </p>
    </div>
  );
}
