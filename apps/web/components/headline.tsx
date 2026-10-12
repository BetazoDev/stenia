'use client';

import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

type HeadlineProps = { text: string; as?: 'h1' | 'h2'; className?: string };

/** Titular que aparece palabra por palabra; con `prefers-reduced-motion` se muestra de inmediato. */
export function Headline({ text, as = 'h1', className }: HeadlineProps) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  const Tag = as;
  return (
    <Tag className={cn('text-4xl leading-[1.05] md:text-5xl', className)} aria-label={text}>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className="inline-block"
          aria-hidden="true"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}
