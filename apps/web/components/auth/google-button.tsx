'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { describeAuthError, signIn } from '@/lib/auth-client';

export function GoogleButton({ callbackURL, label }: { callbackURL: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        block
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const { error } = await signIn.social({ provider: 'google', callbackURL });
            if (error) setError(describeAuthError(error));
          })
        }
      >
        {pending ? 'Conectando…' : label}
      </Button>
      {error ? <p role="alert" className="text-sm text-down">{error}</p> : null}
    </div>
  );
}
