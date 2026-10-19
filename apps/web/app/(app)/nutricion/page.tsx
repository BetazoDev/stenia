import { HEALTH_FLAG_LABELS_ES, macrosFor } from '@stenia/core';
import { ChevronLeft, ChevronRight, ListChecks, Settings2, ShoppingCart, Target } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DayLog, type DayEntry, type PlanMealSummary } from '@/components/nutrition/day-log';
import { MacroBars } from '@/components/nutrition/macro-bars';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { addDays, localDateString } from '@/lib/dates';
import { ensureFoods } from '@/lib/foods';
import { dayLog, getActivePlan, getCurrentTarget, getNutritionState, loggedDays, mealNamesFor, planDayIndex, refreshTargets } from '@/lib/nutrition';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Nutrición' };

const longDate = (iso: string) => {
  const s = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default async function NutritionPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { user } = await requireSession();
  const params = await searchParams;
  const today = localDateString();
  const date = params.fecha && /^\d{4}-\d{2}-\d{2}$/.test(params.fecha) && params.fecha <= today ? params.fecha : today;
  const state = await getNutritionState(user.id);

  const header = (
    <header className="flex flex-col gap-2">
      <span className="label">Nutrición</span>
      <h1 className="text-4xl">Metas y comidas</h1>
    </header>
  );

  if (state.status === 'needs_profile') {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState
          title="Faltan datos de tu perfil"
          description={`Para calcular tus metas necesitamos: ${state.missing.join(', ')}. Están en el cuestionario inicial.`}
          action={
            <Button asChild>
              <Link href="/onboarding">Completar cuestionario</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (state.status === 'needs_setup') {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState
          title="Configura tu nutrición"
          description="Unas preguntas de seguridad, cuántas comidas haces y tus preferencias. Con eso calculamos metas y armamos tu plan semanal."
          action={
            <Button asChild>
              <Link href="/nutricion/configurar">Empezar</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (state.status === 'blocked') {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl">Te conviene un profesional</h2>
          <p className="text-text-2">
            Por {state.reasons.map((r) => HEALTH_FLAG_LABELS_ES[r].toLowerCase()).join(', ')}, Stenia no calcula metas ni arma planes de
            alimentación: requieren seguimiento de un nutriólogo o médico. Puedes seguir usando el entrenamiento y el registro de progreso.
          </p>
          <Link href="/nutricion/configurar" className="text-sm text-text-2 underline underline-offset-4">
            Revisar mis respuestas
          </Link>
        </Card>
      </div>
    );
  }

  await ensureFoods();
  const target = (await getCurrentTarget(user.id)) ?? (await refreshTargets(user.id));
  const [log, plan, days] = await Promise.all([dayLog(user.id, date), getActivePlan(user.id), loggedDays(user.id, 14)]);
  const meals = mealNamesFor(state.prefs.mealsPerDay);
  const planDay = plan ? plan.data.days[planDayIndex(plan.weekStart, date)] : null;
  const planMeals: PlanMealSummary[] = meals.map((_, i) => {
    const m = planDay?.meals[i];
    if (!m || !plan) return null;
    const kcal = m.items.reduce((a, it) => a + macrosFor(plan.foods.get(it.foodId)?.per100 ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }, it.grams).kcal, 0);
    return { index: i, name: m.name, items: m.items.map((it) => `${plan.foods.get(it.foodId)?.name ?? '—'} ${Math.round(it.grams)} g`), kcal };
  });
  const entries: DayEntry[] = log.entries.map((e) => ({
    id: e.id,
    meal: e.meal,
    grams: e.grams,
    name: e.food.name,
    kcal: e.macros.kcal,
    proteinG: e.macros.proteinG,
    per100Kcal: e.food.per100.kcal,
  }));

  return (
    <div className="flex flex-col gap-8">
      {header}
      <nav className="grid grid-cols-4 gap-2" aria-label="Secciones de nutrición">
        {[
          { href: '/nutricion/plan', label: 'Plan', icon: ListChecks },
          { href: '/nutricion/compras', label: 'Compras', icon: ShoppingCart },
          { href: '/nutricion/metas', label: 'Metas', icon: Target },
          { href: '/nutricion/configurar', label: 'Ajustes', icon: Settings2 },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href as '/nutricion/plan'} className="flex min-h-16 flex-col items-start justify-between gap-2 rounded-card border border-border bg-card p-3 hover:bg-card-hover">
            <Icon strokeWidth={1.5} className="size-5 text-text-2" />
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-3">
        <Link href={`/nutricion?fecha=${addDays(date, -1)}`} className="grid size-11 place-items-center rounded-pill border border-border text-text-2 hover:text-text" aria-label="Día anterior">
          <ChevronLeft strokeWidth={1.5} className="size-5" />
        </Link>
        <div className="flex flex-col items-center">
          <span className="text-lg">{date === today ? 'Hoy' : longDate(date)}</span>
          <span className="text-[12px] text-text-3">{days.length} de los últimos 14 días registrados</span>
        </div>
        {date < today ? (
          <Link href={`/nutricion?fecha=${addDays(date, 1)}`} className="grid size-11 place-items-center rounded-pill border border-border text-text-2 hover:text-text" aria-label="Día siguiente">
            <ChevronRight strokeWidth={1.5} className="size-5" />
          </Link>
        ) : (
          <span className="size-11" aria-hidden />
        )}
      </div>

      {target ? (
        <Card>
          <MacroBars totals={log.totals} target={{ kcal: target.kcal, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG }} />
        </Card>
      ) : null}

      {!plan ? (
        <Card className="flex flex-col items-start gap-3">
          <h2 className="text-xl">Aún no tienes plan semanal</h2>
          <p className="text-sm text-text-2">Lo armamos con alimentos verificados y porciones ajustadas a tus metas.</p>
          <Button asChild>
            <Link href="/nutricion/plan?generar=1">Generar plan</Link>
          </Button>
        </Card>
      ) : null}

      <DayLog date={date} meals={meals} entries={entries} planMeals={planMeals} />
      <p className="text-[12px] text-text-3">Datos nutrimentales: USDA FoodData Central y Open Food Facts (ODbL). Stenia no es un dispositivo médico.</p>
    </div>
  );
}
