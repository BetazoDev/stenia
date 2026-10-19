import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sin conexión' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <span className="label">Sin conexión</span>
      <h1 className="text-4xl">No hay red</h1>
      <p className="text-text-2">
        Tu sesión en curso sigue guardada en el teléfono. Abre <a href="/entrenar" className="underline underline-offset-4">la sesión en vivo</a> o vuelve a
        intentar cuando tengas conexión.
      </p>
    </main>
  );
}
