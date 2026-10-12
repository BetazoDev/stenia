import 'server-only';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { getAuth, type SessionUser } from './auth';
import { isAdminEmail } from './env';

/** Lee las cabeceras antes de construir Better Auth para que la ruta sea dinámica y el build no requiera secretos. */
export const getSession = cache(async () => {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/** El rol guardado manda; ADMIN_EMAILS también otorga acceso para que un cambio de entorno aplique de inmediato. */
export function isAdmin(user: Pick<SessionUser, 'email'> & { role?: string | null }): boolean {
  return user.role === 'admin' || isAdminEmail(user.email);
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!isAdmin(session.user)) notFound();
  return session;
}
