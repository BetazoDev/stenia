import { and, eq, inArray } from 'drizzle-orm';
import {
  bodyMeasurement,
  bodyPhoto,
  checkin,
  food,
  foodFavorite,
  mealPlan,
  savedMeal,
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

  const [profiles, screenings, injuries, gyms, routines, sessions, records, measurements, checkins, targets, meals, plans, favorites, saved, photos, customFoods] =
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
      db.select().from(mealPlan).where(eq(mealPlan.userId, userId)),
      db.select().from(foodFavorite).where(eq(foodFavorite.userId, userId)),
      db.select().from(savedMeal).where(eq(savedMeal.userId, userId)),
      db
        .select({ id: bodyPhoto.id, takenAt: bodyPhoto.takenAt, pose: bodyPhoto.pose, storageDriver: bodyPhoto.storageDriver, sizeBytes: bodyPhoto.sizeBytes })
        .from(bodyPhoto)
        .where(eq(bodyPhoto.userId, userId)),
      db.select().from(food).where(and(eq(food.userId, userId), eq(food.source, 'custom'))),
    ]);
  // Productos de Open Food Facts usados por la persona: van aparte por su licencia (ODbL), sin mezclarse.
  const offIds = [...new Set(meals.map((m) => m.foodId))];
  const offProducts = offIds.length
    ? await db
        .select({ id: food.id, barcode: food.barcode, name: food.nameEs, brand: food.brand, kcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG, url: food.attributionUrl })
        .from(food)
        .where(and(eq(food.source, 'off'), inArray(food.id, offIds)))
    : [];

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
    mealPlans: plans,
    foodFavorites: favorites,
    savedMeals: saved,
    customFoods,
    bodyPhotos: { note: 'Solo metadatos; las imágenes se descargan desde Progreso › Fotos.', items: photos },
    openFoodFacts: {
      license: 'Open Database License (ODbL) · © colaboradores de Open Food Facts · https://world.openfoodfacts.org',
      products: offProducts,
    },
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="stenia-datos-${date}.json"`,
    },
  });
}
