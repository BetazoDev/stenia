import 'server-only';

import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET debe tener al menos 16 caracteres'),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional().default(''),
  ENCRYPTION_KEY: z.string().optional(),
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  /** Token de `claude setup-token` para el proveedor «Suscripción de Claude» (alternativa al login local). */
  CLAUDE_CODE_OAUTH_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

const blank = (value: string | undefined) => (value && value.length > 0 ? value : undefined);

/** Variables de entorno del servidor validadas una sola vez. Lanza un error legible si falta algo. */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: blank(process.env.BETTER_AUTH_URL),
    GOOGLE_CLIENT_ID: blank(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: blank(process.env.GOOGLE_CLIENT_SECRET),
    ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? '',
    ENCRYPTION_KEY: blank(process.env.ENCRYPTION_KEY),
    AI_PROVIDER: blank(process.env.AI_PROVIDER),
    AI_API_KEY: blank(process.env.AI_API_KEY),
    CLAUDE_CODE_OAUTH_TOKEN: blank(process.env.CLAUDE_CODE_OAUTH_TOKEN),
    CRON_SECRET: blank(process.env.CRON_SECRET),
    NEXT_PUBLIC_APP_URL: blank(process.env.NEXT_PUBLIC_APP_URL),
    R2_PUBLIC_BASE_URL: blank(process.env.R2_PUBLIC_BASE_URL),
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración de entorno inválida: ${problems}`);
  }
  cached = parsed.data;
  return cached;
}

export function adminEmails(): string[] {
  return env()
    .ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}
