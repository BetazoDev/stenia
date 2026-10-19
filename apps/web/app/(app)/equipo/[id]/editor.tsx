'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Option } from '@/components/ui/option';

import { saveGymProfileAction } from '../actions';

type Meta = {
  dumbbellMinKg?: number;
  dumbbellMaxKg?: number;
  dumbbellStepKg?: number;
  weightedKgAvailable?: number;
  weightedStepKg?: number;
};

type Props = {
  profile: { id: string; name: string; kind: string; equipment: { slug: string; meta: Meta }[] };
  catalog: { slug: string; nameEs: string; category: string }[];
};

const CATEGORY_LABELS: Record<string, string> = {
  machine: 'Máquinas',
  free_weight: 'Peso libre',
  structure: 'Estructuras',
  space: 'Espacio',
  weighted: 'Lastre',
  other: 'Otros',
};

const ORDER = ['machine', 'free_weight', 'structure', 'space', 'weighted', 'other'];

export function GymEditor({ profile, catalog }: Props) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [selected, setSelected] = useState<Map<string, Meta>>(new Map(profile.equipment.map((e) => [e.slug, e.meta ?? {}])));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const groups = useMemo(() => ORDER.map((c) => ({ category: c, items: catalog.filter((e) => e.category === c) })).filter((g) => g.items.length), [catalog]);

  const toggle = (slug: string) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(slug)) next.delete(slug);
      else next.set(slug, {});
      return next;
    });

  const setMeta = (slug: string, patch: Meta) =>
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(slug, { ...(next.get(slug) ?? {}), ...patch });
      return next;
    });

  const num = (v: string) => (v === '' ? undefined : Number(v));

  const save = () => {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await saveGymProfileAction({
        id: profile.id,
        name,
        kind: profile.kind,
        equipment: [...selected.entries()].map(([slug, meta]) => ({ slug, meta })),
      });
      if (!result.ok) setError(result.message);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  const dumbbells = selected.get('dumbbells');
  const weighted = ['dip_belt', 'weight_vest', 'backpack'].find((s) => selected.has(s));

  return (
    <div className="flex flex-col gap-8 pb-24">
      <header className="flex flex-col gap-3">
        <span className="label">Equipamiento</span>
        <Field>
          <Label htmlFor="gym-name">Nombre</Label>
          <Input id="gym-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
      </header>

      {groups.map((g) => (
        <section key={g.category} className="flex flex-col gap-3">
          <h2 className="text-xl">{CATEGORY_LABELS[g.category] ?? g.category}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {g.items.map((e) => (
              <Option key={e.slug} multi selected={selected.has(e.slug)} label={e.nameEs} onSelect={() => toggle(e.slug)} />
            ))}
          </div>
          {g.category === 'free_weight' && dumbbells ? (
            <Card className="grid grid-cols-3 gap-3">
              <Field>
                <Label htmlFor="db-min">Mancuerna mín.</Label>
                <Input id="db-min" type="number" inputMode="decimal" value={dumbbells.dumbbellMinKg ?? ''} onChange={(ev) => setMeta('dumbbells', { dumbbellMinKg: num(ev.target.value) })} />
              </Field>
              <Field>
                <Label htmlFor="db-max">Máx. (kg)</Label>
                <Input id="db-max" type="number" inputMode="decimal" value={dumbbells.dumbbellMaxKg ?? ''} onChange={(ev) => setMeta('dumbbells', { dumbbellMaxKg: num(ev.target.value) })} />
              </Field>
              <Field>
                <Label htmlFor="db-step">Incremento</Label>
                <Input id="db-step" type="number" inputMode="decimal" value={dumbbells.dumbbellStepKg ?? ''} onChange={(ev) => setMeta('dumbbells', { dumbbellStepKg: num(ev.target.value) })} />
              </Field>
              <FieldHint className="col-span-3">El incremento es el paso mínimo que usa el motor de progresión.</FieldHint>
            </Card>
          ) : null}
          {g.category === 'weighted' && weighted ? (
            <Card className="grid grid-cols-2 gap-3">
              <Field>
                <Label htmlFor="w-kg">Kg disponibles</Label>
                <Input id="w-kg" type="number" inputMode="decimal" value={selected.get(weighted)?.weightedKgAvailable ?? ''} onChange={(ev) => setMeta(weighted, { weightedKgAvailable: num(ev.target.value) })} />
              </Field>
              <Field>
                <Label htmlFor="w-step">Paso mínimo</Label>
                <Input id="w-step" type="number" inputMode="decimal" value={selected.get(weighted)?.weightedStepKg ?? ''} onChange={(ev) => setMeta(weighted, { weightedStepKg: num(ev.target.value) })} />
              </Field>
              <FieldHint className="col-span-2">El lastre habilita la progresión con peso en dominadas y fondos.</FieldHint>
            </Card>
          ) : null}
        </section>
      ))}

      <div className="sticky bottom-20 flex flex-wrap items-center gap-3 border-t border-border bg-bg py-3 md:bottom-0">
        <Button disabled={pending} onClick={save}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variant="ghost" onClick={() => router.push('/equipo')}>
          Volver
        </Button>
        {saved ? <span className="text-sm text-up">Guardado. Regenera la rutina para aplicarlo.</span> : null}
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}
