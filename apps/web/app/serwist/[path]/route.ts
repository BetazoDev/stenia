import { spawnSync } from 'node:child_process';

import { createSerwistRoute } from '@serwist/turbopack';

// Revisión para versionar las páginas precacheadas (en Docker no hay .git: se usa un UUID).
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() || crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: '/sin-conexion', revision }],
  swSrc: 'sw/sw.ts',
  useNativeEsbuild: true,
});
