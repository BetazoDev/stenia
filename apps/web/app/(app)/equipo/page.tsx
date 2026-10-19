import type { Metadata } from 'next';
import Link from 'next/link';

import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { listGymProfiles, PRESET_LABELS } from '@/lib/gym';
import { requireSession } from '@/lib/session';

import { GymListActions, NewProfileButtons } from './client';

export const metadata: Metadata = { title: 'Equipamiento' };

export default async function EquipmentPage() {
  const { user } = await requireSession();
  const profiles = await listGymProfiles(user.id);
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Equipamiento</span>
        <h1 className="text-4xl">Dónde entrenas</h1>
        <p className="max-w-prose text-text-2">
          El generador solo propone ejercicios cuyo equipo está en el perfil activo. Si cambias de lugar, activa otro perfil y regenera la rutina.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {profiles.map((p) => (
          <li key={p.id}>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Link href={`/equipo/${p.id}`} className="text-xl underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                  {p.active ? <Chip tone="accent">Activo</Chip> : null}
                </div>
                <GymListActions id={p.id} active={p.active} />
              </div>
              <p className="text-sm text-text-3">
                {PRESET_LABELS[p.kind as keyof typeof PRESET_LABELS]?.label ?? p.kind} · {p.equipment.length} elementos
              </p>
            </Card>
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Nuevo perfil</h2>
        <NewProfileButtons />
      </section>
    </div>
  );
}
