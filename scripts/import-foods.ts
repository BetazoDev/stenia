#!/usr/bin/env bun
/**
 * Importa los alimentos de USDA FoodData Central (archivo compacto versionado en
 * packages/catalog/data/usda-foods.json) a Postgres. Para regenerar ese archivo: scripts/build-foods.ts.
 * La tabla del INCMNSZ queda fuera hasta confirmar su licencia (docs/decisions.md).
 *
 * Uso: bun run scripts/import-foods.ts
 */
import { importUsdaFoods } from '@stenia/catalog';

import { openDb } from './lib/db';

const { db, pool } = openDb();
try {
  const started = Date.now();
  const result = await importUsdaFoods(db, {
    onProgress: (done, total) => {
      if (done === total || done % 2000 === 0) console.info(`Alimentos: ${done}/${total}`);
    },
  });
  console.info(`Listo: ${result.foods} alimentos en ${Math.round((Date.now() - started) / 1000)} s.`);
} finally {
  await pool.end();
}
