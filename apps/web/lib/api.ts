import 'server-only';

import { NextResponse } from 'next/server';

import { getSession } from './session';

/** Sesión obligatoria en Route Handlers: devuelve el usuario o una respuesta 401. */
export async function requireApiUser() {
  const session = await getSession();
  if (!session) return { user: null, response: NextResponse.json({ ok: false, message: 'No autorizado' }, { status: 401 }) } as const;
  return { user: session.user, response: null } as const;
}
