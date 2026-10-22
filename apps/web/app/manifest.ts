import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Stenia',
    short_name: 'Stenia',
    description: 'Rutinas de gimnasio y calistenia con IA, registro en vivo y nutrición.',
    lang: 'es-MX',
    start_url: '/hoy',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E0E0E',
    theme_color: '#0E0E0E',
    // PNG para instalar en Android (Chrome pide 192 y 512 px); el SVG queda para navegadores que lo prefieren.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
