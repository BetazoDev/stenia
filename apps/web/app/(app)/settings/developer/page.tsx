import type { Metadata } from 'next';

import { getMonthlyUsage, loadAiSettings, providerFromEnv, settingsToInput } from '@/lib/ai-settings';
import { env } from '@/lib/env';
import { requireAdmin } from '@/lib/session';

import { DeveloperSettingsForm } from './developer-settings-form';
import { UsagePanel } from './usage-panel';

export const metadata: Metadata = { title: 'Configuración de desarrollador' };
export const dynamic = 'force-dynamic';

export default async function DeveloperSettingsPage() {
  await requireAdmin();
  const [row, usage] = await Promise.all([loadAiSettings(), getMonthlyUsage()]);
  const e = env();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="label">Desarrollador</span>
        <h1 className="text-4xl">Configuración de IA</h1>
        <p className="text-text-2">Solo visible para el rol admin. Trae tu propia API key (BYOK).</p>
      </header>

      <UsagePanel usage={usage} budgetUsd={row?.monthlyBudgetUsd ?? 20} />

      <DeveloperSettingsForm
        initial={settingsToInput(row)}
        keyLast4={row?.apiKeyLast4 ?? null}
        keyFromEnv={Boolean(e.AI_API_KEY)}
        providerFromEnv={providerFromEnv()}
        encryptionConfigured={Boolean(e.ENCRYPTION_KEY)}
      />
    </div>
  );
}
