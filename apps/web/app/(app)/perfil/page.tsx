import type { Metadata } from 'next';
import Link from 'next/link';

import { SignOutButton } from '@/components/sign-out-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { isAdmin, requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfilePage() {
  const { user } = await requireSession();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Perfil</span>
        <h1 className="text-4xl">{user.name}</h1>
      </header>

      <Card className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="label">Correo</dt>
            <dd className="mt-1 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="label">Miembro desde</dt>
            <dd className="mt-1">{formatShortDate(new Date(user.createdAt))}</dd>
          </div>
          <div>
            <dt className="label">Unidades</dt>
            <dd className="mt-1">Métrico (kg, cm)</dd>
          </div>
          <div>
            <dt className="label">Rol</dt>
            <dd className="mt-1">
              <Chip tone={isAdmin(user) ? 'accent' : 'neutral'}>{isAdmin(user) ? 'Admin' : 'Usuario'}</Chip>
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-xl">Cuestionario inicial</h2>
        <p className="text-text-2">
          Seguridad (PAR-Q+), datos corporales, objetivo y logística: llega en la Fase 1 y será el punto de partida
          de tu rutina.
        </p>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/configuracion">Configuración</Link>
        </Button>
        <SignOutButton />
      </div>
    </div>
  );
}
