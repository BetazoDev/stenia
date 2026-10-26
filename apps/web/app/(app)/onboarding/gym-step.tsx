'use client';

import { useState, useTransition } from 'react';

import { EquipmentChecklist } from '@/components/equipment-checklist';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError } from '@/components/ui/label';
import { Option } from '@/components/ui/option';
import {
  PRESET_EQUIPMENT,
  PRESET_LABELS,
  type EquipmentItem,
  type GymPreset,
} from '@/lib/gym-presets';

import { saveGymProfileAction } from '../equipo/actions';

export type ActiveGym = { id: string; name: string; kind: GymPreset; equipment: string[] };

type Draft = { id?: string; name: string; kind: GymPreset; selected: Set<string> };

const PRESETS = Object.keys(PRESET_LABELS) as GymPreset[];

/**
 * Primer paso del cuestionario: dónde entrenas y con qué equipo. Se parte de un preajuste y se marca cada máquina
 * con su foto de referencia; al continuar se guarda como perfil activo.
 */
export function GymStep({
  catalog,
  activeGym,
  onDone,
}: {
  catalog: EquipmentItem[];
  activeGym: ActiveGym | null;
  onDone: (name: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (slug: string) =>
    setDraft((d) => {
      if (!d) return d;
      const selected = new Set(d.selected);
      if (selected.has(slug)) selected.delete(slug);
      else selected.add(slug);
      return { ...d, selected };
    });

  const save = () => {
    if (!draft) return;
    setError(null);
    if (draft.selected.size === 0) {
      setError(
        'Marca al menos un equipo (o «Espacio libre en el suelo» si entrenas sin aparatos).',
      );
      return;
    }
    start(async () => {
      const result = await saveGymProfileAction({
        id: draft.id,
        name: draft.name,
        kind: draft.kind,
        active: true,
        equipment: [...draft.selected].map((slug) => ({ slug })),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone(draft.name);
    });
  };

  if (!draft) {
    return (
      <div className="flex flex-col gap-3">
        {activeGym ? (
          <Card className="flex flex-col gap-3">
            <p>
              Ya tienes un perfil de equipamiento:{' '}
              <span className="text-text">{activeGym.name}</span> ({activeGym.equipment.length}{' '}
              equipos).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} onClick={() => onDone(activeGym.name)}>
                Usar este perfil
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setDraft({
                    id: activeGym.id,
                    name: activeGym.name,
                    kind: activeGym.kind,
                    selected: new Set(activeGym.equipment),
                  })
                }
              >
                Revisar el equipo
              </Button>
            </div>
          </Card>
        ) : null}
        {PRESETS.map((p) => (
          <Option
            key={p}
            selected={false}
            label={PRESET_LABELS[p].label}
            description={PRESET_LABELS[p].description}
            onSelect={() =>
              setDraft({
                name: PRESET_LABELS[p].label,
                kind: p,
                selected: new Set(PRESET_EQUIPMENT[p]),
              })
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-text-2">
        Marcamos lo típico de «{PRESET_LABELS[draft.kind].label}». Quita lo que no tengas y agrega
        lo que falte: la rutina solo usará este equipo.
      </p>
      <EquipmentChecklist catalog={catalog} selected={draft.selected} onToggle={toggle} />
      <div className="sticky bottom-20 z-10 flex flex-col gap-2 border-t border-border bg-bg py-3 md:bottom-0">
        <FieldError>{error}</FieldError>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setDraft(null)}>
            Cambiar
          </Button>
          <Button className="flex-1" disabled={pending} onClick={save}>
            {pending ? 'Guardando…' : `Continuar · ${draft.selected.size} equipos`}
          </Button>
        </div>
      </div>
    </div>
  );
}
