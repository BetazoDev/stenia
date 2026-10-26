import type { Metadata } from 'next';

import { RegisterForm } from '@/components/auth/register-form';
import { hasGoogleProvider } from '@/lib/auth';

export const metadata: Metadata = { title: 'Crear cuenta' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ error?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return <RegisterForm googleEnabled={hasGoogleProvider()} oauthError={error ?? null} />;
}
