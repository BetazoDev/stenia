import { requireApiUser } from '@/lib/api';
import { generateMealPlan, type PlanEvent } from '@/lib/nutrition';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Genera el plan semanal y transmite el avance como NDJSON. */
export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PlanEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await generateMealPlan(user.id, send);
      } catch (error) {
        send({ stage: 'error', message: error instanceof Error ? error.message : 'No se pudo generar el plan.' });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
