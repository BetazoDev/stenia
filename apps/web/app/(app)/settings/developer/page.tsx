import { OWNER_ONLY_PROVIDERS, defaultSettingsFor } from '@stenia/ai';
import type { Metadata } from 'next';

import { aiStatus } from '@/lib/ai';
import {
  getMonthlyUsage,
  getUsersAiMode,
  loadAiSettings,
  providerFromEnv,
  settingsToInput,
} from '@/lib/ai-settings';
import { bridgeState, usesBridge } from '@/lib/ai-bridge';
import { JOB_TYPES, catalogCounts, listJobs } from '@/lib/jobs';
import { env } from '@/lib/env';
import { requireAdmin } from '@/lib/session';

import { DeveloperSettingsForm } from './developer-settings-form';
import { BridgePanel } from './bridge-panel';
import { JobsPanel } from './jobs-panel';
import { UsagePanel } from './usage-panel';
import { UsersAiPanel } from './users-ai-panel';

export const metadata: Metadata = { title: 'Configuración de desarrollador' };
export const dynamic = 'force-dynamic';

export default async function DeveloperSettingsPage() {
  const session = await requireAdmin();
  const [row, usersRow, usersMode, usage, jobs, counts, status] = await Promise.all([
    loadAiSettings(),
    loadAiSettings('users'),
    getUsersAiMode(),
    getMonthlyUsage(),
    listJobs(),
    catalogCounts(),
    aiStatus('translation', session.user.id),
  ]);
  const e = env();
  const provider = providerFromEnv() ?? row?.provider ?? 'anthropic';
  const bridge = provider === 'claude_code' ? await bridgeState() : null;
  const serverDeployment = process.env.STENIA_DEPLOYMENT === 'server';

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Desarrollador</span>
        <h1 className="text-4xl">Configuración de IA</h1>
        <p className="text-text-2">
          Solo visible para el rol admin. Tu perfil y el de las demás cuentas.
        </p>
      </header>

      {bridge ? <BridgePanel state={bridge} serverMode={usesBridge(provider)} /> : null}

      <UsagePanel usage={usage} budgetUsd={row?.monthlyBudgetUsd ?? 20} />

      <DeveloperSettingsForm
        initial={settingsToInput(row)}
        keyLast4={row?.apiKeyLast4 ?? null}
        keyFromEnv={Boolean(e.AI_API_KEY)}
        providerFromEnv={providerFromEnv()}
        encryptionConfigured={Boolean(e.ENCRYPTION_KEY)}
        serverDeployment={serverDeployment}
      />

      <UsersAiPanel mode={usersMode} ownerOnlyProvider={OWNER_ONLY_PROVIDERS.includes(provider)} />

      {usersMode === 'custom' ? (
        <DeveloperSettingsForm
          scope="users"
          initial={usersRow ? settingsToInput(usersRow) : defaultSettingsFor('workers_ai')}
          keyLast4={usersRow?.apiKeyLast4 ?? null}
          keyFromEnv={false}
          providerFromEnv={null}
          encryptionConfigured={Boolean(e.ENCRYPTION_KEY)}
          serverDeployment={serverDeployment}
        />
      ) : null}

      <JobsPanel
        jobs={jobs.map((j) => ({
          ...j,
          startedAt: j.startedAt.toISOString(),
          finishedAt: j.finishedAt?.toISOString() ?? null,
        }))}
        labels={JOB_TYPES}
        counts={counts}
        aiReady={status.available}
      />
    </div>
  );
}
