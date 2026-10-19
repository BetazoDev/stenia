import js from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      'packages/db/drizzle/**',
      'playwright-report/**',
      'test-results/**',
      'apps/web/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx,mjs}'],
    extends: [...nextCoreWebVitals, ...nextTypescript],
    settings: { next: { rootDir: 'apps/web' } },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // Las imágenes del catálogo vienen de fuentes abiertas externas: se muestran sin pasar por el optimizador
    // de Next para no proxyar contenido de terceros desde el VPS (docs/decisions.md).
    files: ['apps/web/**/*.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    files: ['scripts/**/*.ts', 'apps/web/migrate.mjs'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
