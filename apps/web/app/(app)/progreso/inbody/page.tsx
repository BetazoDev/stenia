import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { TicketReader } from '@/components/progress/ticket-reader';
import { aiStatus } from '@/lib/ai';
import { localDateString } from '@/lib/dates';
import { requireSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Ticket de composición corporal' };

export default async function InbodyPage() {
  await requireSession();
  const status = await aiStatus('inbody_extraction');
  const ready = status.available && status.sendPhotos;
  const message = !status.available
    ? status.reason === 'budget'
      ? 'Se alcanzó el presupuesto mensual de IA.'
      : 'La IA no está configurada.'
    : !status.sendPhotos
      ? 'El envío de imágenes a la IA está apagado en Configuración de desarrollador.'
      : null;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/progreso/medidas" className="flex items-center gap-2 text-sm text-text-2 hover:text-text">
          <ArrowLeft strokeWidth={1.5} className="size-4" /> Medidas
        </Link>
        <span className="label">Escaneo corporal · nivel 2</span>
        <h1 className="text-4xl">Ticket de InBody, BIA o DEXA</h1>
        <p className="max-w-prose text-text-2">
          Extraemos % de grasa, masa libre de grasa y metabolismo basal. Nada se guarda sin tu confirmación, y la TMB medida tiene
          prioridad al calcular tus metas.
        </p>
      </header>
      <TicketReader today={localDateString()} aiReady={ready} aiMessage={message} />
    </div>
  );
}
