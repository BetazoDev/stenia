'use client';

import { ScanBarcode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldHint, Label } from '@/components/ui/label';

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

async function createDetector(): Promise<Detector> {
  const native = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  if (native) return new native({ formats: FORMATS });
  // Safari y Firefox: polyfill con zxing-wasm (carga perezosa).
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
}

/** Escáner de código de barras con la cámara trasera; siempre ofrece captura manual. */
export function BarcodeScanner({ onDetected, busy }: { onDetected: (code: string) => void; busy: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    handled.current = false;
    (async () => {
      try {
        const detector = await createDetector();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        let last = 0;
        const tick = async (t: number) => {
          if (stopped) return;
          if (t - last > 250 && videoRef.current && videoRef.current.readyState >= 2) {
            last = t;
            try {
              const codes = await detector.detect(videoRef.current);
              const code = codes[0]?.rawValue;
              if (code && !handled.current) {
                handled.current = true;
                navigator.vibrate?.(60);
                onDetected(code);
                setActive(false);
                return;
              }
            } catch {
              // Cuadro ilegible: se intenta con el siguiente.
            }
          }
          raf = requestAnimationFrame((n) => void tick(n));
        };
        raf = requestAnimationFrame((n) => void tick(n));
      } catch {
        setError('No se pudo abrir la cámara. Escribe el código a mano.');
        setActive(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, onDetected]);

  return (
    <div className="flex flex-col gap-4">
      {active ? (
        <div className="relative overflow-hidden rounded-card border border-border bg-black">
          <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-24 -translate-y-1/2 rounded-input border-2 border-white/70" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 flex justify-center p-3">
            <Button variant="secondary" size="sm" onClick={() => setActive(false)}>
              Detener
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setError(null);
            setActive(true);
          }}
          disabled={busy}
        >
          <ScanBarcode strokeWidth={1.5} /> Escanear con la cámara
        </Button>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onDetected(manual.trim());
        }}
      >
        <Field className="flex-1">
          <Label htmlFor="barcode-manual">Código de barras</Label>
          <Input id="barcode-manual" inputMode="numeric" pattern="[0-9]*" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="7501234567890" />
        </Field>
        <Button type="submit" variant="secondary" disabled={busy || manual.trim().length < 8}>
          Buscar
        </Button>
      </form>
      <FieldHint>Datos de productos: Open Food Facts (ODbL).</FieldHint>
      {error ? (
        <p role="alert" className="text-sm text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}
