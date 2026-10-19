'use client';

import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Hoja inferior en móvil y diálogo centrado en escritorio. */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-card border border-border bg-surface p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] outline-none data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(0.22,1,0.36,1)] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card md:data-[state=open]:animate-[fade-in_150ms_ease-out]',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="font-display text-2xl tracking-display">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-sm text-text-2">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close className="grid size-11 shrink-0 place-items-center rounded-pill border border-border text-text-2 hover:text-text" aria-label="Cerrar">
              <X strokeWidth={1.5} className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
