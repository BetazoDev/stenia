import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-pill border px-5 text-[13px] font-medium uppercase tracking-label transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border-accent bg-accent text-white hover:bg-accent-hover',
        secondary: 'border-border-strong bg-transparent text-text hover:bg-card-hover',
        ghost: 'border-transparent bg-transparent text-text-2 hover:text-text',
        danger: 'border-border-strong bg-transparent text-down hover:bg-card-hover',
      },
      size: {
        md: 'h-11',
        sm: 'h-9 min-h-9 px-4 text-[12px]',
        lg: 'h-13 min-h-13 px-7',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, block, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
