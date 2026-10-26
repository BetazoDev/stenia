import { requireApiUser } from '@/lib/api';
import { ndjsonResponse } from '@/lib/ndjson';
import { generateMealPlan, type PlanEvent } from '@/lib/nutrition';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Genera el plan semanal y transmite el avance como NDJSON (sigue aunque el cliente se desconecte). */
export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  return ndjsonResponse<PlanEvent>(
    async (send) => {
      await generateMealPlan(user.id, send);
    },
    (error) => ({
      stage: 'error',
      message: error instanceof Error ? error.message : 'No se pudo generar el plan.',
    }),
  );
}
