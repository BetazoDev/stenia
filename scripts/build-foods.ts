#!/usr/bin/env bun
/**
 * Genera `packages/catalog/data/usda-foods.json` (versionado) a partir de USDA FoodData Central: SR Legacy y
 * Foundation Foods. Descarga los ZIP oficiales, los descomprime con `unzip` y aplica traducciones y básicos.
 *
 * Uso: bun run scripts/build-foods.ts [--cache=.cache/usda]
 */
import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { buildCompactFoods, type UsdaFood } from '@stenia/catalog';

const DATASETS = [
  { label: 'USDA FoodData Central · Foundation Foods 2026-04-30', url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip', key: 'FoundationFoods', preferred: true },
  { label: 'USDA FoodData Central · SR Legacy 2018-04', url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip', key: 'SRLegacyFoods', preferred: false },
] as const;

const { values } = parseArgs({ options: { cache: { type: 'string', default: '.cache/usda' } } });
const root = path.resolve(import.meta.dir, '..');
const cache = path.resolve(root, values.cache ?? '.cache/usda');
mkdirSync(cache, { recursive: true });

const sources: { label: string; foods: (UsdaFood | null)[]; preferred: boolean }[] = [];
for (const d of DATASETS) {
  const zip = path.join(cache, path.basename(d.url));
  if (!existsSync(zip)) {
    console.info(`Descargando ${d.url}`);
    const res = await fetch(d.url);
    if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${d.url}`);
    writeFileSync(zip, new Uint8Array(await res.arrayBuffer()));
  }
  const dir = path.join(cache, path.basename(d.url, '.zip'));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    const proc = Bun.spawnSync(['unzip', '-o', '-q', zip, '-d', dir]);
    if (proc.exitCode !== 0) throw new Error(`unzip falló para ${zip}`);
  }
  const file = readdirSync(dir).find((f) => f.endsWith('.json'));
  if (!file) throw new Error(`No hay JSON dentro de ${zip}`);
  const json = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Record<string, (UsdaFood | null)[]>;
  sources.push({ label: d.label, foods: json[d.key] ?? [], preferred: d.preferred });
  console.info(`${d.label}: ${(json[d.key] ?? []).length} registros`);
}

const compact = buildCompactFoods(sources);
const out = path.join(root, 'packages/catalog/data/usda-foods.json');
const body = compact.foods.map((f) => JSON.stringify(f)).join(',\n');
writeFileSync(out, `{"meta":${JSON.stringify(compact.meta)},"foods":[\n${body}\n]}\n`);
console.info(`Escribí ${compact.meta.count} alimentos en ${path.relative(root, out)}`);
