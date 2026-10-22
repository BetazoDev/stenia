/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import { NetworkFirst, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Una sola entrada para cualquier sesión (/entrenar?s=…): la sesión en vivo abre sin conexión.
    {
      matcher: ({ request, url }) => request.mode === 'navigate' && url.pathname === '/entrenar',
      handler: new NetworkFirst({ cacheName: 'stenia-entrenar', matchOptions: { ignoreSearch: true }, networkTimeoutSeconds: 4 }),
    },
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/sessions/bootstrap'),
      handler: new NetworkFirst({ cacheName: 'stenia-bootstrap', networkTimeoutSeconds: 4 }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/sin-conexion',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

type PushData = { title?: string; body?: string; tag?: string; url?: string };

self.addEventListener('push', (event) => {
  const data = (event.data?.json() ?? {}) as PushData;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Si la app está a la vista, el aviso de descanso ya sonó en la página.
      if (data.tag === 'rest' && windows.some((w) => w.visibilityState === 'visible')) return;
      await self.registration.showNotification(data.title ?? 'Stenia', {
        body: data.body ?? '',
        tag: data.tag ?? 'stenia',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        data: { url: data.url ?? '/hoy' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/hoy';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((w) => new URL(w.url).pathname.startsWith(url.split('?')[0] ?? url));
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

serwist.addEventListeners();
