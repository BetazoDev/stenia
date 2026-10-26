'use client';

import { Check, Dumbbell } from 'lucide-react';
import type { ReactNode } from 'react';

import type { EquipmentItem } from '@/lib/gym-presets';
import { cn } from '@/lib/utils';

export const CATEGORY_LABELS: Record<string, string> = {
  machine: 'Máquinas',
  free_weight: 'Peso libre',
  structure: 'Estructuras',
  space: 'Espacio',
  weighted: 'Lastre',
  other: 'Otros',
};

const ORDER = ['machine', 'free_weight', 'structure', 'space', 'weighted', 'other'];

type Props = {
  catalog: EquipmentItem[];
  selected: ReadonlySet<string>;
  onToggle: (slug: string) => void;
  /** Contenido extra al final de una categoría (p. ej. rango de mancuernas). */
  renderAfter?: (category: string) => ReactNode;
};

/** Lista de equipamiento con foto de referencia de cada máquina para reconocerla en el gimnasio. */
export function EquipmentChecklist({ catalog, selected, onToggle, renderAfter }: Props) {
  const groups = ORDER.map((c) => ({
    category: c,
    items: catalog.filter((e) => e.category === c),
  })).filter((g) => g.items.length);
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g.category} className="flex flex-col gap-3">
          <h2 className="text-xl">{CATEGORY_LABELS[g.category] ?? g.category}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {g.items.map((e) => {
              const on = selected.has(e.slug);
              return (
                <button
                  key={e.slug}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onToggle(e.slug)}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-input border text-left transition-colors',
                    on ? 'border-text bg-card-hover' : 'border-border bg-card hover:bg-card-hover',
                  )}
                >
                  <span className="relative block aspect-[4/3] w-full bg-light-bg">
                    {e.photoUrl ? (
                      <img
                        src={e.photoUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 size-full object-contain"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-light-text/40">
                        <Dumbbell strokeWidth={1.5} className="size-8" />
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute top-2 right-2 grid size-6 place-items-center rounded-[6px] border',
                        on ? 'border-text bg-text text-bg' : 'border-border-strong bg-bg/70',
                      )}
                    >
                      {on ? <Check strokeWidth={2.5} className="size-4" /> : null}
                    </span>
                  </span>
                  <span className="px-3 py-2.5 text-sm leading-snug">{e.nameEs}</span>
                </button>
              );
            })}
          </div>
          {renderAfter?.(g.category)}
        </section>
      ))}
    </div>
  );
}
