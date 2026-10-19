'use client';

import { RefreshCw } from 'lucide-react';
import { useTransition } from 'react';

import { refreshTargetsAction } from '@/app/(app)/nutricion/actions';
import { Button } from '@/components/ui/button';

export function RefreshTargetsButton() {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" className="self-start" disabled={pending} onClick={() => start(async () => void (await refreshTargetsAction()))}>
      <RefreshCw strokeWidth={1.5} className={pending ? 'animate-spin' : ''} /> Recalcular metas
    </Button>
  );
}
