import 'server-only';

import { checkEmailAddress } from '@stenia/core';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { account, session, user, verification } from '@stenia/db';
import { and, eq } from 'drizzle-orm';

import { getDb } from './db';
import { domainReceivesMail } from './email-domain';
import { env, isAdminEmail } from './env';

export const COOKIE_PREFIX = 'stenia';

function buildAuth() {
  const e = env();
  const google =
    e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    appName: 'Stenia',
    baseURL: e.BETTER_AUTH_URL ?? e.NEXT_PUBLIC_APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    socialProviders: google,
    // Google verifica el correo: si ya existe una cuenta con contraseña con ese correo se vincula (sin esto Better Auth
    // rechaza el vínculo porque aquí no se verifican correos). Ver `account.create.after`.
    account: {
      accountLinking: { enabled: true, trustedProviders: ['google'], requireLocalEmailVerified: false },
    },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
        units: { type: 'string', required: false, defaultValue: 'metric', input: false },
        locale: { type: 'string', required: false, defaultValue: 'es-MX', input: false },
        privacyAcceptedAt: { type: 'date', required: false, input: false },
      },
      deleteUser: {
        enabled: true,
        // Las filas se borran en cascada; los archivos privados en R2 se quitan antes (sección 16).
        beforeDelete: async (user) => {
          const { deleteAllPhotos } = await import('./body');
          await deleteAllPhotos(user.id);
        },
      },
    },
    databaseHooks: {
      account: {
        create: {
          // Al vincular Google a una cuenta cuyo correo nunca se verificó, Google reemplaza la contraseña: así nadie
          // que haya registrado ese correo antes con su propia contraseña conserva acceso (decisión del 2026-10-26).
          after: async (created) => {
            if (created.providerId !== 'google') return;
            const db = getDb();
            const [owner] = await db.select({ emailVerified: user.emailVerified }).from(user).where(eq(user.id, created.userId)).limit(1);
            if (!owner || owner.emailVerified) return;
            await db.delete(account).where(and(eq(account.userId, created.userId), eq(account.providerId, 'credential')));
            await db.delete(session).where(eq(session.userId, created.userId));
            await db.update(user).set({ emailVerified: true, updatedAt: new Date() }).where(eq(user.id, created.userId));
          },
        },
      },
      user: {
        create: {
          before: async (data) => {
            // Cada cuenta necesita un correo real: Google ya lo verifica; en el registro con contraseña se revisa
            // que el dominio no tenga errores de dedo (gmail.comj) y que reciba correo.
            if (!data.emailVerified) {
              const check = checkEmailAddress(data.email);
              if (!check.ok) throw new APIError('BAD_REQUEST', { message: check.message, code: 'INVALID_EMAIL_DOMAIN' });
              if (!(await domainReceivesMail(check.email))) {
                throw new APIError('BAD_REQUEST', {
                  message: 'Ese dominio no recibe correos. Revisa que el correo esté bien escrito.',
                  code: 'INVALID_EMAIL_DOMAIN',
                });
              }
            }
            return {
              data: {
                ...data,
              role: isAdminEmail(data.email) ? 'admin' : 'user',
              units: 'metric',
              locale: 'es-MX',
              // El registro exige aceptar el aviso de privacidad antes de enviar el formulario.
              privacyAcceptedAt: new Date(),
              },
            };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: COOKIE_PREFIX,
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof buildAuth>;
export type Session = Auth['$Infer']['Session'];
export type SessionUser = Session['user'];

type Holder = { __steniaAuth?: Auth };
const holder = globalThis as unknown as Holder;

/** Instancia única y perezosa: no lee el entorno hasta la primera petición (el build no necesita secretos). */
export function getAuth(): Auth {
  if (!holder.__steniaAuth) holder.__steniaAuth = buildAuth();
  return holder.__steniaAuth;
}

export function hasGoogleProvider(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}
