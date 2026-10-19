'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { localDb } from '@/lib/local-db';
import type { SessionBootstrap } from '@/lib/session-data';
import { startBackgroundSync } from '@/lib/sync-client';

import { unlockAudio } from './device';
import { startSession } from './session-actions';

/** Guarda en IndexedDB los datos de todos los días de la rutina para poder empezar sin conexión. */
async function prefetchBootstraps(): Promise<void> {
  try {
    const res = await fetch('/api/sessions/bootstrap', { cache: 'no-store' });
    if (!res.ok) return;
    const data = (await res.json()) as { bootstraps: SessionBootstrap[] };
    const db = localDb();
    await db.bootstraps.bulkPut(data.bootstraps.map((b) => ({ dayId: b.dayId, data: b, savedAt: Date.now() })));
  } catch {
    // Sin conexión: se usa lo guardado.
  }
}

export function StartSessionButton({ dayId, dayName }: { dayId: string; dayName: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'starting' | 'error'>('idle');
  const active = useLiveQuery(() => localDb().sessions.where('status').equals('active').first(), []);

  useEffect(() => {
    startBackgroundSync();
    void prefetchBootstraps();
  }, []);

  if (active) {
    return (
      <Button size="lg" block onClick={() => router.push(`/entrenar?s=${active.id}`)}>
        <Play strokeWidth={1.5} /> Continuar sesión · {active.dayName}
      </Button>
    );
  }

  const start = async () => {
    unlockAudio();
    setState('starting');
    try {
      let bootstrap: SessionBootstrap | null = null;
      try {
        const res = await fetch(`/api/sessions/bootstrap?dayId=${encodeURIComponent(dayId)}`, { cache: 'no-store' });
        if (res.ok) bootstrap = ((await res.json()) as { bootstraps: SessionBootstrap[] }).bootstraps[0] ?? null;
        if (bootstrap) await localDb().bootstraps.put({ dayId, data: bootstrap, savedAt: Date.now() });
      } catch {
        bootstrap = null;
      }
      if (!bootstrap) bootstrap = (await localDb().bootstraps.get(dayId))?.data ?? null;
      if (!bootstrap) throw new Error('sin datos');
      const id = await startSession(bootstrap);
      router.push(`/entrenar?s=${id}`);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" block disabled={state === 'starting'} onClick={() => void start()}>
        <Play strokeWidth={1.5} /> {state === 'starting' ? 'Preparando…' : `Empezar entrenamiento · ${dayName}`}
      </Button>
      {state === 'error' ? <p role="alert" className="text-sm text-down">No se pudo preparar la sesión. Conéctate una vez para descargar tu rutina.</p> : null}
    </div>
  );
}
