'use client';

import { HEALTH_FLAG_LABELS_ES, type HealthFlags } from '@stenia/core';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveSetupAction } from '@/app/(app)/nutricion/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Option } from '@/components/ui/option';
import { cn } from '@/lib/utils';

type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type SetupInitial = {
  healthFlags: HealthFlags;
  activity: Activity;
  mealsPerDay: number;
  budget: 'low' | 'medium' | 'high';
  cooks: boolean;
  excludedFoods: string;
  view: 'grams' | 'equivalents';
  minKcal: number | null;
  maxWeeklyLossPct: number | null;
  defaultMinKcal: number;
};

const ACTIVITY: { value: Activity; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'Poca', hint: 'Oficina y entrenas 1–2 días' },
  { value: 'light', label: 'Ligera', hint: 'Oficina y entrenas 3 días' },
  { value: 'moderate', label: 'Moderada', hint: 'Entrenas 4–5 días o caminas mucho' },
  { value: 'active', label: 'Alta', hint: 'Entrenas casi diario o trabajo físico' },
  { value: 'very_active', label: 'Muy alta', hint: 'Trabajo físico pesado y entrenamiento' },
];

function Segmented<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label mb-2">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn('h-11 rounded-input border text-sm transition-colors', value === o.value ? 'border-text bg-text text-bg' : 'border-border bg-card text-text-2 hover:bg-card-hover')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function NutritionSetupForm({ initial }: { initial: SetupInitial }) {
  const router = useRouter();
  const [flags, setFlags] = useState<HealthFlags>(initial.healthFlags);
  const [activity, setActivity] = useState<Activity>(initial.activity);
  const [mealsPerDay, setMeals] = useState(initial.mealsPerDay);
  const [budget, setBudget] = useState(initial.budget);
  const [cooks, setCooks] = useState(initial.cooks);
  const [excluded, setExcluded] = useState(initial.excludedFoods);
  const [view, setView] = useState(initial.view);
  const [minKcal, setMinKcal] = useState(initial.minKcal ? String(initial.minKcal) : '');
  const [maxLoss, setMaxLoss] = useState(String(initial.maxWeeklyLossPct ?? 0.75));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const keys = Object.keys(HEALTH_FLAG_LABELS_ES) as (keyof HealthFlags)[];
  const none = keys.every((k) => !flags[k]);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await saveSetupAction({
            healthFlags: Object.fromEntries(keys.map((k) => [k, Boolean(flags[k])])),
            activity,
            mealsPerDay,
            budget,
            cooks,
            excludedFoods: excluded,
            view,
            minKcal: minKcal.trim() ? Number(minKcal) : null,
            maxWeeklyLossPct: Number(maxLoss),
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.push('/nutricion');
          router.refresh();
        });
      }}
    >
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Seguridad</h2>
        <p className="text-sm text-text-2">¿Aplica alguna de estas situaciones? En esos casos no armamos planes: necesitas acompañamiento profesional.</p>
        <div className="flex flex-col gap-2" role="group" aria-label="Condiciones de salud">
          {keys.map((k) => (
            <Option key={k} multi selected={Boolean(flags[k])} onSelect={() => setFlags((f) => ({ ...f, [k]: !f[k] }))} label={HEALTH_FLAG_LABELS_ES[k]} />
          ))}
          <Option multi selected={none} onSelect={() => setFlags({})} label="Ninguna" />
        </div>
      </Card>

      <Card className="flex flex-col gap-6">
        <h2 className="text-xl">Actividad y comidas</h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Actividad total (incluye tu entrenamiento)</legend>
          <div className="flex flex-col gap-2">
            {ACTIVITY.map((a) => (
              <Option key={a.value} selected={activity === a.value} onSelect={() => setActivity(a.value)} label={a.label} description={a.hint} />
            ))}
          </div>
        </fieldset>
        <Segmented label="Comidas al día" value={mealsPerDay} onChange={setMeals} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
        <Segmented
          label="Presupuesto"
          value={budget}
          onChange={setBudget}
          options={[
            { value: 'low', label: 'Ajustado' },
            { value: 'medium', label: 'Medio' },
            { value: 'high', label: 'Holgado' },
          ]}
        />
        <Segmented
          label="¿Cocinas?"
          value={cooks}
          onChange={setCooks}
          options={[
            { value: true, label: 'Sí' },
            { value: false, label: 'Casi no' },
          ]}
        />
        <Field>
          <Label htmlFor="excluded">Alimentos que no comes</Label>
          <Textarea id="excluded" value={excluded} onChange={(e) => setExcluded(e.target.value)} maxLength={400} placeholder="Ej. atún, cerdo, lácteos" />
          <FieldHint>Separados por comas. Se excluyen del plan.</FieldHint>
        </Field>
        <Segmented
          label="Ver porciones en"
          value={view}
          onChange={setView}
          options={[
            { value: 'grams', label: 'Gramos' },
            { value: 'equivalents', label: 'Equivalentes' },
          ]}
        />
      </Card>

      <Card className="flex flex-col gap-5">
        <h2 className="text-xl">Límites</h2>
        <Field>
          <Label htmlFor="min-kcal">Piso de calorías (kcal)</Label>
          <Input id="min-kcal" type="number" inputMode="numeric" min={1000} max={4000} step={50} value={minKcal} onChange={(e) => setMinKcal(e.target.value)} placeholder={String(initial.defaultMinKcal)} />
          <FieldHint>Nunca bajamos de este valor ni de tu metabolismo basal. Vacío = {initial.defaultMinKcal} kcal.</FieldHint>
        </Field>
        <Field>
          <Label htmlFor="max-loss">Ritmo máximo de pérdida</Label>
          <Select id="max-loss" value={maxLoss} onChange={(e) => setMaxLoss(e.target.value)}>
            {[0.25, 0.5, 0.75, 1].map((v) => (
              <option key={v} value={v}>
                {v}% del peso por semana{v === 0.75 ? ' (recomendado)' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <FieldError>{error}</FieldError>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar y calcular metas'}
      </Button>
    </form>
  );
}
