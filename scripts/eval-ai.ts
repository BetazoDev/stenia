#!/usr/bin/env bun
/**
 * Evalúa modelos con los prompts reales de Stenia antes de elegir proveedor (docs/decisions.md).
 * Corre rutina, plan de comidas, revisión y traducción, y aplica los mismos validadores que la app.
 *
 * Uso (las claves van por entorno, nunca por argumento):
 *   EVAL_PROVIDER=openai_compatible EVAL_BASE_URL=https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1 \
 *   EVAL_API_KEY=… bun run scripts/eval-ai.ts --models=@cf/openai/gpt-oss-120b,@cf/google/gemma-4-26b-a4b-it
 *
 *   Suscripción de Claude: EVAL_PROVIDER=claude_code bun run scripts/eval-ai.ts --models=claude-sonnet-5-5
 *
 * Opciones: --tasks=routine,meal,checkin,translate  --json-schema (envía response_format json_schema)
 *           --header=nombre:valor (repetible)  --max-tokens=6000
 */
import { parseArgs } from 'node:util';

import {
  AliasMealPlan,
  AliasRoutinePlan,
  AiProvider,
  CheckinAnalysis,
  Translations,
  checkinPrompt,
  generateStructured,
  mealPlanPrompt,
  routinePrompt,
  translationPrompt,
  type ModelConfig,
} from '@stenia/ai';
import { loadCatalogExercises } from '@stenia/catalog';
import {
  DAY_SLOTS,
  MUSCLE_LABELS_ES,
  dayNames,
  filterCatalog,
  rankForSlot,
  scaleDay,
  slotsForDay,
  splitFor,
  validateRoutinePlan,
  type CatalogExercise,
  type FoodGroup,
  type GenerationContext,
  type Macros,
} from '@stenia/core';
import { food } from '@stenia/db';

import { openDb } from './lib/db';

const { values } = parseArgs({
  options: {
    models: { type: 'string' },
    tasks: { type: 'string', default: 'routine,meal,checkin,translate' },
    'json-schema': { type: 'boolean', default: false },
    header: { type: 'string', multiple: true, default: [] },
    'max-tokens': { type: 'string', default: '6000' },
  },
});

const provider = AiProvider.parse(process.env.EVAL_PROVIDER ?? 'openai_compatible');
// Con la suscripción de Claude la key es opcional: token de `claude setup-token` o login local.
const apiKey = provider === 'claude_code' ? (process.env.CLAUDE_CODE_OAUTH_TOKEN ?? '') : (process.env.EVAL_API_KEY ?? '');
if ((!apiKey && provider !== 'claude_code') || !values.models) {
  console.error('Falta EVAL_API_KEY en el entorno o --models=…');
  process.exit(1);
}
const headers = Object.fromEntries((values.header ?? []).map((h) => [h.slice(0, h.indexOf(':')).trim(), h.slice(h.indexOf(':') + 1).trim()]));
const tasks = new Set((values.tasks ?? '').split(','));
const params = { temperature: 0.2, maxTokens: Number(values['max-tokens']), timeoutMs: 180_000 };

const GYM = ['leg_press', 'hack_squat', 'leg_extension', 'leg_curl', 'cable_high', 'cable_low', 'lat_pulldown', 'seated_row', 'chest_press_machine', 'pec_deck', 'smith_machine', 'calf_machine', 'dumbbells', 'barbell', 'ez_bar', 'plates', 'bench_flat', 'bench_incline', 'rack', 'pull_up_bar', 'parallel_bars', 'dip_station', 'bands', 'floor_space'];

type Row = { model: string; task: string; ok: boolean; ms: number; inTok: number; outTok: number; note: string };
const rows: Row[] = [];

const { db, pool } = openDb();
try {
  const catalog = await loadCatalogExercises(db);
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const staples = (await db.select().from(food)).filter((f) => f.tags.includes('staple'));

  for (const modelId of values.models.split(',').map((m) => m.trim()).filter(Boolean)) {
    const model: ModelConfig = {
      provider,
      apiKey,
      modelId,
      baseUrl: process.env.EVAL_BASE_URL,
      structuredOutputs: values['json-schema'],
      ...(Object.keys(headers).length ? { headers } : {}),
    };

    if (tasks.has('routine')) {
      const ctx: GenerationContext = { goal: 'hypertrophy', level: 'intermediate', daysPerWeek: 4, minutesPerSession: 60, gymRatio: 60, skillGoals: [], intensityCap: 'vigorous', injuryZones: [], painfulMovements: '', banned: [], favorites: [], availableEquipment: GYM };
      const candidates = filterCatalog(catalog, ctx);
      const split = splitFor(ctx.daysPerWeek, ctx.level, ctx.goal);
      const chosen = new Map<string, CatalogExercise>();
      for (const day of new Set(split.days)) for (const slot of slotsForDay(day, ctx.skillGoals)) for (const ex of rankForSlot(candidates, slot, ctx).slice(0, 10)) chosen.set(ex.id, ex);
      const list = [...chosen.values()];
      const codeToId = new Map(list.map((ex, i) => [`E${i + 1}`, ex.id]));
      const names = dayNames(split.days);
      const r = routinePrompt.render({
        profile: { age: 30, sex: 'male', heightCm: 178, weightKg: 80, level: 'Intermedio', goal: 'Ganar músculo (hipertrofia)', gymRatio: 60, skillGoals: [], intensityCap: 'vigorous', minRir: 1, trainingMonths: 24, marks: { flexiones: 30, dominadas: 8, pressKg: 70, sentadillaKg: 90 } },
        split: { label: split.label, days: split.days.map((d, i) => ({ name: names[i] ?? d, focus: DAY_SLOTS[d].map((s) => s.patterns.join('/')).join(', ') })) },
        minutesPerSession: 60,
        repRules: 'hipertrofia 6–12 en compuestos, 10–15 en accesorios; calistenia por umbral (5–12 repeticiones) o segundos',
        restRules: 'compuesto pesado 120–180 s; accesorio 60–90 s; isométrico de habilidad 120–180 s',
        volumeRules: '10–20 series semanales por grupo muscular, conservador al inicio',
        injuries: [],
        painfulMovements: '',
        favorites: '',
        banned: '',
        history: null,
        catalogLines: list.map((ex, i) => `E${i + 1} | ${ex.nameEs}${ex.nameEs !== ex.nameEn ? ` (${ex.nameEn})` : ''} | ${ex.pattern} | ${ex.primaryMuscles.map((m) => MUSCLE_LABELS_ES[m]).join(', ')} | ${ex.loadType} | ${ex.level}`),
        previousErrors: [],
      });
      const res = await generateStructured({ model, params, schema: AliasRoutinePlan, system: r.system, prompt: r.prompt });
      if (res.ok) {
        const plan = { rationale: res.output.rationale, days: res.output.days.map((d) => ({ name: d.name, exercises: d.exercises.map((e) => ({ ...e, exerciseId: codeToId.get(e.exerciseId.trim().toUpperCase()) ?? e.exerciseId })) })) };
        const v = validateRoutinePlan(plan, { ctx, catalogById: byId, allowedIds: new Set(list.map((e) => e.id)) });
        rows.push({ model: modelId, task: 'rutina', ok: v.ok, ms: res.latencyMs, inTok: res.usage.inputTokens, outTok: res.usage.outputTokens, note: v.ok ? `${plan.days.length} días; ${v.warnings.length} avisos` : v.errors.slice(0, 2).join(' | ') });
      } else rows.push({ model: modelId, task: 'rutina', ok: false, ms: res.latencyMs, inTok: res.usage.inputTokens, outTok: res.usage.outputTokens, note: res.message });
    }

    if (tasks.has('meal')) {
      const codeToId = new Map(staples.map((f, i) => [`F${i + 1}`, f.id]));
      const foods = new Map(staples.map((f) => [f.id, f]));
      const target = { kcal: 2400, proteinG: 150, carbsG: 280, fatG: 70 };
      const r = mealPlanPrompt.render({ targets: target, mealsPerDay: 4, days: 4, budget: 'medio', cooks: true, excluded: '', foodLines: staples.map((f, i) => `F${i + 1} | ${f.nameEs} | ${f.groupCode} | ${f.kcal} kcal, ${f.proteinG} P, ${f.carbsG} C, ${f.fatG} G por 100 g`) });
      const res = await generateStructured({ model, params, schema: AliasMealPlan, system: r.system, prompt: r.prompt });
      if (res.ok) {
        let unknown = 0;
        let worst = 0;
        for (const d of res.output.days) {
          const items = d.meals.flatMap((m) => m.items).map((i) => ({ ...i, foodId: codeToId.get(i.foodId) ?? '' })).filter((i) => {
            if (!foods.has(i.foodId)) unknown += 1;
            return foods.has(i.foodId);
          });
          const scaled = scaleDay(items.map((i) => { const f = foods.get(i.foodId)!; return { ...i, per100: { kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG } as Macros, group: f.groupCode as FoodGroup }; }), target);
          worst = Math.max(worst, Math.abs(scaled.kcalErrorPct));
        }
        const ok = unknown === 0 && worst <= 0.05;
        rows.push({ model: modelId, task: 'plan', ok, ms: res.latencyMs, inTok: res.usage.inputTokens, outTok: res.usage.outputTokens, note: `${res.output.days.length} días; ${unknown} códigos inválidos; peor desvío tras ajuste ${(worst * 100).toFixed(1)}%` });
      } else rows.push({ model: modelId, task: 'plan', ok: false, ms: res.latencyMs, inTok: res.usage.inputTokens, outTok: res.usage.outputTokens, note: res.message });
    }

    if (tasks.has('checkin')) {
      const r = checkinPrompt.render({
        type: 'full',
        trigger: null,
        goal: 'hypertrophy',
        metrics: { weight: { trend: 80.4, slopePctPerWeek: -0.6, weighIns14d: 9, expected: { min: 0.1, max: 0.5 } }, adherence: { avgPct: 0.92 }, sessions: { count14d: 8, avgEffort: 8.6 }, stagnant: ['E2'], records14d: 1 },
        answers: { energy: 2, sleep: 2, effort: 5, planRating: 4 },
        notes: 'Me siento cansado, dormí mal por trabajo.',
        rules: '- volume: muscle y setsDelta (−4 a +4). - deload: solo con fatiga. - swap_exercise: fromExercise E…, toExercise uno de sus S…. - calories: kcalDelta −300 a +300 si la tendencia salió del rango. - keep.',
        exerciseLines: ['E1 | Press de banca con barra | horizontal_push | sustitutos: S1.1 Press con mancuernas', 'E2 | Sentadilla con barra | squat | sustitutos: S2.1 Sentadilla hack; S2.2 Prensa de piernas'],
      });
      const res = await generateStructured({ model, params, schema: CheckinAnalysis, system: r.system, prompt: r.prompt });
      const kinds = res.ok ? res.output.adjustments.map((a) => a.kind) : [];
      const spanish = res.ok && /[áéíóúñ¿]|\b(el|la|de|que|semana)\b/i.test(res.output.summary);
      rows.push({ model: modelId, task: 'revisión', ok: res.ok && spanish && kinds.includes('deload'), ms: res.latencyMs, inTok: res.usage.inputTokens, outTok: res.usage.outputTokens, note: res.ok ? `ajustes: ${kinds.join(', ')}${spanish ? '' : ' (resumen no en español)'}` : res.message });
    }

    if (tasks.has('translate')) {
      const items = ['Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 'Beef, top sirloin, steak, separable lean only, trimmed to 1/8" fat, choice, cooked, broiled', 'Squash, summer, zucchini, includes skin, raw', 'Cereals ready-to-eat, granola, homemade', 'Standing Barbell Press Behind Neck', 'Side Plank with Top Leg Raised'].map((en, i) => ({ key: `k${i}`, en }));
      const r = translationPrompt.render({ kind: 'food', items });
      const res = await generateStructured({ model, params, schema: Translations, system: r.system, prompt: r.prompt });
      const got = res.ok ? res.output.items.filter((t) => items.some((i) => i.key === t.key)).length : 0;
      rows.push({ model: modelId, task: 'traducción', ok: res.ok && got === items.length, ms: res.latencyMs, inTok: res.usage.inputTokens, outTok: res.usage.outputTokens, note: res.ok ? res.output.items.map((t) => t.es).join(' · ').slice(0, 160) : res.message });
    }
  }
} finally {
  await pool.end();
}

for (const r of rows) {
  console.info(`${r.ok ? 'OK ' : 'NO '} ${r.model} · ${r.task} · ${(r.ms / 1000).toFixed(1)} s · ${r.inTok}/${r.outTok} tokens · ${r.note}`);
}
