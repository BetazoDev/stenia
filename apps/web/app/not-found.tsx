import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-4">
      <span className="label">404</span>
      <h1 className="text-4xl">Esta página no existe</h1>
      <p className="text-text-2">Puede que el enlace esté roto o que no tengas acceso.</p>
      <Button asChild variant="secondary">
        <Link href="/hoy">Volver a Hoy</Link>
      </Button>
    </main>
  );
}
