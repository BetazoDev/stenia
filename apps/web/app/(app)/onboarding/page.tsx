import type { Metadata } from 'next';

import { listEquipmentWithPhotos, listGymProfiles, type GymPreset } from '@/lib/gym';
import { getProfile, readAnswers } from '@/lib/profile';
import { requireSession } from '@/lib/session';

import { visibleSteps, type Draft } from './steps';
import { OnboardingWizard } from './wizard';

export const metadata: Metadata = { title: 'Cuestionario inicial' };

type Props = { searchParams: Promise<{ resumen?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const { user } = await requireSession();
  const [profile, gyms, catalog, params] = await Promise.all([getProfile(user.id), listGymProfiles(user.id), listEquipmentWithPhotos(), searchParams]);
  const answers = readAnswers(profile);
  const steps = visibleSteps(answers as Draft);
  const summary = steps.length;
  // Retoma en el primer bloque sin guardar; si todo está contestado (o se pide el resumen), va al resumen.
  const firstMissing = steps.findIndex((s) => s.block === 'gym' ? gyms.length === 0 : (answers as Draft)[s.block] === undefined);
  const startIndex = Boolean(profile?.onboardingCompletedAt) || params.resumen === '1' || firstMissing < 0 ? summary : firstMissing;
  const active = gyms.find((g) => g.active) ?? gyms[0] ?? null;
  return (
    <OnboardingWizard
      initial={answers}
      hasGym={gyms.length > 0}
      gymNames={gyms.map((g) => g.name)}
      catalog={catalog}
      activeGym={active ? { id: active.id, name: active.name, kind: active.kind as GymPreset, equipment: active.equipment.map((e) => e.slug) } : null}
      startIndex={startIndex}
    />
  );
}
