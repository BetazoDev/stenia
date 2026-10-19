import { FOOD_GROUP_LABELS_ES, shoppingList, type FoodGroup } from '@stenia/core';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ShoppingChecklist } from '@/components/nutrition/shopping-checklist';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getActivePlan } from '@/lib/nutrition';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Lista de compras' };

export default async function ShoppingPage() {
  const { user } = await requireSession();
  const plan = await getActivePlan(user.id);
  const header = (
    <header className="flex flex-col gap-3">
      <Link href="/nutricion/plan" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
        <ArrowLeft strokeWidth={1.5} className="size-4" /> Plan
      </Link>
      <h1 className="text-4xl">Lista de compras</h1>
    </header>
  );
  if (!plan) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState
          title="Sin plan activo"
          description="La lista se arma con las cantidades de tu plan semanal."
          action={
            <Button asChild>
              <Link href="/nutricion/plan?generar=1">Generar plan</Link>
            </Button>
          }
        />
      </div>
    );
  }
  // Unidad de compra: solo porciones cortas y contables («1 tortilla», «1 lata escurrida»).
  const unitOf = (portions: { label: string; grams: number }[]) =>
    portions.find((p) => /^1 [a-záéíóúñ]/i.test(p.label) && p.label.length <= 24 && !/[(),]/.test(p.label) && !/(taza|cucharad|onza|porción|puño)/.test(p.label)) ?? null;
  const foods = new Map([...plan.foods.entries()].map(([id, f]) => [id, { name: f.name, group: f.group, unit: unitOf(f.portions) }]));
  const list = shoppingList(plan.data.days, foods);
  const order: (FoodGroup | 'other')[] = ['protein', 'dairy', 'cereal', 'legume', 'vegetable', 'fruit', 'fat', 'sugar', 'free', 'mixed', 'other'];
  const groups = order
    .map((g) => ({
      label: g === 'other' ? 'Otros' : FOOD_GROUP_LABELS_ES[g],
      items: list.filter((i) => (i.group ?? 'other') === g).map((i) => ({ foodId: i.foodId, name: i.name, display: i.display.replace(/^(\d+) × 1 /, '$1 × ') })),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {header}
      <p className="text-text-2">Cantidades para los 7 días del plan, redondeadas hacia arriba. Las casillas se recuerdan en este dispositivo.</p>
      <ShoppingChecklist planId={plan.id} groups={groups} />
    </div>
  );
}
