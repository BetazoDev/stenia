'use client';

import { PHOTO_POSE_LABELS_ES, type PhotoPose } from '@stenia/core';
import { useMemo, useState } from 'react';

import { Select } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type PhotoItem = { id: string; url: string; pose: PhotoPose; takenAt: string };

const fmt = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' }).format(new Date(iso));

/** Comparación lado a lado de la misma pose en dos fechas (nivel 3 del escaneo). */
export function PhotoCompare({ photos }: { photos: PhotoItem[] }) {
  const poses = (['front', 'side', 'back'] as const).filter((p) => photos.some((x) => x.pose === p));
  const [pose, setPose] = useState<PhotoPose>(poses[0] ?? 'front');
  const list = useMemo(() => photos.filter((p) => p.pose === pose).sort((a, b) => a.takenAt.localeCompare(b.takenAt)), [photos, pose]);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const before = list.find((p) => p.id === beforeId) ?? list[0];
  const after = list.find((p) => p.id === afterId) ?? list[list.length - 1];
  if (list.length < 2 || !before || !after) {
    return <p className="text-sm text-text-3">Necesitas al menos dos fotos de la misma pose para comparar.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pose a comparar">
        {poses.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={pose === p}
            onClick={() => {
              setPose(p);
              setBeforeId(null);
              setAfterId(null);
            }}
            className={cn('h-9 rounded-pill border px-4 text-sm', pose === p ? 'border-text bg-text text-bg' : 'border-border-strong text-text-2')}
          >
            {PHOTO_POSE_LABELS_ES[p]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Antes', value: before, set: setBeforeId },
          { label: 'Después', value: after, set: setAfterId },
        ].map(({ label, value, set }) => (
          <div key={label} className="flex flex-col gap-2">
            <Label htmlFor={`cmp-${label}`}>{label}</Label>
            <Select id={`cmp-${label}`} value={value.id} onChange={(e) => set(e.target.value)}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {fmt(p.takenAt)}
                </option>
              ))}
            </Select>
            <img src={value.url} alt={`${PHOTO_POSE_LABELS_ES[pose]} · ${fmt(value.takenAt)}`} className="aspect-[3/4] w-full rounded-card border border-border object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
