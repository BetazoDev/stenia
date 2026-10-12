import type { Metadata } from 'next';

import { RegisterForm } from '@/components/auth/register-form';
import { hasGoogleProvider } from '@/lib/auth';

export const metadata: Metadata = { title: 'Crear cuenta' };
export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return <RegisterForm googleEnabled={hasGoogleProvider()} />;
}
