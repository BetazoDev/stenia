import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';
import { hasGoogleProvider } from '@/lib/auth';

export const metadata: Metadata = { title: 'Entrar' };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/hoy';
  return <LoginForm googleEnabled={hasGoogleProvider()} next={safeNext} />;
}
