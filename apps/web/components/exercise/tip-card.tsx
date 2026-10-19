'use client';

import { Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { generateTipAction } from '@/app/(app)/ejercicios/[slug]/actions';

export function TipCard({ exerciseId, tip, aiAvailable }: { exerciseId: string; tip: string | null; aiAvailable: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles strokeWidth={1.5} className="size-5 text-text-2" />
        <h2 className="text-xl">Para ti</h2>
      </div>
      {tip ? <p className="text-text-2">{tip}</p> : <p className="text-text-3">Una recomendación según tu nivel, tus series recientes y tus notas.</p>}
      {aiAvailable ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await generateTipAction(exerciseId);
              if (!r.ok) setError(r.message);
            })
          }
        >
          {pending ? 'Generando…' : tip ? 'Actualizar recomendación' : 'Generar recomendación'}
        </Button>
      ) : (
        <p className="text-sm text-text-3">La IA no está configurada.</p>
      )}
      {error ? <p role="alert" className="text-sm text-down">{error}</p> : null}
    </Card>
  );
}
