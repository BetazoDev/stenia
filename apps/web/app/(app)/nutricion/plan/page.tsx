import { ArrowLeft, ShoppingCart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PlanGenerator } from '@/components/nutrition/plan-generator';
import { PlanView, type PlanFood } from '@/components/nutrition/plan-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { localDateString } from '@/lib/dates';
import { getActivePlan, getNutritionState, planDayIndex } from '@/lib/nutrition';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Plan semanal' };

export default async function MealPlanPage({ searchParams }: { searchParams: Promise<{ generar?: string }> }) {
  const { user } = await requireSession();
  const state = await getNutritionState(user.id);
  if (state.status !== 'ready') redirect('/nutricion');
  const { generar } = await searchParams;
  const plan = await getActivePlan(user.id);
  const foods: Record<string, PlanFood> = {};
  if (plan) {
    for (const [id, f] of plan.foods) foods[id] = { name: f.name, group: f.group, per100: f.per100, unit: f.portions[0] ?? null };
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/nutricion" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Nutrición
        </Link>
        <span className="label">{plan ? `Versión ${plan.version} · desde ${formatShortDate(plan.createdAt)}` : 'Plan semanal'}</span>
        <h1 className="text-4xl">Tu semana</h1>
      </header>

      {generar === '1' || !plan ? (
        <Card className="flex flex-col gap-4">
          {!plan ? <p className="text-text-2">Armamos 7 días con alimentos verificados. El servidor ajusta las porciones a ±5% de tus calorías con la proteína cubierta.</p> : null}
          <PlanGenerator autoStart={generar === '1'} />
        </Card>
      ) : null}

      {plan ? (
        <>
          {plan.data.notes ? <p className="text-sm text-text-2">{plan.data.notes}</p> : null}
          {!plan.data.ok ? <p className="text-sm text-down">Algunos días quedaron fuera de ±5% de tus calorías: revisa las porciones o regenera.</p> : null}
          <PlanView
            plan={{ days: plan.data.days, dayTotals: plan.data.dayTotals }}
            foods={foods}
            view={state.prefs.view}
            todayIndex={planDayIndex(plan.weekStart, localDateString())}
            targets={{ kcal: plan.data.targets.kcal, proteinG: plan.data.targets.proteinG, carbsG: plan.data.targets.carbsG, fatG: plan.data.targets.fatG }}
          />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/nutricion/compras">
                <ShoppingCart strokeWidth={1.5} /> Lista de compras
              </Link>
            </Button>
            {generar !== '1' ? <PlanGenerator label="Regenerar plan" /> : null}
          </div>
          <p className="text-[12px] text-text-3">{plan.data.generator === 'llm' ? 'Menú propuesto por IA; porciones calculadas por el servidor.' : 'Menú por plantillas de alimentos básicos.'}</p>
        </>
      ) : null}
    </div>
  );
}
