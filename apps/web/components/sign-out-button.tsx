'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { signOut } from '@/lib/auth-client';

import { Button } from './ui/button';

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          router.push('/login');
          router.refresh();
        })
      }
    >
      {pending ? 'Cerrando…' : 'Cerrar sesión'}
    </Button>
  );
}
