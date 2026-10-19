'use client';

import {
  BLOCK_LABELS_ES,
  INTENSITY_CAP_LABELS_ES,
  evaluateScreening,
  missingRequiredBlocks,
  REQUIRED_BLOCKS,
  type BlockKey,
  type Questionnaire,
  type ScreeningResult,
} from '@stenia/core';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { FieldError } from '@/components/ui/label';
import { Option } from '@/components/ui/option';
import { ProgressBar } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { createPresetGymAction, finishOnboardingAction, recordScreeningAction, saveBlockAction } from './actions';
import { getPath, isAnswered, setPath, visibleSteps, WEEKDAYS, type Draft, type Step } from './steps';

type Props = {
  initial: Questionnaire;
  hasGym: boolean;
  gymNames: string[];
  /** Paso donde retomar (el servidor lo calcula a partir de los bloques ya guardados). */
  startIndex: number;
};

const PRESETS = [
  { value: 'gym', label: 'Gimnasio completo', description: 'Máquinas, peso libre, barras y paralelas.' },
  { value: 'home', label: 'Casa', description: 'Mancuernas, banco, bandas y barra de puerta.' },
  { value: 'park', label: 'Parque de calistenia', description: 'Barras, paralelas, suelo y espacio para saltos.' },
] as const;

export function OnboardingWizard({ initial, hasGym: initialHasGym, gymNames, startIndex }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial as Draft);
  const steps = useMemo(() => visibleSteps(draft), [draft]);
  const [index, setIndex] = useState(startIndex);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [hasGym, setHasGym] = useState(initialHasGym);
  const [screening, setScreening] = useState<ScreeningResult | null>(null);

  const onSummary = index >= steps.length;
  const step = steps[index];
  const total = steps.length;

  const update = (path: string[], value: unknown) => setDraft((d) => setPath(d, path, value));

  /** Al salir del último paso de un bloque se guarda el bloque en el servidor (validado con zod). */
  const advance = (fromDraft: Draft = draft) => {
    setError(null);
    const current = steps[index];
    if (!current) return;
    const nextStep = visibleSteps(fromDraft)[index + 1];
    const leavingBlock = current.block !== 'gym' && (!nextStep || nextStep.block !== current.block || nextStep.kind === 'screening');
    startTransition(async () => {
      if (leavingBlock && current.kind !== 'screening') {
        const block = current.block as BlockKey;
        const value = (fromDraft[block] ?? {}) as Record<string, unknown>;
        const result = await saveBlockAction(block, value);
        if (!result.ok) {
          setError(result.message);
          return;
        }
      }
      if (nextStep?.kind === 'screening') {
        const safety = fromDraft.safety as Questionnaire['safety'];
        try {
          setScreening(safety ? evaluateScreening(safety) : null);
        } catch {
          setScreening(null);
        }
      }
      setIndex((i) => i + 1);
    });
  };

  const choose = (path: string[], value: unknown, autoAdvance: boolean) => {
    const next = setPath(draft, path, value);
    setDraft(next);
    if (autoAdvance) advance(next);
  };

  const back = () => {
    setError(null);
    setIndex((i) => Math.max(0, i - 1));
  };

  const decideScreening = (decision: 'accepted' | 'declined' | null) => {
    startTransition(async () => {
      const result = await recordScreeningAction(decision);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIndex((i) => i + 1);
    });
  };

  const pickPreset = (preset: 'gym' | 'home' | 'park') => {
    startTransition(async () => {
      const result = await createPresetGymAction(preset);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setHasGym(true);
      setIndex((i) => i + 1);
    });
  };

  const missing = missingRequiredBlocks(draft as Questionnaire);

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const result = await finishOnboardingAction();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push('/rutina/generar');
    });
  };

  const jumpToBlock = (block: BlockKey | 'gym') => {
    const i = steps.findIndex((s) => s.block === block);
    if (i >= 0) setIndex(i);
  };

  if (onSummary) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <span className="label">Resumen</span>
          <h1 className="text-4xl">Revisa antes de generar</h1>
          <p className="text-text-2">Puedes editar cualquier bloque. Los obligatorios son seguridad, datos corporales, objetivo y logística.</p>
        </header>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
          {(Object.keys(BLOCK_LABELS_ES) as BlockKey[]).map((block, i) => {
            const required = (REQUIRED_BLOCKS as readonly string[]).includes(block);
            const done = !missing.includes(block) && draft[block] !== undefined;
            return (
              <li key={block} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="label w-6 tnum">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p>{BLOCK_LABELS_ES[block]}</p>
                    <p className={cn('text-sm', done ? 'text-text-3' : required ? 'text-down' : 'text-text-3')}>
                      {done ? 'Contestado' : required ? 'Obligatorio · pendiente' : 'Opcional · sin contestar'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => jumpToBlock(block)}>
                  Editar
                </Button>
              </li>
            );
          })}
          <li className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="label w-6 tnum">09</span>
              <div>
                <p>Equipamiento</p>
                <p className={cn('text-sm', hasGym ? 'text-text-3' : 'text-down')}>{hasGym ? gymNames.join(', ') || 'Configurado' : 'Obligatorio · pendiente'}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => jumpToBlock('gym')}>
              Editar
            </Button>
          </li>
        </ul>
        <FieldError>{error}</FieldError>
        <Button size="lg" block disabled={pending || missing.length > 0 || !hasGym} onClick={finish}>
          {pending ? 'Guardando…' : 'Generar mi rutina'}
        </Button>
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="label">{step.block === 'gym' ? 'Equipamiento' : BLOCK_LABELS_ES[step.block]}</span>
          <span className="label tnum">
            {index + 1} / {total}
          </span>
        </div>
        <ProgressBar value={index + 1} max={total + 1} label="Avance del cuestionario" />
      </div>

      <div key={step.id} className="flex flex-1 flex-col gap-6 motion-safe:animate-[fade-in_200ms_ease-out]">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl leading-tight md:text-4xl">{step.title}</h1>
          {step.hint ? <p className="text-text-2">{step.hint}</p> : null}
        </div>
        <StepInput
          step={step}
          draft={draft}
          screening={screening}
          hasGym={hasGym}
          gymNames={gymNames}
          pending={pending}
          onChange={update}
          onChoose={choose}
          onDecide={decideScreening}
          onPreset={pickPreset}
          onKeepGym={() => setIndex((i) => i + 1)}
        />
        <FieldError>{error}</FieldError>
      </div>

      <div className="sticky bottom-20 flex items-center gap-3 bg-bg py-3 md:bottom-0">
        <Button variant="ghost" onClick={back} disabled={index === 0 || pending} aria-label="Pregunta anterior">
          <ArrowLeft strokeWidth={1.5} /> Atrás
        </Button>
        <div className="flex-1" />
        {step.optional && step.kind !== 'screening' && step.kind !== 'gym' ? (
          <Button variant="secondary" disabled={pending} onClick={() => advance()}>
            Saltar
          </Button>
        ) : null}
        {step.kind !== 'yesno' && step.kind !== 'screening' && step.kind !== 'gym' ? (
          <Button disabled={pending || (!step.optional && !isAnswered(step, draft))} onClick={() => advance()}>
            {pending ? 'Guardando…' : 'Siguiente'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type StepInputProps = {
  step: Step;
  draft: Draft;
  screening: ScreeningResult | null;
  hasGym: boolean;
  gymNames: string[];
  pending: boolean;
  onChange: (path: string[], value: unknown) => void;
  onChoose: (path: string[], value: unknown, autoAdvance: boolean) => void;
  onDecide: (decision: 'accepted' | 'declined' | null) => void;
  onPreset: (preset: 'gym' | 'home' | 'park') => void;
  onKeepGym: () => void;
};

function StepInput({ step, draft, screening, hasGym, gymNames, pending, onChange, onChoose, onDecide, onPreset, onKeepGym }: StepInputProps) {
  const path = step.path ?? [];
  const value = step.path ? getPath(draft, step.path) : undefined;

  switch (step.kind) {
    case 'yesno':
      return (
        <div className="grid grid-cols-2 gap-3" role="radiogroup">
          {[
            { v: true, label: 'Sí' },
            { v: false, label: 'No' },
          ].map(({ v, label }) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={value === v}
              disabled={pending}
              onClick={() => onChoose(path, v, true)}
              className={cn(
                'h-24 rounded-card border font-display text-3xl tracking-display transition-colors',
                value === v ? 'border-text bg-card-hover' : 'border-border bg-card hover:bg-card-hover',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-col gap-2" role="radiogroup">
          {step.options?.map((o) => (
            <Option key={String(o.value)} selected={value === o.value} label={o.label} description={o.description} onSelect={() => onChoose(path, o.value, false)} />
          ))}
        </div>
      );
    case 'multiselect': {
      const list = Array.isArray(value) ? (value as (string | number)[]) : [];
      return (
        <div className="flex flex-col gap-2">
          {step.options?.map((o) => (
            <Option
              key={String(o.value)}
              multi
              selected={list.includes(o.value)}
              label={o.label}
              description={o.description}
              onSelect={() => onChange(path, list.includes(o.value) ? list.filter((x) => x !== o.value) : [...list, o.value])}
            />
          ))}
          {list.length === 0 ? (
            <Button variant="ghost" className="self-start" onClick={() => onChange(path, [])}>
              Ninguna
            </Button>
          ) : null}
        </div>
      );
    }
    case 'weekdays': {
      const list = Array.isArray(value) ? (value as number[]) : [];
      return (
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              aria-pressed={list.includes(d.value)}
              onClick={() => onChange(path, list.includes(d.value) ? list.filter((x) => x !== d.value) : [...list, d.value])}
              className={cn('h-14 rounded-input border font-display text-xl', list.includes(d.value) ? 'border-text bg-card-hover' : 'border-border bg-card')}
            >
              {d.label}
            </button>
          ))}
        </div>
      );
    }
    case 'number':
      return (
        <label className="flex items-baseline gap-3">
          <Input
            type="number"
            inputMode="decimal"
            autoFocus
            min={step.min}
            max={step.max}
            step={step.step}
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(path, e.target.value === '' ? null : Number(e.target.value))}
            className="h-16 max-w-48 font-display text-4xl tracking-display"
            aria-label={step.title}
          />
          {step.unit ? <span className="text-xl text-text-3">{step.unit}</span> : null}
        </label>
      );
    case 'slider': {
      const v = typeof value === 'number' ? value : 50;
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between font-display tracking-display">
            <span className="text-2xl">{100 - v}% calistenia</span>
            <span className="text-2xl">{v}% gimnasio</span>
          </div>
          <input
            type="range"
            min={step.min}
            max={step.max}
            step={step.step}
            value={v}
            onChange={(e) => onChange(path, Number(e.target.value))}
            className="h-11 w-full accent-white"
            aria-label={step.title}
          />
          {typeof value !== 'number' ? (
            <Button variant="secondary" className="self-start" onClick={() => onChange(path, 50)}>
              Mitad y mitad
            </Button>
          ) : null}
        </div>
      );
    }
    case 'date':
      return (
        <Input
          type="date"
          value={typeof value === 'string' ? value : ''}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChange(path, e.target.value || null)}
          className="h-16 max-w-64 text-2xl"
          aria-label={step.title}
        />
      );
    case 'text':
      return <Textarea value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(path, e.target.value)} aria-label={step.title} maxLength={400} />;
    case 'screening': {
      if (!screening) {
        return <p className="text-text-2">Contesta las preguntas de seguridad para ver el resultado.</p>;
      }
      if (!screening.clearanceRecommended && !screening.needsFollowUp) {
        return (
          <Card className="flex flex-col gap-4">
            <p className="text-lg">Sin banderas de salud. Intensidad permitida: {INTENSITY_CAP_LABELS_ES[screening.intensityCap].toLowerCase()}.</p>
            {screening.reasons.map((r) => (
              <p key={r} className="text-text-2">
                {r}
              </p>
            ))}
            <Button disabled={pending} onClick={() => onDecide('accepted')}>
              Continuar
            </Button>
          </Card>
        );
      }
      return (
        <Card className="flex flex-col gap-4 border-down/40">
          <div className="flex items-center gap-3 text-down">
            <ShieldAlert strokeWidth={1.5} className="size-6" />
            <p className="font-display text-2xl tracking-display">
              {screening.clearanceRecommended ? 'Te recomendamos una valoración médica' : 'Empezamos con precaución'}
            </p>
          </div>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-text-2">
            {screening.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="text-text-2">
            Mientras tanto, tu rutina quedará limitada a intensidad {INTENSITY_CAP_LABELS_ES[screening.intensityCap].toLowerCase()}. Stenia no es un dispositivo médico.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button disabled={pending} onClick={() => onDecide('accepted')}>
              Entendido, consultaré a un médico
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => onDecide('declined')}>
              Continuar sin valoración
            </Button>
          </div>
        </Card>
      );
    }
    case 'gym':
      return (
        <div className="flex flex-col gap-3">
          {hasGym ? (
            <Card className="flex flex-col gap-3">
              <p>Ya tienes un perfil de equipamiento: {gymNames.join(', ') || 'configurado'}.</p>
              <Button disabled={pending} onClick={onKeepGym}>
                Usar este perfil
              </Button>
            </Card>
          ) : null}
          {PRESETS.map((p) => (
            <Option key={p.value} selected={false} label={p.label} description={p.description} onSelect={() => onPreset(p.value)} />
          ))}
        </div>
      );
    default:
      return null;
  }
}
