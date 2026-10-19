import { z } from 'zod';

import { asUserData, DATA_RULE, type PromptDefinition } from './base';

export const AliasMealPlan = z.object({
  days: z
    .array(
      z.object({
        meals: z
          .array(
            z.object({
              name: z.string().max(40),
              items: z.array(z.object({ foodId: z.string(), grams: z.number().min(5).max(800) })).min(1).max(8),
            }),
          )
          .min(2)
          .max(6),
      }),
    )
    .min(1)
    .max(7),
  notes: z.string().max(400).default(''),
});
export type AliasMealPlan = z.infer<typeof AliasMealPlan>;

export type MealPlanPromptInput = {
  targets: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  mealsPerDay: number;
  days: number;
  budget: string;
  cooks: boolean;
  excluded: string;
  /** "F12 | Pechuga de pollo | proteína | 165 kcal, 31 P, 0 C, 3.6 G por 100 g" */
  foodLines: string[];
};

export const mealPlanPrompt: PromptDefinition<MealPlanPromptInput> = {
  id: 'meal_plan',
  version: 1,
  render: (input) => ({
    system: [
      'Eres nutriólogo deportivo y armas menús sencillos con comida mexicana cotidiana, en español de México.',
      'Usa solo alimentos de la lista (códigos F…). El servidor recalcula los macros y ajusta porciones, así que',
      'prioriza combinaciones realistas y variadas; los gramos son aproximados. Responde solo con el JSON pedido.',
      DATA_RULE,
    ].join(' '),
    prompt: [
      `Metas diarias: ${input.targets.kcal} kcal, ${input.targets.proteinG} g proteína, ${input.targets.carbsG} g carbohidratos, ${input.targets.fatG} g grasa.`,
      `Arma ${input.days} días con ${input.mealsPerDay} comidas cada uno. Presupuesto: ${input.budget}. ${input.cooks ? 'Cocina en casa.' : 'Casi no cocina: prefiere opciones listas o de preparación mínima.'}`,
      'Reparte la proteína en tomas de 20–40 g cada 3–4 h.',
      input.excluded ? asUserData('alimentos_que_no_come', input.excluded) : '',
      '## Alimentos permitidos (código | nombre | grupo | por 100 g)',
      ...input.foodLines,
    ]
      .filter(Boolean)
      .join('\n'),
  }),
};
