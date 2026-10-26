import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getGymProfile, listEquipmentWithPhotos } from '@/lib/gym';
import { requireSession } from '@/lib/session';

import { GymEditor } from './editor';

export const metadata: Metadata = { title: 'Editar equipamiento' };

type Props = { params: Promise<{ id: string }> };

export default async function EditGymPage({ params }: Props) {
  const { user } = await requireSession();
  const { id } = await params;
  const [profile, catalog] = await Promise.all([getGymProfile(user.id, id), listEquipmentWithPhotos()]);
  if (!profile) notFound();
  return (
    <GymEditor
      profile={{ id: profile.id, name: profile.name, kind: profile.kind, equipment: profile.equipment }}
      catalog={catalog}
    />
  );
}
