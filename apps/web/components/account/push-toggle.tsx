'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

type State = 'loading' | 'unsupported' | 'denied' | 'off' | 'on';

/** Notificaciones Web Push: fin de descanso en segundo plano y recordatorios de revisión. */
export function PushToggle() {
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState('unsupported');
        return;
      }
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    })();
  }, []);

  const enable = async () => {
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = (await (await fetch('/api/push/vapid')).json()) as { publicKey: string };
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const json = sub.toJSON();
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
      setState('on');
    } catch {
      setMessage('No se pudo activar. En iPhone, primero instala Stenia en la pantalla de inicio.');
    }
  };

  const disable = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState('off');
  };

  const test = async () => {
    const res = await fetch('/api/push/test', { method: 'POST' });
    setMessage(res.ok ? 'Notificación de prueba enviada.' : 'No hay dispositivos suscritos.');
  };

  if (state === 'loading') return <p className="text-sm text-text-3">Comprobando…</p>;
  if (state === 'unsupported') return <p className="text-sm text-text-3">Este navegador no admite notificaciones push (o la app aún no está instalada).</p>;
  if (state === 'denied') return <p className="text-sm text-text-3">Bloqueaste las notificaciones; actívalas desde los ajustes del navegador.</p>;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {state === 'on' ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => void test()}>
              Probar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void disable()}>
              Desactivar
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => void enable()}>
            Activar notificaciones
          </Button>
        )}
      </div>
      {message ? <p className="text-sm text-text-2">{message}</p> : null}
    </div>
  );
}
