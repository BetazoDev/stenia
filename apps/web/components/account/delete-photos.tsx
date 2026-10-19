'use client';

import { useState, useTransition } from 'react';

import { deleteAllPhotosAction } from '@/app/(app)/progreso/actions';
import { Button } from '@/components/ui/button';

/** Borrado de todas las fotos corporales desde Configuración (sección 9.2). */
export function DeletePhotos({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <p className="text-sm text-text-2">Fotos borradas y consentimiento retirado.</p>;
  return (
    <Button
      variant="danger"
      disabled={pending || count === 0}
      onClick={() => {
        if (!window.confirm(`¿Borrar tus ${count} foto(s) corporales? No se puede deshacer.`)) return;
        start(async () => {
          await deleteAllPhotosAction();
          setDone(true);
        });
      }}
    >
      {count === 0 ? 'Sin fotos guardadas' : `Borrar ${count} foto(s)`}
    </Button>
  );
}
