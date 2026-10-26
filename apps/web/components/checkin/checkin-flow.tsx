'use client';

import { ADJUSTMENT_KIND_LABELS_ES, MISSED_REASON_LABELS_ES, type MissedReason } from '@stenia/core';
import { Check, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { analyzeCheckinAction, decideCheckinAction } from '@/app/(app)/revision/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Stepper } from '@/components/ui/stepper';
import type { StoredProposal } from '@/lib/checkins';
import { cn } from '@/lib/utils';

import { Scale } from './scale';

type Props = {
  id: string;
  type: 'light' | 'full' | 'early';
  trigger: string | null;
  sex: 'male' | 'female' | null;
  weightAvg7d: number | null;
  /** Último peso registrado: pista en el campo para escribir el de hoy. */
  lastWeight?: number | null;
  initial: { summary: string; proposals: StoredProposal[]; generator: 'llm' | 'rules'; aiMessage: string | null } | null;
};

type Decision = { accept: boolean; setsDelta: number | null; kcalDelta: number | null };

const CM_FIELDS = [
  { key: 'waistCm', label: 'Cintura' },
  { key: 'neckCm', label: 'Cuello' },
  { key: 'hipCm', label: 'Cadera' },
  { key: 'armCm', label: 'Brazo' },
  { key: 'thighCm', label: 'Muslo' },
] as const;

export function CheckinFlow({ id, type, trigger, sex, weightAvg7d, lastWeight = null, initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [planRating, setPlanRating] = useState<number | null>(null);
  const [weight, setWeight] = useState('');
  const [cm, setCm] = useState<Record<(typeof CM_FIELDS)[number]['key'], string>>({ waistCm: '', neckCm: '', hipCm: '', armCm: '', thighCm: '' });
  const [painPersists, setPainPersists] = useState<boolean | null>(null);
  const [missedReason, setMissedReason] = useState<MissedReason | ''>('');
  const [notes, setNotes] = useState('');
  const [analysis, setAnalysis] = useState(initial);
  const [decisions, setDecisions] = useState<Decision[]>(() => (initial?.proposals ?? []).map((p) => ({ accept: p.kind !== 'keep', setsDelta: p.setsDelta, kcalDelta: p.kcalDelta })));
  const [done, setDone] = useState<{ version: number | null; accepted: number } | null>(null);

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  function submitAnswers(e: React.FormEvent) {
    e.preventDefault();
    if (!energy || !sleep || !effort) {
      setError('Contesta energía, sueño y esfuerzo.');
      return;
    }
    setError(null);
    const hasCm = Object.values(cm).some((v) => v.trim() !== '');
    start(async () => {
      const result = await analyzeCheckinAction(id, {
        weightKg: num(weight),
        energy,
        sleep,
        effort,
        planRating: type === 'full' ? planRating : null,
        painPersists: trigger === 'pain' ? painPersists : null,
        missedReason: trigger === 'missed_sessions' && missedReason ? missedReason : null,
        notes,
        measurements: type === 'full' && hasCm ? Object.fromEntries(Object.entries(cm).map(([k, v]) => [k, num(v)])) : null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAnalysis({ summary: result.summary, proposals: result.proposals, generator: result.generator, aiMessage: result.aiMessage });
      setDecisions(result.proposals.map((p) => ({ accept: p.kind !== 'keep', setsDelta: p.setsDelta, kcalDelta: p.kcalDelta })));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function submitDecision() {
    setError(null);
    start(async () => {
      const result = await decideCheckinAction(id, {
        items: decisions.map((d, index) => ({ index, accept: d.accept, setsDelta: d.setsDelta, kcalDelta: d.kcalDelta })),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDone({ version: result.version, accepted: result.accepted });
      router.refresh();
    });
  }

  if (done) {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl">Revisión cerrada</h2>
        <p className="text-text-2">
          {done.accepted === 0
            ? 'No aceptaste cambios: el plan sigue igual.'
            : done.version
              ? `Aplicamos ${done.accepted} ajuste(s). Tu rutina ahora va en la versión ${done.version}.`
              : `Guardamos ${done.accepted} ajuste(s). La rutina no cambia de estructura.`}
        </p>
        <div className="flex flex-wrap gap-3">
          {done.version ? (
            <Button asChild>
              <Link href="/rutina">Ver rutina</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href="/hoy">Volver a Hoy</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (analysis) {
    return (
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-3">
          <span className="flex items-center gap-2">
            {analysis.generator === 'llm' ? <Sparkles strokeWidth={1.5} className="size-4 text-text-2" /> : null}
            <span className="label">{analysis.generator === 'llm' ? 'Resumen del entrenador IA' : 'Resumen por reglas'}</span>
          </span>
          <p className="leading-relaxed">{analysis.summary}</p>
          {analysis.aiMessage ? <p className="text-sm text-text-3">{analysis.aiMessage}</p> : null}
        </Card>

        <section className="flex flex-col gap-3" aria-labelledby="proposals">
          <h2 id="proposals" className="text-2xl">
            Ajustes propuestos
          </h2>
          <p className="text-sm text-text-2">Acepta, edita o rechaza cada uno. Nada cambia hasta que confirmes.</p>
          <ul className="flex flex-col gap-3">
            {analysis.proposals.map((p, i) => {
              const d = decisions[i] ?? { accept: false, setsDelta: null, kcalDelta: null };
              const set = (patch: Partial<Decision>) => setDecisions((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <li key={`${p.kind}-${i}`} className={cn('flex flex-col gap-3 rounded-card border p-4', d.accept ? 'border-text' : 'border-border')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Chip>{ADJUSTMENT_KIND_LABELS_ES[p.kind]}</Chip>
                      <p>{p.description}</p>
                      {p.kind === 'swap_exercise' && p.fromName && p.toName ? (
                        <p className="text-sm text-text-3">
                          {p.fromName} → {p.toName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {p.kind === 'volume' && d.accept ? (
                    <Field>
                      <Label>Series por ejercicio</Label>
                      <Stepper value={d.setsDelta ?? 0} onChange={(v) => set({ setsDelta: v })} min={-4} max={4} label="Cambio de series" />
                    </Field>
                  ) : null}
                  {p.kind === 'calories' && d.accept ? (
                    <Field>
                      <Label>Cambio diario</Label>
                      <Stepper value={d.kcalDelta ?? 0} onChange={(v) => set({ kcalDelta: v })} step={50} min={-300} max={300} unit=" kcal" label="Cambio de calorías" />
                    </Field>
                  ) : null}
                  {p.kind !== 'keep' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={d.accept ? 'primary' : 'secondary'} size="sm" onClick={() => set({ accept: true })} aria-pressed={d.accept}>
                        <Check strokeWidth={1.5} /> Aceptar
                      </Button>
                      <Button variant={!d.accept ? 'primary' : 'secondary'} size="sm" onClick={() => set({ accept: false })} aria-pressed={!d.accept}>
                        <X strokeWidth={1.5} /> Rechazar
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
        <FieldError>{error}</FieldError>
        <Button onClick={submitDecision} disabled={pending} size="lg" block>
          {pending ? 'Guardando…' : 'Confirmar decisión'}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submitAnswers} className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6">
        <Field>
          <Label htmlFor="c-weight">Peso de hoy (kg)</Label>
          <Input
            id="c-weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={lastWeight !== null ? `Último: ${lastWeight.toLocaleString('es-MX')}` : undefined}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <FieldHint>
            {weightAvg7d !== null ? `Promedio de los últimos 7 días: ${weightAvg7d.toLocaleString('es-MX')} kg. ` : ''}
            Opcional: nunca decidimos con un solo pesaje, usamos la tendencia.
          </FieldHint>
        </Field>
        <Scale label="Energía en la semana" value={energy} onChange={setEnergy} low="Muy baja" high="Excelente" />
        <Scale label="Calidad de sueño" value={sleep} onChange={setSleep} low="Muy mala" high="Excelente" />
        <Scale label="Esfuerzo percibido" value={effort} onChange={setEffort} low="Muy fácil" high="Al límite" />
        {type === 'full' ? <Scale label="¿Qué tan bien te funciona el plan?" value={planRating} onChange={setPlanRating} low="Nada" high="Muy bien" /> : null}
        {trigger === 'pain' ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-2">¿Sigue el dolor?</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={painPersists === true ? 'primary' : 'secondary'} onClick={() => setPainPersists(true)} aria-pressed={painPersists === true}>
                Sí, sigue
              </Button>
              <Button variant={painPersists === false ? 'primary' : 'secondary'} onClick={() => setPainPersists(false)} aria-pressed={painPersists === false}>
                Ya no
              </Button>
            </div>
            <FieldHint>Si el dolor es agudo, punzante o no mejora con descanso, consulta a un profesional de la salud.</FieldHint>
          </fieldset>
        ) : null}
        {trigger === 'missed_sessions' ? (
          <Field>
            <Label htmlFor="c-missed">¿Qué pasó esta semana?</Label>
            <Select id="c-missed" value={missedReason} onChange={(e) => setMissedReason(e.target.value as MissedReason | '')}>
              <option value="">Elige una opción</option>
              {(Object.keys(MISSED_REASON_LABELS_ES) as MissedReason[]).map((k) => (
                <option key={k} value={k}>
                  {MISSED_REASON_LABELS_ES[k]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </Card>

      {type === 'full' ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl">Medidas (opcional)</h2>
          <div className="grid grid-cols-2 gap-4">
            {CM_FIELDS.filter((f) => f.key !== 'hipCm' || sex !== 'male').map((f) => (
              <Field key={f.key}>
                <Label htmlFor={`c-${f.key}`}>{f.label} (cm)</Label>
                <Input id={`c-${f.key}`} type="number" inputMode="decimal" step="0.1" value={cm[f.key]} onChange={(e) => setCm((v) => ({ ...v, [f.key]: e.target.value }))} />
              </Field>
            ))}
          </div>
          <Link href="/progreso/fotos" className="text-sm text-text-2 underline underline-offset-4">
            Tomar fotos de progreso (opcional)
          </Link>
        </Card>
      ) : null}

      <Field>
        <Label htmlFor="c-notes">Notas para tu entrenador</Label>
        <Textarea id="c-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Lo que quieras contar de la semana" />
      </Field>
      <FieldError>{error}</FieldError>
      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? 'Analizando…' : 'Analizar revisión'}
      </Button>
    </form>
  );
}
