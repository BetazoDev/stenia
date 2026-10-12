'use client';

import { Flame, Settings, TrendingUp, User, Utensils } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const TABS = [
  { href: '/hoy', label: 'Hoy', icon: Flame },
  { href: '/progreso', label: 'Progreso', icon: TrendingUp },
  { href: '/nutricion', label: 'Nutrición', icon: Utensils },
  { href: '/perfil', label: 'Perfil', icon: User },
] as const;

/** Navegación inferior de 4 pestañas en móvil y barra lateral en escritorio. */
export function AppNav({ userName }: { userName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-bg px-5 py-8 md:flex">
        <Link href="/hoy" className="font-display text-2xl tracking-display">
          Stenia
        </Link>
        <p className="label mt-1">Fuerza que se construye</p>
        <nav className="mt-10 flex flex-col gap-1" aria-label="Principal">
          {TABS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-input px-3 text-base text-text-2 transition-colors hover:bg-card-hover hover:text-text',
                isActive(href) && 'bg-card text-text',
              )}
            >
              <Icon strokeWidth={1.5} className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link
            href="/configuracion"
            aria-current={isActive('/configuracion') ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center gap-3 rounded-input px-3 text-base text-text-2 transition-colors hover:bg-card-hover hover:text-text',
              isActive('/configuracion') && 'bg-card text-text',
            )}
          >
            <Settings strokeWidth={1.5} className="size-5" />
            Configuración
          </Link>
          <p className="truncate px-3 pt-2 text-sm text-text-3">{userName}</p>
        </div>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur safe-bottom md:hidden"
        aria-label="Principal"
      >
        <ul className="grid grid-cols-4">
          {TABS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-label text-text-3',
                  isActive(href) && 'text-text',
                )}
              >
                <Icon strokeWidth={1.5} className={cn('size-5', isActive(href) && 'text-accent')} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
