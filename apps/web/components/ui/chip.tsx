import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

type ChipProps = ComponentProps<'span'> & { tone?: 'neutral' | 'accent' | 'up' | 'down' };

export function Chip({ className, tone = 'neutral', ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-chip border px-2.5 text-[12px] font-medium uppercase tracking-label',
        tone === 'neutral' && 'border-border text-text-2',
        tone === 'accent' && 'border-accent text-accent',
        tone === 'up' && 'border-up/40 text-up',
        tone === 'down' && 'border-down/40 text-down',
        className,
      )}
      {...props}
    />
  );
}
