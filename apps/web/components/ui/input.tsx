import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-input border border-border bg-surface px-3.5 text-base text-text placeholder:text-text-3 focus-visible:border-border-strong disabled:opacity-50',
        type === 'number' && 'tnum',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full rounded-input border border-border bg-surface px-3.5 py-2.5 text-base text-text placeholder:text-text-3 focus-visible:border-border-strong disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'h-11 w-full appearance-none rounded-input border border-border bg-surface px-3.5 pr-9 text-base text-text focus-visible:border-border-strong disabled:opacity-50',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='1.5'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[position:right_0.75rem_center] bg-no-repeat",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
