import { and, count, eq } from 'drizzle-orm';
import { weightUnitFrom } from '@stenia/core';
import { account, bodyPhoto } from '@stenia/db';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DeleteAccount } from '@/components/account/delete-account';
import { DeletePhotos } from '@/components/account/delete-photos';
import { PushToggle } from '@/components/account/push-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import { UnitsToggle } from '@/components/units/units-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDb } from '@/lib/db';
import { isAdmin, requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Configuración' };

export default async function SettingsPage() {
  const { user } = await requireSession();
  const [credential] = await getDb()
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
    .limit(1);
  const [photos] = await getDb()
    .select({ n: count() })
    .from(bodyPhoto)
    .where(eq(bodyPhoto.userId, user.id));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Configuración</span>
        <h1 className="text-4xl">Tu cuenta</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Sesión</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <SignOutButton />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unidades</CardTitle>
          <CardDescription>
            Peso de series, récords y medidas corporales. Se guarda todo en kg; solo cambia cómo lo
            ves y lo escribes.
          </CardDescription>
        </CardHeader>
        <UnitsToggle initial={weightUnitFrom(user.units)} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>
            Fin del descanso con la app en segundo plano y recordatorios de revisiones.
          </CardDescription>
        </CardHeader>
        <PushToggle />
      </Card>

      {isAdmin(user) ? (
        <Card>
          <CardHeader>
            <CardTitle>Desarrollador</CardTitle>
            <CardDescription>
              Proveedor de IA, modelos por tarea, presupuesto y registro de uso.
            </CardDescription>
          </CardHeader>
          <Button asChild variant="secondary">
            <Link href="/settings/developer">Abrir configuración de IA</Link>
          </Button>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Privacidad y datos</CardTitle>
          <CardDescription>
            Puedes llevarte todos tus datos cuando quieras. Lee el{' '}
            <Link href="/privacidad" className="text-text underline underline-offset-4">
              aviso de privacidad
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <a href="/api/account/export" download>
              Exportar todo (JSON)
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/api/account/export?format=csv" download>
              Exportar series (CSV)
            </a>
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fotos corporales</CardTitle>
          <CardDescription>
            Guardadas en almacenamiento privado. Borrarlas también retira tu consentimiento para
            fotos.
          </CardDescription>
        </CardHeader>
        <DeletePhotos count={photos?.n ?? 0} />
      </Card>

      <Card className="border-down/30">
        <CardHeader>
          <CardTitle>Zona de riesgo</CardTitle>
          <CardDescription>
            Borra tu cuenta y todo su contenido de forma permanente.
          </CardDescription>
        </CardHeader>
        <DeleteAccount hasPassword={Boolean(credential)} />
      </Card>
    </div>
  );
}
