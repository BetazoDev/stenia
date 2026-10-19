'use client';

import { BookmarkPlus, ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteLogAction, logPlanMealAction, saveMealAction, updateLogAction } from '@/app/(app)/nutricion/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';

import { FoodPicker } from './food-picker';

export type DayEntry = { id: string; meal: string; grams: number; name: string; kcal: number; proteinG: number; per100Kcal: number };
export type PlanMealSummary = { index: number; name: string; items: string[]; kcal: number } | null;

const r = (n: number) => Math.round(n).toLocaleString('es-MX');

/** Registro del día agrupado por comida, con agregar, registrar del plan, editar y guardar comidas. */
export function DayLog({ date, meals, entries, planMeals }: { date: string; meals: string[]; entries: DayEntry[]; planMeals: PlanMealSummary[] }) {
  const router = useRouter();
  const [pickerMeal, setPickerMeal] = useState<string | null>(null);
  const [editing, setEditing] = useState<DayEntry | null>(null);
  const [editGrams, setEditGrams] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const extra = [...new Set(entries.map((e) => e.meal))].filter((m) => !meals.includes(m));
  const allMeals = [...meals, ...extra];

  return (
    <div className="flex flex-col gap-4">
      {allMeals.map((meal, i) => {
        const list = entries.filter((e) => e.meal === meal);
        const kcal = list.reduce((a, e) => a + e.kcal, 0);
        const plan = planMeals[i] ?? null;
        return (
          <section key={meal} className="rounded-card border border-border bg-card" aria-label={meal}>
            <header className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
              <h2 className="text-xl">{meal}</h2>
              <span className="text-sm text-text-2 tnum">{r(kcal)} kcal</span>
            </header>
            {list.length > 0 ? (
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {list.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(e);
                        setEditGrams(e.grams);
                      }}
                      className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-card-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1">{e.name}</span>
                        <span className="text-[12px] text-text-3 tnum">
                          {r(e.grams)} g · {r(e.proteinG)} g proteína
                        </span>
                      </span>
                      <span className="text-sm tnum">{r(e.kcal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : plan ? (
              <p className="px-4 pb-1 text-sm text-text-3">
                Plan: {plan.items.join(', ')} · {r(plan.kcal)} kcal
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 p-3">
              <Button size="sm" variant="secondary" onClick={() => setPickerMeal(meal)}>
                <Plus strokeWidth={1.5} /> Agregar
              </Button>
              {plan && list.length === 0 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await logPlanMealAction(date, plan.index);
                      setMessage(result.ok ? null : result.message);
                      router.refresh();
                    })
                  }
                >
                  <ClipboardCheck strokeWidth={1.5} /> Comí lo del plan
                </Button>
              ) : null}
              {list.length > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSaving(meal);
                    setSaveName(meal);
                  }}
                >
                  <BookmarkPlus strokeWidth={1.5} /> Guardar comida
                </Button>
              ) : null}
            </div>
          </section>
        );
      })}
      {message ? (
        <p role="status" className="text-sm text-text-2">
          {message}
        </p>
      ) : null}

      <FoodPicker open={pickerMeal !== null} onOpenChange={(o) => !o && setPickerMeal(null)} date={date} meal={pickerMeal ?? meals[0] ?? 'Comida'} />

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing?.name ?? ''} description="Ajusta la cantidad o quítalo del registro.">
        {editing ? (
          <div className="flex flex-col gap-5">
            <Stepper value={editGrams} onChange={setEditGrams} step={5} min={1} max={3000} unit=" g" label="Gramos" size="lg" />
            <p className="text-center text-sm text-text-2 tnum">{r((editing.per100Kcal * editGrams) / 100)} kcal</p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deleteLogAction(editing.id);
                    setEditing(null);
                    router.refresh();
                  })
                }
              >
                <Trash2 strokeWidth={1.5} /> Quitar
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await updateLogAction(editing.id, editGrams);
                    setEditing(null);
                    router.refresh();
                  })
                }
              >
                Guardar
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={saving !== null} onOpenChange={(o) => !o && setSaving(null)} title="Guardar comida" description="Para repetirla después con un toque.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) return;
            start(async () => {
              const result = await saveMealAction(date, saving, saveName);
              setMessage(result.ok ? (result.message ?? null) : result.message);
              setSaving(null);
            });
          }}
        >
          <Field>
            <Label htmlFor="save-name">Nombre</Label>
            <Input id="save-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={60} required />
          </Field>
          <Button type="submit" disabled={pending}>
            Guardar
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
