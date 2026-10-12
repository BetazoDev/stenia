import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
      <div>
        <Link href="/login" className="font-display text-3xl tracking-display">
          Stenia
        </Link>
        <p className="label mt-1">Fuerza que se construye</p>
      </div>
      {children}
      <p className="text-sm text-text-3">
        Stenia no es un dispositivo médico ni sustituye a un profesional de la salud.{' '}
        <Link href="/privacidad" className="underline underline-offset-4 hover:text-text-2">
          Aviso de privacidad
        </Link>
      </p>
    </main>
  );
}
