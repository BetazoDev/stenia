import { GOAL_LABELS_ES, type Goal } from '@stenia/core';
import { CalendarCheck, ChevronRight, ClipboardList, Dumbbell, FileText, Ruler, Settings } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { SignOutButton } from '@/components/sign-out-button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { getProfile } from '@/lib/profile';
import { isAdmin, requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Perfil' };

const LINKS: { href: Route; label: string; hint: string; icon: typeof Settings }[] = [
  { href: '/onboarding', label: 'Cuestionario', hint: 'Seguridad, cuerpo, objetivo y logística', icon: FileText },
  { href: '/rutina', label: 'Rutina', hint: 'Días, ejercicios y versiones', icon: ClipboardList },
  { href: '/equipo', label: 'Equipamiento', hint: 'Gimnasio, casa o parque', icon: Dumbbell },
  { href: '/revision', label: 'Revisiones', hint: 'Frecuencia y ajustes aceptados', icon: CalendarCheck },
  { href: '/progreso/medidas', label: 'Medidas', hint: 'Peso, circunferencias y % de grasa', icon: Ruler },
  { href: '/configuracion', label: 'Configuración', hint: 'Notificaciones, privacidad y datos', icon: Settings },
];

export default async function ProfilePage() {
  const { user } = await requireSession();
  const profile = await getProfile(user.id);
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
            <dt className="label">Objetivo</dt>
            <dd className="mt-1">{profile?.goal ? GOAL_LABELS_ES[profile.goal as Goal] : 'Sin definir'}</dd>
          </div>
          <div>
            <dt className="label">Rol</dt>
            <dd className="mt-1">
              <Chip tone={isAdmin(user) ? 'accent' : 'neutral'}>{isAdmin(user) ? 'Admin' : 'Usuario'}</Chip>
            </dd>
          </div>
        </dl>
      </Card>

      <nav aria-label="Secciones del perfil">
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {[...LINKS, ...(isAdmin(user) ? [{ href: '/settings/developer' as Route, label: 'Desarrollador e IA', hint: 'Proveedor, modelos y presupuesto', icon: Settings }] : [])].map(
            ({ href, label, hint, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="flex min-h-14 items-center gap-4 px-4 py-3 hover:bg-card-hover">
                  <Icon strokeWidth={1.5} className="size-5 text-text-2" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span>{label}</span>
                    <span className="text-sm text-text-3">{hint}</span>
                  </span>
                  <ChevronRight strokeWidth={1.5} className="size-4 text-text-3" />
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>

      <SignOutButton />
    </div>
  );
}
