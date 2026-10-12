import { eq } from 'drizzle-orm';
import {
  bodyMeasurement,
  checkin,
  gymProfile,
  injury,
  mealLog,
  nutritionTarget,
  personalRecord,
  profile,
  routine,
  screening,
  setLog,
  workoutSession,
} from '@stenia/db';
import { NextResponse, type NextRequest } from 'next/server';

import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    const text = value instanceof Date ? value.toISOString() : value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}

/** Exporta todos los datos del usuario (sección 16 del PRD): JSON completo o CSV de series. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = session.user.id;
  const db = getDb();
  const format = request.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const date = new Date().toISOString().slice(0, 10);

  const sets = await db.select().from(setLog).where(eq(setLog.userId, userId));
  if (format === 'csv') {
    return new NextResponse(toCsv(sets), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="stenia-series-${date}.csv"`,
      },
    });
  }

  const [profiles, screenings, injuries, gyms, routines, sessions, records, measurements, checkins, targets, meals] =
    await Promise.all([
      db.select().from(profile).where(eq(profile.userId, userId)),
      db.select().from(screening).where(eq(screening.userId, userId)),
      db.select().from(injury).where(eq(injury.userId, userId)),
      db.select().from(gymProfile).where(eq(gymProfile.userId, userId)),
      db.select().from(routine).where(eq(routine.userId, userId)),
      db.select().from(workoutSession).where(eq(workoutSession.userId, userId)),
      db.select().from(personalRecord).where(eq(personalRecord.userId, userId)),
      db.select().from(bodyMeasurement).where(eq(bodyMeasurement.userId, userId)),
      db.select().from(checkin).where(eq(checkin.userId, userId)),
      db.select().from(nutritionTarget).where(eq(nutritionTarget.userId, userId)),
      db.select().from(mealLog).where(eq(mealLog.userId, userId)),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { id: userId, name: session.user.name, email: session.user.email, createdAt: session.user.createdAt },
    profile: profiles[0] ?? null,
    screenings,
    injuries,
    gymProfiles: gyms,
    routines,
    sessions,
    sets,
    personalRecords: records,
    measurements,
    checkins,
    nutritionTargets: targets,
    mealLogs: meals,
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="stenia-datos-${date}.json"`,
    },
  });
}
