import { requireApiUser } from '@/lib/api';
import { ndjsonResponse } from '@/lib/ndjson';
import { generateRoutine, GenerationError, type GenerationEvent } from '@/lib/routine';
import { latestActiveSession } from '@/lib/training-day';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Genera la rutina y transmite el avance como NDJSON ("Leyendo tu perfil → Eligiendo ejercicios → Validando").
 * Sigue aunque el cliente se desconecte.
 */
export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  return ndjsonResponse<GenerationEvent>(
    async (send) => {
      if (await latestActiveSession(user.id)) {
        throw new GenerationError(
          'Tienes una sesión sin terminar: termínala o descártala antes de generar otra rutina.',
        );
      }
      await generateRoutine(user.id, send);
    },
    (error) => ({
      stage: 'error',
      message:
        error instanceof GenerationError || error instanceof Error
          ? error.message
          : 'No se pudo generar la rutina.',
    }),
  );
}
