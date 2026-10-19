'use client';

import { FlaskConical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { estimateBodyFatAction, type PhotoEstimateResult } from '@/app/(app)/progreso/vision-actions';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';

/** % de grasa por foto (nivel 4): experimental, aproximado y solo con confirmación explícita del envío. */
export function PhotoEstimate({ available, reason, last }: { available: boolean; reason: string | null; last: { pct: number; low: number | null; high: number | null; date: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PhotoEstimateResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FlaskConical strokeWidth={1.5} className="size-5 text-text-2" />
        <h2 className="text-xl">% de grasa por foto</h2>
        <span className="rounded-chip border border-down/40 px-2 py-0.5 text-[11px] uppercase tracking-label text-down">Experimental</span>
      </div>
      <p className="text-sm text-text-2">
        Una estimación aproximada a partir de tus fotos más recientes de frente y perfil. Es solo de referencia: no se usa para tus metas ni para
        los ajustes de las revisiones.
      </p>
      {last ? (
        <p className="text-sm">
          Última estimación ({last.date}): ~{last.pct}%{last.low !== null && last.high !== null ? ` (rango ${last.low}–${last.high}%)` : ''}
        </p>
      ) : null}
      {available ? (
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
          Estimar
        </Button>
      ) : (
        <p className="text-sm text-text-3">{reason}</p>
      )}
      <Sheet open={open} onOpenChange={setOpen} title="Enviar fotos a la IA" description="Esta acción envía tus fotos de frente, perfil y espalda más recientes al proveedor de IA configurado.">
        {result ? (
          result.ok ? (
            <div className="flex flex-col gap-3">
              <p className="font-display text-5xl tracking-display tnum">~{result.pct}%</p>
              <p className="text-text-2">
                Rango probable {result.low}–{result.high}% · confianza {result.confidence === 'medium' ? 'media' : 'baja'}.
              </p>
              {result.notes ? <p className="text-sm text-text-3">{result.notes}</p> : null}
              <p className="text-sm text-text-3">Guardado como «aproximado» en tus medidas.</p>
              <Button onClick={() => setOpen(false)}>Listo</Button>
            </div>
          ) : (
            <p role="alert" className="text-sm text-down">
              {result.message}
            </p>
          )
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-2">
              <li>El proveedor procesa las imágenes según sus términos; Stenia no las comparte con nadie más.</li>
              <li>El resultado puede desviarse varios puntos: compáralo solo contra ti mismo.</li>
              <li>No es un diagnóstico ni un dispositivo médico.</li>
            </ul>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await estimateBodyFatAction(true);
                  setResult(r);
                  if (r.ok) router.refresh();
                })
              }
            >
              {pending ? 'Estimando…' : 'Enviar y estimar'}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
