import { defaultMinKcal, type Sex } from '@stenia/core';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { NutritionSetupForm } from '@/components/nutrition/setup-form';
import { getProfile, readAnswers } from '@/lib/profile';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Configurar nutrición' };

export default async function NutritionSetupPage() {
  const { user } = await requireSession();
  const p = await getProfile(user.id);
  const answers = readAnswers(p);
  const prefs = p?.nutritionPrefs ?? {};
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/nutricion" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Nutrición
        </Link>
        <h1 className="text-4xl">Configura tu nutrición</h1>
        <p className="max-w-prose text-text-2">Usamos tu perfil (edad, sexo, estatura, peso y objetivo) más estas respuestas.</p>
      </header>
      <NutritionSetupForm
        initial={{
          healthFlags: p?.healthFlags ?? {},
          activity: (p?.activity ?? answers.recovery?.activity ?? 'moderate') as 'moderate',
          mealsPerDay: prefs.mealsPerDay ?? 4,
          budget: prefs.budget ?? 'medium',
          cooks: prefs.cooks ?? true,
          excludedFoods: (prefs.excludedFoods ?? []).join(', '),
          view: prefs.view ?? 'grams',
          minKcal: p?.nutritionLimits.minKcal ?? null,
          maxWeeklyLossPct: p?.nutritionLimits.maxWeeklyLossPct ?? null,
          defaultMinKcal: defaultMinKcal((p?.sex as Sex | null) ?? 'male'),
        }}
      />
    </div>
  );
}
