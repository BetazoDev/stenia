import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set(['/login', '/registro', '/privacidad', '/creditos', '/sin-conexion']);

/**
 * Comprobación optimista por cookie: redirige a /login sin sesión y a /hoy si ya hay sesión en las
 * páginas de acceso. Cada página del servidor vuelve a verificar la sesión con Better Auth.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request, { cookiePrefix: 'stenia' });
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!sessionCookie && !isPublic) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (sessionCookie && (pathname === '/login' || pathname === '/registro')) {
    return NextResponse.redirect(new URL('/hoy', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|serwist|icons|manifest\\.webmanifest|favicon\\.ico|robots\\.txt|.*\\.[\\w]+$).*)'],
};
