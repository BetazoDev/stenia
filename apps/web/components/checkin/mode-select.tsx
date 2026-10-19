'use client';

import { CHECKIN_MODE_LABELS_ES, type CheckinMode } from '@stenia/core';
import { useTransition } from 'react';

import { setCheckinModeAction } from '@/app/(app)/revision/actions';
import { Select } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';

export function CheckinModeSelect({ mode }: { mode: CheckinMode }) {
  const [pending, start] = useTransition();
  return (
    <Field>
      <Label htmlFor="checkin-mode">Frecuencia</Label>
      <Select id="checkin-mode" defaultValue={mode} disabled={pending} onChange={(e) => start(() => setCheckinModeAction(e.target.value as CheckinMode))}>
        {(Object.keys(CHECKIN_MODE_LABELS_ES) as CheckinMode[]).map((m) => (
          <option key={m} value={m}>
            {CHECKIN_MODE_LABELS_ES[m]}
          </option>
        ))}
      </Select>
      <FieldHint>Automática: ligera cada semana y completa cada 4 semanas. Las revisiones adelantadas se abren solas ante estancamiento, dolor, sesiones perdidas, fatiga o peso fuera de tendencia.</FieldHint>
    </Field>
  );
}
