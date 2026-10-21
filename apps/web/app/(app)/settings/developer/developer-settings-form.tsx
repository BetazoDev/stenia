'use client';

import type { ConnectionTestResult } from '@stenia/ai';
import { AI_PROVIDER_LABELS, AI_TASK_LABELS, AiProvider, AiTask, DEFAULT_MODELS, type AiSettingsInput } from '@stenia/ai/settings';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input, Select } from '@/components/ui/input';
import { Field, FieldError, FieldHint, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { clearApiKeyAction, saveAiSettingsAction, testConnectionAction } from './actions';

type Props = {
  initial: AiSettingsInput;
  keyLast4: string | null;
  keyFromEnv: boolean;
  providerFromEnv: AiProvider | null;
  encryptionConfigured: boolean;
  /** La app corre en el servidor desplegado (la suscripción pasa por el puente). */
  serverDeployment: boolean;
};

const TASKS = AiTask.options;
const PROVIDERS = AiProvider.options;

export function DeveloperSettingsForm({ initial, keyLast4, keyFromEnv, providerFromEnv, encryptionConfigured, serverDeployment }: Props) {
  const [settings, setSettings] = useState<AiSettingsInput>(initial);
  const [apiKey, setApiKey] = useState('');
  const [replacingKey, setReplacingKey] = useState(!keyLast4);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [testTask, setTestTask] = useState<AiTask>('fast');
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saving, startSaving] = useTransition();
  const [testing, startTesting] = useTransition();

  const update = <K extends keyof AiSettingsInput>(key: K, value: AiSettingsInput[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const changeProvider = (provider: AiProvider) => {
    setSettings((prev) => {
      const wasDefault = JSON.stringify(prev.models) === JSON.stringify(DEFAULT_MODELS[prev.provider]);
      return { ...prev, provider, models: wasDefault ? DEFAULT_MODELS[provider] : prev.models };
    });
  };

  const save = () => {
    setMessage(null);
    startSaving(async () => {
      const result = await saveAiSettingsAction({ settings, apiKey: replacingKey && apiKey ? apiKey : undefined });
      setMessage({ tone: result.ok ? 'ok' : 'error', text: result.message ?? 'Guardado.' });
      if (result.ok && apiKey) {
        setApiKey('');
        setReplacingKey(false);
      }
    });
  };

  const test = () => {
    setTestResult(null);
    startTesting(async () => {
      setTestResult(await testConnectionAction(testTask));
    });
  };

  const removeKey = () => {
    setMessage(null);
    startSaving(async () => {
      const result = await clearApiKeyAction();
      setMessage({ tone: result.ok ? 'ok' : 'error', text: result.message ?? '' });
      setReplacingKey(true);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <CardHeader className="mb-0">
          <CardTitle>Proveedor y API key</CardTitle>
          <CardDescription>
            La key se cifra con AES-256-GCM en el servidor y nunca vuelve al navegador. Todas las llamadas salen del
            servidor.
          </CardDescription>
        </CardHeader>

        {providerFromEnv ? (
          <p className="rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-2">
            <Chip tone="accent" className="mr-2">
              Entorno
            </Chip>
            AI_PROVIDER={providerFromEnv} está definido y sobrescribe el proveedor guardado.
          </p>
        ) : null}

        <Field>
          <Label htmlFor="provider">Proveedor</Label>
          <Select id="provider" value={settings.provider} onChange={(e) => changeProvider(e.target.value as AiProvider)}>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {AI_PROVIDER_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>

        {settings.provider === 'claude_code' ? (
          <p className="rounded-input border border-border bg-surface px-3.5 py-3 text-sm text-text-2">
            {serverDeployment
              ? 'En este servidor las llamadas pasan por el puente a tu Mac y usan tu cuenta de Claude: sin costo por token, con los límites de tu suscripción. Solo para tu cuenta.'
              : 'Esta instancia corre en tu Mac: las llamadas van directo a tu cuenta de Claude (pnpm claude auth login). Sin costo por token.'}
          </p>
        ) : null}

        <Field className={settings.provider === 'claude_code' ? 'hidden' : undefined}>
          <Label htmlFor="baseUrl">URL base {settings.provider === 'openai_compatible' ? '' : '(opcional)'}</Label>
          <Input
            id="baseUrl"
            inputMode="url"
            placeholder="https://mi-servidor/v1"
            value={settings.baseUrl ?? ''}
            onChange={(e) => update('baseUrl', e.target.value)}
          />
          <FieldHint>Solo para proveedores compatibles con OpenAI o proxies propios.</FieldHint>
        </Field>

        <Field className={settings.provider === 'claude_code' ? 'hidden' : undefined}>
          <Label htmlFor="apiKey">API key</Label>
          {keyFromEnv ? (
            <p className="text-sm text-text-2">
              <Chip tone="accent" className="mr-2">
                Entorno
              </Chip>
              AI_API_KEY está definida en el servidor y sobrescribe cualquier key guardada aquí.
            </p>
          ) : null}
          {!replacingKey && keyLast4 ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="tnum rounded-input border border-border bg-surface px-3.5 py-2.5">••••{keyLast4}</span>
              <Button variant="secondary" size="sm" onClick={() => setReplacingKey(true)}>
                Reemplazar
              </Button>
              <Button variant="ghost" size="sm" onClick={removeKey} disabled={saving}>
                Quitar
              </Button>
            </div>
          ) : (
            <>
              <Input
                id="apiKey"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {!encryptionConfigured ? (
                <FieldError>Falta ENCRYPTION_KEY en el servidor: no se podrá guardar la key.</FieldError>
              ) : (
                <FieldHint>Tras guardar solo se muestran los últimos 4 caracteres.</FieldHint>
              )}
              {keyLast4 ? (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => { setReplacingKey(false); setApiKey(''); }}>
                  Conservar la key actual
                </Button>
              ) : null}
            </>
          )}
        </Field>
      </Card>

      <Card className="flex flex-col gap-5">
        <CardHeader className="mb-0">
          <CardTitle>Modelos por tarea</CardTitle>
          <CardDescription>Temperatura baja y pocos tokens en planificación; el modelo rápido atiende la sesión en vivo.</CardDescription>
        </CardHeader>
        <datalist id={`models-${settings.provider}`}>
          {Object.values(DEFAULT_MODELS[settings.provider])
            .filter((m, i, arr) => m && arr.indexOf(m) === i)
            .map((m) => (
              <option key={m} value={m} />
            ))}
        </datalist>
        <div className="flex flex-col gap-5">
          {TASKS.map((task) => (
            <fieldset key={task} className="grid grid-cols-1 gap-3 rounded-input border border-border p-4 sm:grid-cols-[1fr_auto_auto]">
              <legend className="label px-1">
                {AI_TASK_LABELS[task].label}
              </legend>
              <Field className="sm:col-span-3">
                <Label htmlFor={`model-${task}`}>Modelo</Label>
                <Input
                  id={`model-${task}`}
                  list={`models-${settings.provider}`}
                  placeholder={task === 'fallback' ? 'Opcional' : 'ID del modelo'}
                  value={settings.models[task] ?? ''}
                  onChange={(e) => update('models', { ...settings.models, [task]: e.target.value })}
                />
                <FieldHint>{AI_TASK_LABELS[task].help}</FieldHint>
              </Field>
              <Field>
                <Label htmlFor={`temp-${task}`}>Temperatura</Label>
                <Input
                  id={`temp-${task}`}
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.params[task].temperature}
                  onChange={(e) =>
                    update('params', { ...settings.params, [task]: { ...settings.params[task], temperature: Number(e.target.value) } })
                  }
                />
              </Field>
              <Field>
                <Label htmlFor={`tokens-${task}`}>Máx. tokens</Label>
                <Input
                  id={`tokens-${task}`}
                  type="number"
                  min={64}
                  max={64000}
                  step={64}
                  value={settings.params[task].maxTokens}
                  onChange={(e) =>
                    update('params', { ...settings.params, [task]: { ...settings.params[task], maxTokens: Number(e.target.value) } })
                  }
                />
              </Field>
            </fieldset>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <CardHeader className="mb-0">
          <CardTitle>Presupuesto e interruptores</CardTitle>
        </CardHeader>
        <Field>
          <Label htmlFor="budget">Presupuesto mensual (USD)</Label>
          <Input
            id="budget"
            type="number"
            min={0}
            step={1}
            value={settings.monthlyBudgetUsd}
            onChange={(e) => update('monthlyBudgetUsd', Number(e.target.value))}
          />
          <FieldHint>Al 80% avisa; al 100% bloquea las llamadas no esenciales.</FieldHint>
        </Field>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="sendPhotos">Enviar fotos al LLM</Label>
            <FieldHint>Apagado por defecto. Aun encendido, cada envío requiere una acción explícita.</FieldHint>
          </div>
          <Switch id="sendPhotos" checked={settings.sendPhotos} onCheckedChange={(v) => update('sendPhotos', v)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="logPrompts">Registro de prompts</Label>
            <FieldHint>Guarda prompts y respuestas sin datos personales para depurar.</FieldHint>
          </div>
          <Switch id="logPrompts" checked={settings.logPrompts} onCheckedChange={(v) => update('logPrompts', v)} />
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {message ? (
          <p role="status" className={message.tone === 'ok' ? 'text-sm text-up' : 'text-sm text-down'}>
            {message.text}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Card className="flex flex-col gap-4">
        <CardHeader className="mb-0">
          <CardTitle>Probar conexión</CardTitle>
          <CardDescription>Llamada mínima con la configuración guardada; muestra latencia y errores legibles.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-48">
            <Label htmlFor="testTask">Tarea</Label>
            <Select id="testTask" value={testTask} onChange={(e) => setTestTask(e.target.value as AiTask)}>
              {TASKS.map((task) => (
                <option key={task} value={task}>
                  {AI_TASK_LABELS[task].label}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={test} disabled={testing}>
            {testing ? 'Probando…' : 'Probar conexión'}
          </Button>
        </div>
        {testResult ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Chip tone={testResult.ok ? 'up' : 'down'}>{testResult.ok ? 'Conectado' : 'Error'}</Chip>
            <span className="tnum text-text-2">{testResult.modelId}</span>
            <span className="tnum text-text-2">{testResult.latencyMs} ms</span>
            {testResult.ok ? (
              <span className="tnum text-text-3">
                {testResult.usage.inputTokens} → {testResult.usage.outputTokens} tokens
              </span>
            ) : (
              <span className="text-down">{testResult.message}</span>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
