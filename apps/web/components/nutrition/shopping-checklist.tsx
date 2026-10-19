'use client';

import { Check } from 'lucide-react';
import { useMemo, useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';

type Item = { foodId: string; name: string; display: string };

/** Lista de compras con casillas recordadas en este dispositivo (por versión del plan). */
const memory = new Map<string, string>();
const EVENT = 'stenia:compras';

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? '[]';
  } catch {
    return memory.get(key) ?? '[]';
  }
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento local: se recuerda solo mientras la página siga abierta.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT, callback);
  };
}

export function ShoppingChecklist({ planId, groups }: { planId: string; groups: { label: string; items: Item[] }[] }) {
  const key = `stenia:compras:${planId}`;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => '[]');
  const checked = useMemo(() => {
    try {
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(key, JSON.stringify([...next]));
  };

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.label} className="flex flex-col gap-2" aria-label={g.label}>
          <h2 className="label">{g.label}</h2>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {g.items.map((i) => {
              const on = checked.has(i.foodId);
              return (
                <li key={i.foodId}>
                  <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(i.foodId)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-card-hover">
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-[5px] border', on ? 'border-text bg-text text-bg' : 'border-border-strong')}>
                      {on ? <Check strokeWidth={2.5} className="size-3.5" /> : null}
                    </span>
                    <span className={cn('min-w-0 flex-1', on && 'text-text-3 line-through')}>{i.name}</span>
                    <span className="text-sm text-text-2 tnum">{i.display}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
