'use client';

import type { WeightUnit } from '@stenia/core';
import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'stenia.weightUnit';
const EVENT = 'stenia:weight-unit';

/** Guarda la unidad en el dispositivo y avisa a los componentes que la usan. */
export function storeWeightUnit(unit: WeightUnit) {
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    // Sin almacenamiento local: se usa kg.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Copia la preferencia de la cuenta al dispositivo: la sesión en vivo funciona sin conexión y la lee de ahí. */
export function WeightUnitSync({ unit }: { unit: WeightUnit }) {
  useEffect(() => storeWeightUnit(unit), [unit]);
  return null;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readUnit(): WeightUnit {
  try {
    return localStorage.getItem(KEY) === 'lb' ? 'lb' : 'kg';
  } catch {
    return 'kg';
  }
}

/** Unidad de peso para componentes cliente (kg si no hay preferencia guardada en el dispositivo). */
export function useWeightUnit(): WeightUnit {
  return useSyncExternalStore(subscribe, readUnit, () => 'kg');
}
