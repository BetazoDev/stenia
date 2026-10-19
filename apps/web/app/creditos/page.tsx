import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Créditos' };

const SOURCES = [
  {
    name: 'RepDB',
    url: 'https://repdb.co',
    note: 'Exercise data by RepDB (repdb.co). Ilustraciones y textos en español de 643 ejercicios.',
  },
  {
    name: 'free-exercise-db',
    url: 'https://github.com/yuhonas/free-exercise-db',
    note: 'Más de 800 ejercicios con imágenes de inicio y fin. Dominio público (Unlicense).',
  },
  {
    name: 'Martjn/calisthenics_exercises',
    url: 'https://huggingface.co/datasets/Martjn/calisthenics_exercises',
    note: '170 ejercicios de calistenia con progresiones. Apache-2.0; cada imagen enlazada conserva su licencia.',
  },
  {
    name: 'wger',
    url: 'https://github.com/wger-project/wger',
    note: 'Imágenes de respaldo con licencia CC-BY-SA.',
  },
  {
    name: 'USDA FoodData Central',
    url: 'https://fdc.nal.usda.gov',
    note: 'Valores nutrimentales de SR Legacy (2018) y Foundation Foods (2026). Dominio público (CC0). Nombres en español: glosario propio y revisión.',
  },
  {
    name: 'Open Food Facts',
    url: 'https://world.openfoodfacts.org',
    note: 'Productos por código de barras. Open Database License (ODbL); © colaboradores de Open Food Facts. Estos datos se guardan y exportan por separado.',
  },
  {
    name: 'MediaPipe',
    url: 'https://ai.google.dev/edge/mediapipe',
    note: 'Detección de pose en el dispositivo para fotos guiadas y conteo de repeticiones (Apache-2.0).',
  },
  {
    name: 'Fontshare',
    url: 'https://www.fontshare.com',
    note: 'Tipografías Clash Grotesk y Switzer.',
  },
  {
    name: 'Lucide',
    url: 'https://lucide.dev',
    note: 'Iconos (licencia ISC).',
  },
];

export default function CreditsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <Link href="/login" className="label">
          ← Stenia
        </Link>
        <h1 className="text-4xl md:text-5xl">Créditos</h1>
        <p className="text-text-2">Fuentes de datos, imágenes y tipografías que usa la app, con su licencia.</p>
      </header>
      <ul className="flex flex-col divide-y divide-border">
        {SOURCES.map((source) => (
          <li key={source.name} className="flex flex-col gap-1 py-4">
            <a href={source.url} className="text-lg underline-offset-4 hover:underline" rel="noreferrer" target="_blank">
              {source.name}
            </a>
            <p className="text-sm text-text-2">{source.note}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
