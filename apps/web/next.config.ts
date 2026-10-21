import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Next solo lee los archivos .env de apps/web; el proyecto guarda `.env.local` en la raíz del monorepo
 * (ver .env.example), así que se cargan aquí sin pisar variables ya definidas en el proceso.
 */
function loadRootEnv(): void {
  for (const file of ['.env', '.env.local']) {
    const fullPath = path.join(repoRoot, file);
    if (!existsSync(fullPath)) continue;
    for (const rawLine of readFileSync(fullPath, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadRootEnv();

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  transpilePackages: ['@stenia/core', '@stenia/db', '@stenia/ai', '@stenia/catalog'],
  // El Agent SDK lanza su propio ejecutable de Claude Code: no se empaqueta.
  serverExternalPackages: ['pg', '@anthropic-ai/claude-agent-sdk'],
  typedRoutes: true,
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: '**.r2.dev' },
      ...(process.env.R2_PUBLIC_BASE_URL
        ? [{ protocol: 'https' as const, hostname: new URL(process.env.R2_PUBLIC_BASE_URL).hostname }]
        : []),
    ],
  },
};

export default withSerwist(nextConfig);
