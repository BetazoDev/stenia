'use client';

import { FileScan } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { extractTicketAction, saveTicketAction } from '@/app/(app)/progreso/vision-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';

type Values = {
  device: 'inbody' | 'bia' | 'dexa' | 'other';
  measuredAt: string;
  weightKg: string;
  bodyFatPct: string;
  leanMassKg: string;
  skeletalMuscleKg: string;
  bmrKcal: string;
  visceralFatLevel: string;
};

const FIELDS: { key: keyof Omit<Values, 'device' | 'measuredAt'>; label: string; hint?: string }[] = [
  { key: 'weightKg', label: 'Peso (kg)' },
  { key: 'bodyFatPct', label: 'Grasa corporal (%)' },
  { key: 'leanMassKg', label: 'Masa libre de grasa (kg)', hint: 'FFM / masa magra total; no es la masa muscular esquelética.' },
  { key: 'skeletalMuscleKg', label: 'Masa muscular esquelética (kg)' },
  { key: 'bmrKcal', label: 'Metabolismo basal (kcal)', hint: 'Si el ticket lo trae, tus metas lo usan directamente.' },
  { key: 'visceralFatLevel', label: 'Grasa visceral (nivel)' },
];

const MAX_SIDE = 2000;

async function downscale(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    return blob ? new File([blob], 'ticket.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

/** Lectura del ticket de InBody/BIA/DEXA: la IA propone valores y la persona los confirma o corrige. */
export function TicketReader({ today, aiReady, aiMessage }: { today: string; aiReady: boolean; aiMessage: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [extracted, setExtracted] = useState(false);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const empty = (): Values => ({ device: 'inbody', measuredAt: today, weightKg: '', bodyFatPct: '', leanMassKg: '', skeletalMuscleKg: '', bmrKcal: '', visceralFatLevel: '' });
  const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Math.round(n * 10) / 10));

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setMessage(null);
    start(async () => {
      const form = new FormData();
      form.set('file', await downscale(file));
      const result = await extractTicketAction(form);
      if (!result.ok) {
        setError(result.message);
        setValues(empty());
        return;
      }
      const d = result.data;
      setExtracted(true);
      setConfidence(d.confidence);
      setValues({
        device: d.device ?? 'inbody',
        measuredAt: d.measuredAt && /^\d{4}-\d{2}-\d{2}$/.test(d.measuredAt) && d.measuredAt <= today ? d.measuredAt : today,
        weightKg: str(d.weightKg),
        bodyFatPct: str(d.bodyFatPct),
        leanMassKg: str(d.leanMassKg),
        skeletalMuscleKg: str(d.skeletalMuscleKg),
        bmrKcal: str(d.bmrKcal),
        visceralFatLevel: str(d.visceralFatLevel),
      });
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
    start(async () => {
      const result = await saveTicketAction({
        device: values.device,
        measuredAt: values.measuredAt,
        weightKg: n(values.weightKg),
        bodyFatPct: n(values.bodyFatPct),
        leanMassKg: n(values.leanMassKg),
        skeletalMuscleKg: n(values.skeletalMuscleKg),
        bmrKcal: n(values.bmrKcal),
        visceralFatLevel: n(values.visceralFatLevel),
        extracted,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setValues(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">1. Foto del ticket</h2>
        {aiReady ? (
          <p className="text-sm text-text-2">La imagen se envía al proveedor de IA configurado solo para leerla y no se guarda. Después revisas cada valor.</p>
        ) : (
          <p className="text-sm text-text-2">{aiMessage ?? 'La lectura automática no está disponible.'} Puedes capturar los valores a mano.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {aiReady ? (
            <Button onClick={() => fileRef.current?.click()} disabled={pending}>
              <FileScan strokeWidth={1.5} /> {pending && !values ? 'Leyendo…' : 'Tomar o subir foto'}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              setExtracted(false);
              setConfidence(null);
              setValues(empty());
            }}
          >
            Capturar a mano
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} aria-label="Foto del ticket" />
      </Card>

      {values ? (
        <Card className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl">2. Confirma los valores</h2>
            {extracted ? (
              <p className="text-sm text-text-2">
                Leídos por IA{confidence ? ` (confianza ${confidence === 'high' ? 'alta' : confidence === 'medium' ? 'media' : 'baja'})` : ''}. Corrige lo que no coincida
                con tu ticket.
              </p>
            ) : null}
          </header>
          <form onSubmit={save} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label htmlFor="t-device">Equipo</Label>
                <Select id="t-device" value={values.device} onChange={(e) => setValues({ ...values, device: e.target.value as Values['device'] })}>
                  <option value="inbody">InBody</option>
                  <option value="bia">Báscula de bioimpedancia</option>
                  <option value="dexa">DEXA</option>
                  <option value="other">Otro</option>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="t-date">Fecha</Label>
                <Input id="t-date" type="date" max={today} value={values.measuredAt} onChange={(e) => setValues({ ...values, measuredAt: e.target.value })} required />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.key}>
                  <Label htmlFor={`t-${f.key}`}>{f.label}</Label>
                  <Input id={`t-${f.key}`} type="number" inputMode="decimal" step="0.1" value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                  {f.hint ? <FieldHint>{f.hint}</FieldHint> : null}
                </Field>
              ))}
            </div>
            <FieldError>{error}</FieldError>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar medición'}
            </Button>
          </form>
        </Card>
      ) : error ? (
        <FieldError>{error}</FieldError>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-up">
          {message}
        </p>
      ) : null}
    </div>
  );
}
