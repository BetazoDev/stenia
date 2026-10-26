'use client';

import type { WeightUnit } from '@stenia/core';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setWeightUnitAction } from '@/app/(app)/configuracion/actions';
import { storeWeightUnit } from '@/components/units/weight-unit';
import { cn } from '@/lib/utils';

const OPTIONS: { unit: WeightUnit; label: string }[] = [
  { unit: 'kg', label: 'Kilogramos (kg)' },
  { unit: 'lb', label: 'Libras (lb)' },
];

/** Selector kg / lb: todo se guarda en kg y se muestra en la unidad elegida. */
export function UnitsToggle({ initial }: { initial: WeightUnit }) {
  const router = useRouter();
  const [unit, setUnit] = useState(initial);
  const [pending, start] = useTransition();
  const choose = (next: WeightUnit) => {
    if (next === unit || pending) return;
    setUnit(next);
    start(async () => {
      await setWeightUnitAction(next);
      storeWeightUnit(next);
      router.refresh();
    });
  };
  return (
    <div role="radiogroup" aria-label="Unidad de peso" className="grid grid-cols-2 gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.unit}
          type="button"
          role="radio"
          aria-checked={unit === o.unit}
          onClick={() => choose(o.unit)}
          className={cn(
            'h-11 rounded-input border px-3 text-sm transition-colors',
            unit === o.unit ? 'border-text bg-card-hover text-text' : 'border-border bg-card text-text-2 hover:bg-card-hover',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
