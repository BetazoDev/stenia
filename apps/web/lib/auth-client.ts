'use client';

import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import type { Auth } from './auth';

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

const ERROR_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: 'Ya existe una cuenta con ese correo.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ya existe una cuenta con ese correo.',
  INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
  INVALID_EMAIL: 'El correo no es válido.',
  INVALID_PASSWORD: 'La contraseña no es válida.',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres.',
  PASSWORD_TOO_LONG: 'La contraseña es demasiado larga.',
  USER_NOT_FOUND: 'No encontramos una cuenta con ese correo.',
  EMAIL_NOT_VERIFIED: 'Confirma tu correo antes de entrar.',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'Esta cuenta entra con Google; usa ese botón.',
  TOO_MANY_REQUESTS: 'Demasiados intentos; espera un minuto e inténtalo de nuevo.',
};

export function describeAuthError(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!error) return 'Algo salió mal. Inténtalo de nuevo.';
  if (error.status === 429) return ERROR_MESSAGES.TOO_MANY_REQUESTS ?? 'Demasiados intentos.';
  if (error.code && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code] as string;
  return error.message ?? 'Algo salió mal. Inténtalo de nuevo.';
}

const OAUTH_ERRORS: Record<string, string> = {
  account_not_linked: 'Ese correo ya tiene una cuenta en Stenia y no se pudo vincular con Google. Inténtalo de nuevo.',
  access_denied: 'Cancelaste el inicio con Google.',
  state_mismatch: 'Se interrumpió el inicio con Google. Vuelve a intentarlo desde esta pantalla.',
  please_restart_the_process: 'Se interrumpió el inicio con Google. Vuelve a intentarlo desde esta pantalla.',
};

/** Mensaje para el `?error=` con el que Better Auth regresa cuando falla el inicio con Google. */
export function describeOAuthError(code: string | null | undefined): string | null {
  if (!code) return null;
  return OAUTH_ERRORS[code] ?? 'No se pudo entrar con Google. Inténtalo de nuevo.';
}
