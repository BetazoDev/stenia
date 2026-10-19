'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { cn } from '@/lib/utils';

/** Botón de borrado con confirmación nativa. */
export function DeleteButton({ action, label, confirm, className }: { action: () => Promise<unknown>; label: string; confirm: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirm)) return;
        start(async () => {
          await action();
          router.refresh();
        });
      }}
      className={cn('grid size-11 shrink-0 place-items-center rounded-pill text-text-3 transition-colors hover:bg-card-hover hover:text-down disabled:opacity-50', className)}
    >
      <Trash2 strokeWidth={1.5} className="size-4" />
    </button>
  );
}
