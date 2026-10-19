import { Dumbbell } from 'lucide-react';

import { cn } from '@/lib/utils';

type ExerciseMediaProps = {
  start: string | null;
  end: string | null;
  main?: string | null;
  alt: string;
  className?: string;
  size?: 'thumb' | 'large';
};

/**
 * Animación de dos fases (inicio → fin en bucle) sin GIF pesado. Con `prefers-reduced-motion` queda la imagen
 * de inicio fija. Las imágenes vienen de catálogos abiertos; se muestran sin pasar por el optimizador.
 */
export function ExerciseMedia({ start, end, main, alt, className, size = 'thumb' }: ExerciseMediaProps) {
  const first = start ?? main ?? end;
  const second = start && end ? end : null;
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-light-bg',
        size === 'thumb' ? 'size-16 shrink-0 rounded-chip' : 'aspect-square w-full rounded-card',
        className,
      )}
    >
      {first ? (
        <>
          <img src={first} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-contain" />
          {second ? (
            <img
              src={second}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="motion-safe:animate-[two-phase_2.4s_ease-in-out_infinite] absolute inset-0 size-full object-contain opacity-0"
            />
          ) : null}
        </>
      ) : (
        <div className="grid size-full place-items-center text-light-text/40">
          <Dumbbell strokeWidth={1.5} className={size === 'thumb' ? 'size-6' : 'size-12'} />
        </div>
      )}
    </div>
  );
}
