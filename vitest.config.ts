import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', root: './packages/core', environment: 'node' } },
      { test: { name: 'db', root: './packages/db', environment: 'node', testTimeout: 60_000 } },
      { test: { name: 'ai', root: './packages/ai', environment: 'node' } },
      { test: { name: 'catalog', root: './packages/catalog', environment: 'node', testTimeout: 60_000 } },
      { test: { name: 'web', root: './apps/web', environment: 'node', include: ['lib/**/*.test.ts'] } },
    ],
  },
});
