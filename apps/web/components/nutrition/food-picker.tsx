'use client';

import { FOOD_GROUP_LABELS_ES, FoodGroup, macrosFor } from '@stenia/core';
import { ArrowLeft, Plus, Search, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import {
  addLogAction,
  barcodeAction,
  createCustomFoodAction,
  logSavedMealAction,
  pickerDataAction,
  searchFoodsAction,
  toggleFavoriteAction,
  type PickerItem,
} from '@/app/(app)/nutricion/actions';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field, FieldError, Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { BarcodeScanner } from './barcode-scanner';

type Tab = 'recent' | 'favorites' | 'saved' | 'scan' | 'create';
type PickerData = Awaited<ReturnType<typeof pickerDataAction>>;

const TABS: { key: Tab; label: string }[] = [
  { key: 'recent', label: 'Recientes' },
  { key: 'favorites', label: 'Favoritos' },
  { key: 'saved', label: 'Comidas' },
  { key: 'scan', label: 'Escanear' },
  { key: 'create', label: 'Crear' },
];

const r = (n: number) => Math.round(n).toLocaleString('es-MX');

function FoodRowButton({ f, onPick }: { f: PickerItem; onPick: (f: PickerItem) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(f)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-card-hover">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 leading-snug">
            {f.name}
            {f.brand ? <span className="text-text-3"> · {f.brand}</span> : null}
          </span>
          <span className="text-[12px] text-text-3 tnum">
            {r(f.per100.kcal)} kcal · P {f.per100.proteinG} · C {f.per100.carbsG} · G {f.per100.fatG} por 100 g
          </span>
        </span>
        {f.favorite ? <Star strokeWidth={1.5} className="size-4 shrink-0 fill-current text-text-2" aria-label="Favorito" /> : null}
      </button>
    </li>
  );
}

/** Selector de alimentos: búsqueda, recientes, favoritos, comidas guardadas, escáner y alimentos propios. */
export function FoodPicker({ open, onOpenChange, date, meal }: { open: boolean; onOpenChange: (o: boolean) => void; date: string; meal: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickerItem[] | null>(null);
  const [tab, setTab] = useState<Tab>('recent');
  const [data, setData] = useState<PickerData | null>(null);
  const [selected, setSelected] = useState<PickerItem | null>(null);
  const [grams, setGrams] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void pickerDataAction().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const id = ++seq.current;
    const t = window.setTimeout(() => {
      void searchFoodsAction(term).then((list) => {
        if (id === seq.current) setResults(list);
      });
    }, 220);
    return () => window.clearTimeout(t);
  }, [q]);

  function reset() {
    setQ('');
    setResults(null);
    setSelected(null);
    setError(null);
    setTab('recent');
  }

  function pick(f: PickerItem) {
    setSelected(f);
    setGrams(String(f.lastGrams ?? f.defaultGrams ?? 100));
    setError(null);
  }

  function add() {
    if (!selected) return;
    const g = Number(grams.replace(',', '.'));
    if (!Number.isFinite(g) || g <= 0) {
      setError('Escribe los gramos.');
      return;
    }
    start(async () => {
      const result = await addLogAction({ date, meal, foodId: selected.id, grams: g });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onOpenChange(false);
      reset();
    });
  }

  function scan(code: string) {
    setError(null);
    start(async () => {
      const result = await barcodeAction(code);
      if (!result.ok) {
        setError(result.message);
        if (result.reason === 'incomplete' || result.reason === 'not_found') setTab('create');
        return;
      }
      pick({ ...result.food, favorite: false });
    });
  }

  const g = Number(grams.replace(',', '.')) || 0;
  const portion = selected ? macrosFor(selected.per100, g) : null;
  const searching = q.trim().length >= 2;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={`Agregar a ${meal.toLowerCase()}`}
      className="md:max-w-xl"
    >
      {selected ? (
        <div className="flex flex-col gap-5">
          <button type="button" onClick={() => setSelected(null)} className="flex items-center gap-2 self-start text-sm text-text-2 hover:text-text">
            <ArrowLeft strokeWidth={1.5} className="size-4" /> Volver
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl leading-tight">{selected.name}</h3>
              <span className="text-sm text-text-3">
                {selected.group ? FOOD_GROUP_LABELS_ES[selected.group] : 'Sin grupo'}
                {selected.brand ? ` · ${selected.brand}` : ''}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={selected.favorite}
              aria-label={selected.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              onClick={() => {
                const next = !selected.favorite;
                setSelected({ ...selected, favorite: next });
                void toggleFavoriteAction(selected.id);
              }}
              className="grid size-11 shrink-0 place-items-center rounded-pill border border-border text-text-2 hover:text-text"
            >
              <Star strokeWidth={1.5} className={cn('size-5', selected.favorite && 'fill-current text-text')} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...selected.portions.slice(0, 4), { label: '100 g', grams: 100 }].map((p) => (
              <button
                key={`${p.label}-${p.grams}`}
                type="button"
                onClick={() => setGrams(String(p.grams))}
                className={cn('min-h-9 rounded-chip border px-3 text-sm', Number(grams) === p.grams ? 'border-text text-text' : 'border-border text-text-2')}
              >
                {p.label} <span className="text-text-3">({r(p.grams)} g)</span>
              </button>
            ))}
          </div>
          <Field>
            <Label htmlFor="picker-grams">Gramos</Label>
            <Input id="picker-grams" type="number" inputMode="decimal" min={1} step={1} value={grams} onChange={(e) => setGrams(e.target.value)} />
          </Field>
          {portion ? (
            <dl className="grid grid-cols-4 gap-2 text-center">
              {[
                ['kcal', portion.kcal],
                ['Prot.', portion.proteinG],
                ['Carb.', portion.carbsG],
                ['Grasa', portion.fatG],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-input border border-border py-2">
                  <dt className="label">{label}</dt>
                  <dd className="font-display text-xl tracking-display tnum">{r(value as number)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {selected.source === 'off' ? (
            <p className="text-[12px] text-text-3">
              Datos de{' '}
              <a href={selected.attributionUrl ?? 'https://world.openfoodfacts.org'} target="_blank" rel="noreferrer" className="underline">
                Open Food Facts
              </a>{' '}
              (ODbL).
            </p>
          ) : selected.source === 'usda' ? (
            <p className="text-[12px] text-text-3">Fuente: USDA FoodData Central.</p>
          ) : null}
          <FieldError>{error}</FieldError>
          <Button onClick={add} disabled={pending} size="lg" block>
            <Plus strokeWidth={1.5} /> {pending ? 'Agregando…' : 'Agregar'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
            <Input
              autoFocus
              type="search"
              placeholder="Buscar: tortilla, pollo, avena…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim().length < 2) setResults(null);
              }}
              className="pl-9"
              aria-label="Buscar alimento"
            />
          </div>
          {searching ? (
            results === null ? (
              <p className="text-sm text-text-3">Buscando…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-text-3">Sin resultados. Prueba otra palabra o crea el alimento.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
                {results.map((f) => (
                  <FoodRowButton key={f.id} f={f} onPick={pick} />
                ))}
              </ul>
            )
          ) : (
            <>
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cn('h-9 shrink-0 rounded-pill border px-3.5 text-sm', tab === t.key ? 'border-text bg-text text-bg' : 'border-border text-text-2')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === 'recent' || tab === 'favorites' ? (
                !data ? (
                  <p className="text-sm text-text-3">Cargando…</p>
                ) : (tab === 'recent' ? data.recents : data.favorites).length === 0 ? (
                  <p className="text-sm text-text-3">{tab === 'recent' ? 'Aún no registras alimentos.' : 'Marca alimentos con la estrella para tenerlos a mano.'}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
                    {(tab === 'recent' ? data.recents : data.favorites).map((f) => (
                      <FoodRowButton key={f.id} f={f} onPick={pick} />
                    ))}
                  </ul>
                )
              ) : null}
              {tab === 'saved' ? (
                !data || data.saved.length === 0 ? (
                  <p className="text-sm text-text-3">Guarda una comida desde el registro para repetirla con un toque.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
                    {data.saved.map((s) => (
                      <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span>{s.name}</span>
                          <span className="line-clamp-1 text-[12px] text-text-3">{s.items.map((i) => i.name).join(', ')}</span>
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const result = await logSavedMealAction(date, meal, s.id);
                              if (!result.ok) {
                                setError(result.message);
                                return;
                              }
                              router.refresh();
                              onOpenChange(false);
                              reset();
                            })
                          }
                        >
                          Agregar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
              {tab === 'scan' ? <BarcodeScanner onDetected={scan} busy={pending} /> : null}
              {tab === 'create' ? <CustomFoodForm onCreated={pick} /> : null}
              <FieldError>{error}</FieldError>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function CustomFoodForm({ onCreated }: { onCreated: (f: PickerItem) => void }) {
  const [v, setV] = useState({ name: '', brand: '', kcal: '', proteinG: '', carbsG: '', fatG: '', group: '', portionLabel: '', portionGrams: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createCustomFoodAction({
            name: v.name,
            brand: v.brand.trim() || null,
            kcal: n(v.kcal) ?? 0,
            proteinG: n(v.proteinG) ?? 0,
            carbsG: n(v.carbsG) ?? 0,
            fatG: n(v.fatG) ?? 0,
            group: v.group || null,
            portionLabel: v.portionLabel.trim() || null,
            portionGrams: n(v.portionGrams),
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          onCreated(result.food);
        });
      }}
    >
      <p className="text-sm text-text-2">Copia los valores por 100 g de la etiqueta nutrimental.</p>
      <Field>
        <Label htmlFor="cf-name">Nombre</Label>
        <Input id="cf-name" value={v.name} onChange={set('name')} required minLength={2} maxLength={80} />
      </Field>
      <Field>
        <Label htmlFor="cf-brand">Marca (opcional)</Label>
        <Input id="cf-brand" value={v.brand} onChange={set('brand')} maxLength={60} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['kcal', 'kcal / 100 g'],
            ['proteinG', 'Proteína (g)'],
            ['carbsG', 'Carbohidratos (g)'],
            ['fatG', 'Grasa (g)'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k}>
            <Label htmlFor={`cf-${k}`}>{label}</Label>
            <Input id={`cf-${k}`} type="number" inputMode="decimal" step="0.1" min={0} value={v[k]} onChange={set(k)} required />
          </Field>
        ))}
      </div>
      <Field>
        <Label htmlFor="cf-group">Grupo</Label>
        <Select id="cf-group" value={v.group} onChange={set('group')}>
          <option value="">Sin grupo</option>
          {FoodGroup.options.map((g) => (
            <option key={g} value={g}>
              {FOOD_GROUP_LABELS_ES[g]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label htmlFor="cf-pl">Porción (opcional)</Label>
          <Input id="cf-pl" value={v.portionLabel} onChange={set('portionLabel')} placeholder="1 barra" maxLength={40} />
        </Field>
        <Field>
          <Label htmlFor="cf-pg">Gramos de la porción</Label>
          <Input id="cf-pg" type="number" inputMode="decimal" value={v.portionGrams} onChange={set('portionGrams')} />
        </Field>
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" disabled={pending}>
        {pending ? 'Guardando…' : 'Crear alimento'}
      </Button>
    </form>
  );
}
