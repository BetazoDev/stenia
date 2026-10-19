'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setPhotosConsentAction } from '@/app/(app)/progreso/actions';
import { Button } from '@/components/ui/button';

/** Consentimiento expreso y separado para fotos corporales (sección 16). */
export function PhotoConsentCard() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-text-2">
        <li>Las fotos se guardan en almacenamiento privado y solo tú puedes verlas, con enlaces de corta duración.</li>
        <li>La detección de pose corre en tu dispositivo; la imagen no se manda a ningún servicio para validarla.</li>
        <li>Nunca se envían al modelo de IA sin que lo pidas explícitamente.</li>
        <li>Puedes borrar una o todas desde aquí o desde Configuración.</li>
      </ul>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 size-5 accent-[--color-accent]" />
        <span>Acepto guardar fotos corporales con estas condiciones.</span>
      </label>
      <Button
        className="self-start"
        disabled={!checked || pending}
        onClick={() =>
          start(async () => {
            await setPhotosConsentAction(true);
            router.refresh();
          })
        }
      >
        Activar fotos
      </Button>
    </div>
  );
}
