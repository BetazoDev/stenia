'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';

import { activateGymProfileAction, createPresetAction, deleteGymProfileAction } from './actions';

export function GymListActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      {!active ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await activateGymProfileAction(id); router.refresh(); })}>
          Activar
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => router.push(`/equipo/${id}`)}>
        Editar
      </Button>
      {!active ? (
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (!window.confirm('¿Borrar este perfil de equipamiento?')) return;
            start(async () => {
              await deleteGymProfileAction(id);
              router.refresh();
            });
          }}
        >
          Borrar
        </Button>
      ) : null}
    </div>
  );
}

const PRESETS = [
  { value: 'gym', label: 'Gimnasio' },
  { value: 'home', label: 'Casa' },
  { value: 'park', label: 'Parque' },
] as const;

export function NewProfileButtons() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createPresetAction(p.value);
              if (result.ok && result.id) router.push(`/equipo/${result.id}`);
            })
          }
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
