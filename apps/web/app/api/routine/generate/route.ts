import { requireApiUser } from '@/lib/api';
import { generateRoutine, GenerationError, type GenerationEvent } from '@/lib/routine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Genera la rutina y transmite el avance como NDJSON ("Leyendo tu perfil → Eligiendo ejercicios → Validando"). */
export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerationEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await generateRoutine(user.id, send);
      } catch (error) {
        const message = error instanceof GenerationError || error instanceof Error ? error.message : 'No se pudo generar la rutina.';
        send({ stage: 'error', message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
