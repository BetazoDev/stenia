import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SessionPage } from '@/components/session/session-page';

export const metadata: Metadata = { title: 'Sesión en vivo' };

export default function TrainPage() {
  return (
    <Suspense fallback={<p className="text-text-3">Cargando sesión…</p>}>
      <SessionPage />
    </Suspense>
  );
}
