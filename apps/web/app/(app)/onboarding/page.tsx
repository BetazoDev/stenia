import type { Metadata } from 'next';

import { listGymProfiles } from '@/lib/gym';
import { getProfile, readAnswers } from '@/lib/profile';
import { requireSession } from '@/lib/session';

import { visibleSteps, type Draft } from './steps';
import { OnboardingWizard } from './wizard';

export const metadata: Metadata = { title: 'Cuestionario inicial' };

type Props = { searchParams: Promise<{ resumen?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const { user } = await requireSession();
  const [profile, gyms, params] = await Promise.all([getProfile(user.id), listGymProfiles(user.id), searchParams]);
  const answers = readAnswers(profile);
  const steps = visibleSteps(answers as Draft);
  const summary = steps.length;
  // Retoma en el primer bloque sin guardar; si todo está contestado (o se pide el resumen), va al resumen.
  const firstMissing = steps.findIndex((s) => s.block === 'gym' ? gyms.length === 0 : (answers as Draft)[s.block] === undefined);
  const startIndex = Boolean(profile?.onboardingCompletedAt) || params.resumen === '1' || firstMissing < 0 ? summary : firstMissing;
  return <OnboardingWizard initial={answers} hasGym={gyms.length > 0} gymNames={gyms.map((g) => g.name)} startIndex={startIndex} />;
}
