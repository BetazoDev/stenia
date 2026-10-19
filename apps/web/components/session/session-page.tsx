'use client';

import { useSearchParams } from 'next/navigation';

import { LiveSession } from './live-session';

/** Una sola URL (/entrenar) para cualquier sesión: así el service worker la sirve sin conexión. */
export function SessionPage() {
  const params = useSearchParams();
  const id = params.get('s');
  if (!id) return <p className="text-text-3">Falta el identificador de la sesión.</p>;
  return <LiveSession sessionId={id} />;
}
