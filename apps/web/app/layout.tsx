import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { SerwistProvider } from '@serwist/turbopack/react';

import { Providers } from '@/components/providers';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Stenia', template: '%s · Stenia' },
  description: 'Rutinas de gimnasio y calistenia con IA, registro en vivo, nutrición y seguimiento corporal.',
  applicationName: 'Stenia',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Stenia' },
  // iOS no acepta SVG en el ícono de inicio: PNG de 180 px sin esquinas (iOS las redondea).
  icons: { icon: '/icons/icon.svg', apple: { url: '/icons/apple-touch-icon.png', sizes: '180x180' } },
};

export const viewport: Viewport = {
  themeColor: '#0E0E0E',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const FONTSHARE_URL =
  'https://api.fontshare.com/v2/css?f[]=clash-grotesk@500&f[]=switzer@400,500,600&display=swap';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTSHARE_URL} />
      </head>
      <body className="bg-bg text-text">
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === 'development'} reloadOnOnline={false}>
          <Providers>{children}</Providers>
        </SerwistProvider>
      </body>
    </html>
  );
}
