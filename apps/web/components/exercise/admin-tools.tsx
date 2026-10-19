'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';

import { markReviewedAction, setVideoAction } from '@/app/(app)/ejercicios/[slug]/actions';

export function ExerciseAdminTools({ exerciseId, videoId, reviewed }: { exerciseId: string; videoId: string | null; reviewed: boolean }) {
  const [video, setVideo] = useState(videoId ? `https://youtu.be/${videoId}` : '');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="label">Administración del catálogo</h2>
      <Field>
        <Label htmlFor="yt">Video de técnica (YouTube)</Label>
        <div className="flex gap-2">
          <Input id="yt" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://youtu.be/…" />
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await setVideoAction(exerciseId, video);
              setMessage(r.ok ? 'Video guardado.' : r.message);
            })}
          >
            Guardar
          </Button>
        </div>
      </Field>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await markReviewedAction(exerciseId, !reviewed);
          setMessage(r.ok ? (reviewed ? 'Marcado como no revisado.' : 'Traducción marcada como revisada.') : r.message);
        })}
      >
        {reviewed ? 'Marcar como no revisado' : 'Marcar traducción como revisada'}
      </Button>
      {message ? <p className="text-sm text-text-2">{message}</p> : null}
    </Card>
  );
}
