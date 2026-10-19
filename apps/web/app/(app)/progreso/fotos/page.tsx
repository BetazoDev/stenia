import { PHOTO_POSE_LABELS_ES, type PhotoPose } from '@stenia/core';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { deleteAllPhotosAction, deletePhotoAction } from '@/app/(app)/progreso/actions';
import { PhotoConsentCard } from '@/components/progress/consent-card';
import { DeleteButton } from '@/components/progress/delete-button';
import { PhotoCapture } from '@/components/progress/photo-capture';
import { PhotoCompare } from '@/components/progress/photo-compare';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { listPhotos } from '@/lib/body';
import { getProfile } from '@/lib/profile';
import { requireSession } from '@/lib/session';
import { formatShortDate } from '@/lib/time';

export const metadata: Metadata = { title: 'Fotos de progreso' };

export default async function PhotosPage() {
  const { user } = await requireSession();
  const [profile, photos] = await Promise.all([getProfile(user.id), listPhotos(user.id)]);
  const consent = Boolean(profile?.photosConsentAt);
  const byDate = new Map<string, typeof photos>();
  for (const p of photos) {
    const key = formatShortDate(p.takenAt);
    byDate.set(key, [...(byDate.get(key) ?? []), p]);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/progreso" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Progreso
        </Link>
        <span className="label">Escaneo corporal · nivel 3</span>
        <h1 className="text-4xl">Fotos de progreso</h1>
        <p className="max-w-prose text-text-2">Frente, perfil y espalda con la misma luz y encuadre. Validamos pose y encuadre antes de guardar.</p>
      </header>

      {!consent ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl">Antes de empezar</h2>
          <PhotoConsentCard />
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-4">
            <h2 className="text-xl">Nueva toma</h2>
            <PhotoCapture />
          </Card>

          {photos.length > 0 ? (
            <Card className="flex flex-col gap-4">
              <h2 className="text-xl">Comparar</h2>
              <PhotoCompare photos={photos.map((p) => ({ id: p.id, url: p.url, pose: p.pose as PhotoPose, takenAt: p.takenAt.toISOString() }))} />
            </Card>
          ) : null}

          {[...byDate.entries()].map(([date, items]) => (
            <section key={date} className="flex flex-col gap-3" aria-label={date}>
              <h2 className="label">{date}</h2>
              <ul className="grid grid-cols-3 gap-3">
                {items.map((p) => {
                  const ok = (p.landmarks as { ok?: boolean } | null)?.ok;
                  return (
                    <li key={p.id} className="flex flex-col gap-2">
                      <img src={p.url} alt={`${PHOTO_POSE_LABELS_ES[p.pose as PhotoPose]} del ${date}`} loading="lazy" className="aspect-[3/4] w-full rounded-card border border-border object-cover" />
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex flex-col">
                          <span className="text-sm">{PHOTO_POSE_LABELS_ES[p.pose as PhotoPose]}</span>
                          {ok === false ? <Chip tone="down" className="h-6 px-1.5 text-[10px]">Revisar pose</Chip> : null}
                        </span>
                        <DeleteButton action={deletePhotoAction.bind(null, p.id)} label="Borrar foto" confirm="¿Borrar esta foto? No se puede deshacer." />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <Card className="flex flex-col gap-3">
            <h2 className="text-xl">Privacidad</h2>
            <p className="text-sm text-text-2">Borrar todas las fotos también retira tu consentimiento. Para volver a usarlas tendrás que activarlo de nuevo.</p>
            <div className="flex items-center gap-2">
              <DeleteButton action={deleteAllPhotosAction} label="Borrar todas las fotos" confirm="¿Borrar todas tus fotos y retirar el consentimiento?" className="w-auto gap-2 px-4" />
              <span className="text-sm text-text-2">Borrar todas las fotos</span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
