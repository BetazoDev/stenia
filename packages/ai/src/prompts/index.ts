/**
 * Registro de prompts versionados. Cada prompt declara `id`, `version` y una función `render`
 * que recibe solo los datos necesarios (minimización: nunca nombre ni correo del usuario).
 */
export type PromptDefinition<TInput> = {
  id: string;
  version: number;
  render: (input: TInput) => { system: string; prompt: string };
};

/** Marca texto escrito por el usuario como datos, nunca como instrucciones. */
export function asUserData(label: string, text: string): string {
  const safe = text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<datos_usuario tipo="${label}">\n${safe}\n</datos_usuario>`;
}

export const pingPrompt: PromptDefinition<Record<string, never>> = {
  id: 'ping',
  version: 1,
  render: () => ({
    system: 'Responde únicamente con la palabra OK.',
    prompt: 'Prueba de conexión.',
  }),
};
