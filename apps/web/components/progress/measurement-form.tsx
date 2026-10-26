'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { addMeasurementAction } from '@/app/(app)/progreso/actions';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';

const FIELDS = [
  { key: 'weightKg', label: 'Peso (kg)', hint: 'En ayunas, después de ir al baño.', step: '0.1' },
  { key: 'neckCm', label: 'Cuello (cm)', hint: 'Justo debajo de la manzana de Adán, cinta inclinada hacia abajo al frente.', step: '0.1' },
  { key: 'waistCm', label: 'Cintura (cm)', hint: 'Hombres: a la altura del ombligo. Mujeres: en la parte más estrecha. Sin meter el abdomen.', step: '0.1' },
  { key: 'hipCm', label: 'Cadera (cm)', hint: 'En la parte más ancha de los glúteos. Necesaria para la fórmula en mujeres.', step: '0.1' },
  { key: 'armCm', label: 'Brazo (cm)', hint: 'Punto medio entre hombro y codo, brazo relajado.', step: '0.1' },
  { key: 'thighCm', label: 'Muslo (cm)', hint: 'Punto medio entre cadera y rodilla, de pie.', step: '0.1' },
] as const;

type Key = (typeof FIELDS)[number]['key'];

/** `last`: último valor de cada medida, se muestra como pista para escribir el nuevo. */
export function MeasurementForm({ today, sex, last = {} }: { today: string; sex: 'male' | 'female' | null; last?: Partial<Record<Key, number | null>> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<Key, string>>({ weightKg: '', neckCm: '', waistCm: '', hipCm: '', armCm: '', thighCm: '' });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    start(async () => {
      const result = await addMeasurementAction({
        measuredAt: date,
        weightKg: num(values.weightKg),
        neckCm: num(values.neckCm),
        waistCm: num(values.waistCm),
        hipCm: num(values.hipCm),
        armCm: num(values.armCm),
        thighCm: num(values.thighCm),
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message ?? 'Medición guardada.');
      setValues({ weightKg: '', neckCm: '', waistCm: '', hipCm: '', armCm: '', thighCm: '' });
      setNotes('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field>
        <Label htmlFor="m-date">Fecha</Label>
        <Input id="m-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {FIELDS.filter((f) => f.key !== 'hipCm' || sex !== 'male').map((f) => (
          <Field key={f.key}>
            <Label htmlFor={`m-${f.key}`}>{f.label}</Label>
            <Input
              id={`m-${f.key}`}
              type="number"
              inputMode="decimal"
              step={f.step}
              placeholder={last[f.key] != null ? `Último: ${last[f.key]!.toLocaleString('es-MX')}` : undefined}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
            <FieldHint>{f.hint}</FieldHint>
          </Field>
        ))}
      </div>
      <Field>
        <Label htmlFor="m-notes">Notas</Label>
        <Textarea id="m-notes" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </Field>
      <FieldError>{error}</FieldError>
      {message ? (
        <p role="status" className="text-sm text-up">
          {message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Guardando…' : 'Guardar medición'}
      </Button>
    </form>
  );
}
