import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label data-slot="label" className={cn('label block', className)} {...props} />;
}

export function Field({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2', className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-text-3', className)} {...props} />;
}

export function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  if (!children) return null;
  return (
    <p role="alert" className={cn('text-sm text-down', className)} {...props}>
      {children}
    </p>
  );
}
