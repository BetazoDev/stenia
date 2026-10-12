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
    icons: [
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
