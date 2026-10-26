#!/usr/bin/env bun
/**
 * Puente de IA en la Mac: resuelve con tu suscripción de Claude las peticiones que encola Stenia desplegada.
 * Solo hace peticiones salientes por HTTPS; el token vive en .env.local y nunca se imprime.
 *
 *   pnpm ai:bridge setup [--url=https://stenia.halonso.digital]   vincula esta Mac (pide confirmar un código en la app)
 *   pnpm ai:bridge                                                 atiende peticiones (Ctrl+C para salir)
 *   pnpm ai:bridge install | uninstall                             servicio de macOS que arranca al iniciar sesión
 *   pnpm ai:bridge status                                          muestra si está vinculada y el estado del servicio
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname, homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { BridgeJob, generateWithClaudeCode, hashBridgeToken, newBridgeToken, newPairingCode, type BridgeResult } from '@stenia/ai';
import { z } from 'zod';

const ROOT = path.resolve(import.meta.dir, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const LABEL = 'digital.halonso.stenia.ai-bridge';
const PLIST = path.join(homedir(), 'Library/LaunchAgents', `${LABEL}.plist`);
const LOG = path.join(homedir(), 'Library/Logs/stenia-ai-bridge.log');
const WORKER = hostname().replace(/\.local$/, '').slice(0, 60) || 'Mac';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { url: { type: 'string' } } });
const command = positionals[0] ?? 'run';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (msg: string) => console.info(`[${new Date().toLocaleTimeString('es-MX')}] ${msg}`);

/** Lee y escribe claves en .env.local sin mostrar sus valores. */
function setEnvValues(entries: Record<string, string>) {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8').split('\n') : [];
  for (const [key, value] of Object.entries(entries)) {
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(ENV_FILE, `${lines.filter((l, i) => l !== '' || i < lines.length - 1).join('\n')}\n`, { mode: 0o600 });
}

function config() {
  const url = (process.env.AI_BRIDGE_URL ?? '').replace(/\/$/, '');
  const token = process.env.AI_BRIDGE_TOKEN ?? '';
  return { url, token };
}

async function post(url: string, token: string | null, pathname: string, body: unknown, timeoutMs = 40_000) {
  return fetch(`${url}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function setup() {
  const url = (values.url ?? 'https://stenia.halonso.digital').replace(/\/$/, '');
  const token = newBridgeToken();
  const code = newPairingCode();
  const res = await post(url, null, '/api/ai-bridge/pair', { code, tokenHash: hashBridgeToken(token), worker: WORKER }).catch(() => null);
  if (!res?.ok) {
    const detail = !res
      ? 'el servidor no respondió (revisa la URL o tu conexión)'
      : res.status === 404
        ? 'la app desplegada todavía no tiene el puente; vuelve a desplegarla en Dokploy y repite este paso'
        : (((await res.json().catch(() => ({}))) as { message?: string }).message ?? `respondió ${res.status}`);
    console.error(`No se pudo registrar la vinculación en ${url}: ${detail}.`);
    process.exit(1);
  }
  // El token nuevo se guarda solo cuando la app confirma el código: si se cancela, el vínculo anterior sigue intacto.
  console.info(`\nAbre ${url}/settings/developer (con tu cuenta admin) y escribe este código:\n\n    ${code}\n\nEsperando confirmación (10 minutos)…`);
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const r = await post(url, token, '/api/ai-bridge/claim', { worker: WORKER, waitMs: 0 }, 10_000).catch(() => null);
    // 204 (sin trabajo) o 200 (una petición): la app ya acepta este token. Cualquier otro estado se reintenta.
    if (r && (r.status === 204 || r.status === 200)) {
      setEnvValues({ AI_BRIDGE_URL: url, AI_BRIDGE_TOKEN: token });
      if (r.status === 200) await handleRaw(url, token, await r.json().catch(() => null));
      const restarted = restartService();
      console.info(
        restarted
          ? '\nMac vinculada. El servicio se reinició con el vínculo nuevo.'
          : '\nMac vinculada. Deja corriendo «pnpm ai:bridge» o instálalo con «pnpm ai:bridge install».',
      );
      return;
    }
    await sleep(3000);
  }
  console.error('El código venció. Corre de nuevo pnpm ai:bridge setup.');
  process.exit(1);
}

/** Atiende lo que devolvió /claim; si no se puede leer, avisa al servidor en vez de dejarlo esperando. */
async function handleRaw(url: string, token: string, raw: unknown) {
  const job = BridgeJob.safeParse(raw);
  if (job.success) return handle(url, token, job.data);
  const meta = (raw ?? {}) as { id?: unknown; modelId?: unknown };
  if (typeof meta.id !== 'string' || !meta.id) return;
  const result: BridgeResult = {
    id: meta.id,
    ok: false,
    message: `La Mac no pudo leer la petición: ${job.error.issues.slice(0, 2).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`.slice(0, 2000),
    modelId: typeof meta.modelId === 'string' ? meta.modelId : '',
    latencyMs: 0,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
  };
  await post(url, token, '/api/ai-bridge/result', result).catch(() => null);
  log(`Petición ${meta.id} ilegible: ${result.message}`);
}

async function handle(url: string, token: string, job: BridgeJob) {
  log(`${job.fn} con ${job.modelId}…`);
  const r = await generateWithClaudeCode({
    modelId: job.modelId,
    oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
    params: job.params,
    schema: z.unknown(),
    jsonSchema: job.jsonSchema,
    system: job.system,
    prompt: job.prompt ?? undefined,
    content: job.content ?? undefined,
  });
  const result: BridgeResult = r.ok
    ? { id: job.id, ok: true, output: r.output, modelId: r.modelId, latencyMs: r.latencyMs, usage: r.usage }
    : { id: job.id, ok: false, message: r.message.slice(0, 2000), modelId: r.modelId, latencyMs: r.latencyMs, usage: r.usage };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await post(url, token, '/api/ai-bridge/result', result).catch(() => null);
    if (res?.ok) break;
    await sleep(2000);
  }
  log(`${job.fn}: ${r.ok ? 'listo' : `error (${r.message.slice(0, 120)})`} en ${(r.latencyMs / 1000).toFixed(1)} s`);
}

async function run() {
  const { url, token } = config();
  if (!url || !token) {
    console.error('Esta Mac no está vinculada. Corre: pnpm ai:bridge setup');
    process.exit(1);
  }
  log(`Puente activo con ${url} como «${WORKER}».`);
  let warnedUnpaired = false;
  for (;;) {
    let res: Response | null = null;
    try {
      res = await post(url, token, '/api/ai-bridge/claim', { worker: WORKER });
    } catch {
      await sleep(5000);
      continue;
    }
    if (res.status === 401) {
      if (!warnedUnpaired) log('La app no reconoce esta Mac (¿se desvinculó?). Corre pnpm ai:bridge setup.');
      warnedUnpaired = true;
      await sleep(30_000);
      continue;
    }
    warnedUnpaired = false;
    if (res.status === 204) continue;
    if (!res.ok) {
      await sleep(5000);
      continue;
    }
    await handleRaw(url, token, await res.json().catch(() => null));
  }
}

/** Si el servicio de macOS está instalado, lo reinicia para que lea el vínculo nuevo de .env.local. */
function restartService(): boolean {
  if (!existsSync(PLIST)) return false;
  const uid = String(process.getuid?.() ?? '');
  return spawnSync('launchctl', ['kickstart', '-k', `gui/${uid}/${LABEL}`], { stdio: 'ignore' }).status === 0;
}

function install() {
  // pnpm resuelve la versión vigente de Bun en cada arranque: una actualización de dependencias no rompe el servicio.
  const pnpm = spawnSync('which', ['pnpm'], { encoding: 'utf8' }).stdout.trim();
  if (!pnpm) {
    console.error('No encontré pnpm en el PATH; corre este comando desde la terminal donde usas pnpm.');
    process.exit(1);
  }
  const xml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  mkdirSync(path.dirname(PLIST), { recursive: true });
  mkdirSync(path.dirname(LOG), { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${xml(pnpm)}</string><string>exec</string><string>bun</string><string>run</string><string>scripts/ai-bridge.ts</string></array>
  <key>WorkingDirectory</key><string>${xml(ROOT)}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH ?? '/usr/bin:/bin')}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
`;
  writeFileSync(PLIST, plist);
  const uid = String(process.getuid?.() ?? '');
  spawnSync('launchctl', ['bootout', `gui/${uid}/${LABEL}`], { stdio: 'ignore' });
  const r = spawnSync('launchctl', ['bootstrap', `gui/${uid}`, PLIST], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.info(`Servicio instalado: arranca al iniciar sesión. Bitácora: ${LOG}`);
}

function uninstall() {
  const uid = String(process.getuid?.() ?? '');
  spawnSync('launchctl', ['bootout', `gui/${uid}/${LABEL}`], { stdio: 'ignore' });
  if (existsSync(PLIST)) unlinkSync(PLIST);
  console.info('Servicio quitado.');
}

function status() {
  const { url, token } = config();
  console.info(`Vinculada: ${url && token ? `sí, con ${url}` : 'no'}`);
  const r = spawnSync('launchctl', ['print', `gui/${process.getuid?.()}/${LABEL}`], { encoding: 'utf8' });
  console.info(`Servicio: ${r.status === 0 ? (/state = running/.test(r.stdout) ? 'corriendo' : 'instalado, detenido') : 'no instalado'}`);
}

switch (command) {
  case 'setup':
    await setup();
    break;
  case 'install':
    install();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'status':
    status();
    break;
  default:
    await run();
}
