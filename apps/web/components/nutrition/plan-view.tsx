'use client';

import { equivalentsFor, macrosFor, type FoodGroup, type Macros } from '@stenia/core';
import { Repeat } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { setViewAction, substituteAction, substitutesAction } from '@/app/(app)/nutricion/actions';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type PlanFood = { name: string; group: FoodGroup | null; per100: Macros; unit: { label: string; grams: number } | null };
export type PlanData = { days: { meals: { name: string; items: { foodId: string; grams: number }[] }[] }[]; dayTotals: Macros[] };

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const r = (n: number) => Math.round(n).toLocaleString('es-MX');
const GROUP_SHORT: Partial<Record<FoodGroup, string>> = {
  cereal: 'cereal',
  legume: 'leguminosa',
  protein: 'origen animal',
  dairy: 'leche',
  vegetable: 'verdura',
  fruit: 'fruta',
  fat: 'grasa',
  sugar: 'azúcar',
};

function amount(food: PlanFood | undefined, grams: number, view: 'grams' | 'equivalents'): string {
  if (!food) return `${r(grams)} g`;
  if (view === 'equivalents') {
    const eq = equivalentsFor(food.group, macrosFor(food.per100, grams));
    if (eq !== null && food.group) return `${eq.toLocaleString('es-MX')} eq. ${GROUP_SHORT[food.group] ?? ''}`.trim();
  }
  if (food.unit && food.unit.grams > 0) {
    const units = grams / food.unit.grams;
    if (units >= 0.5 && units <= 12 && Math.abs(units * 2 - Math.round(units * 2)) < 0.15) return `${(Math.round(units * 2) / 2).toLocaleString('es-MX')} × ${food.unit.label} · ${r(grams)} g`;
  }
  return `${r(grams)} g`;
}

/** Plan semanal por día con vista en gramos o equivalentes y sustituciones. */
export function PlanView({ plan, foods, view, todayIndex, targets }: { plan: PlanData; foods: Record<string, PlanFood>; view: 'grams' | 'equivalents'; todayIndex: number; targets: Macros }) {
  const router = useRouter();
  const [day, setDay] = useState(todayIndex);
  const [mode, setMode] = useState(view);
  const [sub, setSub] = useState<{ meal: number; item: number } | null>(null);
  const [options, setOptions] = useState<{ id: string; name: string; grams: number; kcal: number; proteinG: number }[] | null>(null);
  const [pending, start] = useTransition();
  const current = plan.days[day];
  const totals = plan.dayTotals[day];

  function openSub(meal: number, item: number) {
    setSub({ meal, item });
    setOptions(null);
    void substitutesAction({ day, meal, item }).then(setOptions);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-7 gap-1" role="tablist" aria-label="Día del plan">
          {DAY_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={day === i}
              onClick={() => setDay(i)}
              className={cn('h-10 rounded-input border text-sm', day === i ? 'border-text bg-text text-bg' : 'border-border text-text-2', i === todayIndex && day !== i && 'border-text-3')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        {totals ? (
          <p className="text-sm text-text-2 tnum">
            {r(totals.kcal)} / {r(targets.kcal)} kcal · P {r(totals.proteinG)} · C {r(totals.carbsG)} · G {r(totals.fatG)}
          </p>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 rounded-pill border border-border p-0.5" role="radiogroup" aria-label="Unidades">
          {(['grams', 'equivalents'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={mode === v}
              onClick={() => {
                setMode(v);
                void setViewAction(v);
              }}
              className={cn('h-8 rounded-pill px-3 text-[12px] uppercase tracking-label', mode === v ? 'bg-text text-bg' : 'text-text-2')}
            >
              {v === 'grams' ? 'Gramos' : 'Equiv.'}
            </button>
          ))}
        </div>
      </div>
      {current?.meals.map((meal, mi) => {
        const kcal = meal.items.reduce((a, it) => a + (foods[it.foodId] ? macrosFor(foods[it.foodId]!.per100, it.grams).kcal : 0), 0);
        return (
          <section key={`${meal.name}-${mi}`} className="rounded-card border border-border bg-card">
            <header className="flex items-baseline justify-between px-4 pb-2 pt-4">
              <h2 className="text-xl">{meal.name}</h2>
              <span className="text-sm text-text-2 tnum">{r(kcal)} kcal</span>
            </header>
            <ul className="flex flex-col divide-y divide-border border-t border-border">
              {meal.items.map((it, ii) => {
                const f = foods[it.foodId];
                return (
                  <li key={`${it.foodId}-${ii}`} className="flex min-h-12 items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1">{f?.name ?? 'Alimento'}</span>
                      <span className="text-[12px] text-text-3 tnum">{amount(f, it.grams, mode)}</span>
                    </span>
                    <button type="button" onClick={() => openSub(mi, ii)} className="grid size-11 place-items-center rounded-pill text-text-3 hover:bg-card-hover hover:text-text" aria-label={`Sustituir ${f?.name ?? ''}`}>
                      <Repeat strokeWidth={1.5} className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <Sheet open={sub !== null} onOpenChange={(o) => !o && setSub(null)} title="Sustituir" description="Opciones del mismo grupo con aporte parecido.">
        {options === null ? (
          <p className="text-sm text-text-3">Buscando opciones…</p>
        ) : options.length === 0 ? (
          <p className="text-sm text-text-3">No hay sustitutos parecidos en tus alimentos básicos y favoritos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    sub &&
                    start(async () => {
                      await substituteAction({ day, meal: sub.meal, item: sub.item, foodId: o.id, grams: o.grams });
                      setSub(null);
                      router.refresh();
                    })
                  }
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-card-hover disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1">{o.name}</span>
                    <span className="text-[12px] text-text-3 tnum">
                      {r(o.grams)} g · {r(o.kcal)} kcal · {r(o.proteinG)} g proteína
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
