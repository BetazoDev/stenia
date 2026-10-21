#!/usr/bin/env bun
/**
 * Ejecuta el Claude Code que trae el Agent SDK (no hace falta instalarlo aparte). Para el proveedor
 * «Suscripción de Claude» en este equipo:
 *   pnpm claude setup-token    → genera el token de tu suscripción (cópialo a CLAUDE_CODE_OAUTH_TOKEN en .env.local)
 *   pnpm claude auth status    → confirma que usa tu cuenta de Claude
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const sdk = createRequire(path.join(root, 'packages/ai/package.json')).resolve('@anthropic-ai/claude-agent-sdk/package.json');
const platform = `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}`;
let binary: string;
try {
  binary = path.join(path.dirname(createRequire(sdk).resolve(`${platform}/package.json`)), process.platform === 'win32' ? 'claude.exe' : 'claude');
} catch {
  console.error(`No encontré ${platform}. Corre pnpm install.`);
  process.exit(1);
}
// Sin API key en el entorno: así nunca se usa facturación por token.
const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;
delete env.ANTHROPIC_AUTH_TOKEN;
const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit', env });
process.exit(result.status ?? 1);
