import { after, NextResponse, type NextRequest } from 'next/server';

import { requireApiUser } from '@/lib/api';
import { detectAndOpenEarlyCheckins } from '@/lib/checkins';
import { applySync, SyncPayload } from '@/lib/sync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const parsed = SyncPayload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Datos de sincronización inválidos', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const result = await applySync(user.id, parsed.data);
  if (Object.keys(result.summaries).length > 0) {
    // Tras cerrar una sesión: estancamiento, fatiga o sesiones perdidas abren una revisión adelantada.
    after(async () => {
      try {
        await detectAndOpenEarlyCheckins(user.id);
      } catch {
        // Los disparadores se reintentan en la tarea diaria.
      }
    });
  }
  return NextResponse.json(result);
}
