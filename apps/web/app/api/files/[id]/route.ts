import { NextResponse, type NextRequest } from 'next/server';

import { requireApiUser } from '@/lib/api';
import { getPhoto } from '@/lib/body';
import { readPrivateFromDb } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Sirve una foto privada guardada en la base, solo a su propietario. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) return response;
  const { id } = await params;
  const photo = await getPhoto(user.id, id);
  if (!photo || photo.storageDriver !== 'db') return NextResponse.json({ ok: false }, { status: 404 });
  const file = await readPrivateFromDb(user.id, photo.storageKey);
  if (!file) return NextResponse.json({ ok: false }, { status: 404 });
  return new NextResponse(Buffer.from(file.data), {
    headers: { 'content-type': file.contentType, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff' },
  });
}
