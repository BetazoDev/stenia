import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { account, session, user, verification } from '@stenia/db';

import { getDb } from './db';
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
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
        units: { type: 'string', required: false, defaultValue: 'metric', input: false },
        locale: { type: 'string', required: false, defaultValue: 'es-MX', input: false },
        privacyAcceptedAt: { type: 'date', required: false, input: false },
      },
      deleteUser: { enabled: true },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (data) => ({
            data: {
              ...data,
              role: isAdminEmail(data.email) ? 'admin' : 'user',
              units: 'metric',
              locale: 'es-MX',
              // El registro exige aceptar el aviso de privacidad antes de enviar el formulario.
              privacyAcceptedAt: new Date(),
            },
          }),
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
