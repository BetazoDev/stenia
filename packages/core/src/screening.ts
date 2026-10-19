import { z } from 'zod';

/**
 * Cribado previo a la actividad (sección 4 del PRD): PAR-Q+ (7 preguntas generales + seguimiento) y el algoritmo
 * de preparticipación del ACSM. Ningún "sí" aprueba automáticamente: abre preguntas de seguimiento.
 */

export const PARQ_QUESTIONS = [
  {
    id: 'q1',
    text: '¿Algún médico te ha dicho que tienes una condición del corazón o presión arterial alta?',
  },
  {
    id: 'q2',
    text: '¿Sientes dolor en el pecho en reposo, en tus actividades diarias o cuando haces actividad física?',
  },
  {
    id: 'q3',
    text: '¿Pierdes el equilibrio por mareo o has perdido el conocimiento en los últimos 12 meses?',
    hint: 'Responde "no" si el mareo se debió a respirar muy rápido, incluso durante ejercicio intenso.',
  },
  {
    id: 'q4',
    text: '¿Te han diagnosticado alguna otra enfermedad crónica (distinta de la del corazón o la presión alta)?',
  },
  {
    id: 'q5',
    text: '¿Tomas actualmente medicamentos recetados para una enfermedad crónica?',
  },
  {
    id: 'q6',
    text: '¿Tienes (o tuviste en los últimos 12 meses) un problema de huesos, articulaciones o tejidos blandos que podría empeorar si te vuelves más activo?',
    hint: 'Responde "no" si fue un problema pasado que hoy no limita tu actividad.',
  },
  {
    id: 'q7',
    text: '¿Algún médico te ha dicho que solo debes hacer actividad física con supervisión médica?',
  },
] as const;

export type ParqQuestionId = (typeof PARQ_QUESTIONS)[number]['id'];

export const ConditionCategory = z.enum([
  'cardiovascular',
  'hypertension',
  'metabolic',
  'renal',
  'respiratory',
  'musculoskeletal',
  'neurological',
  'cancer',
  'mental_health',
  'other',
]);
export type ConditionCategory = z.infer<typeof ConditionCategory>;

export const CONDITION_LABELS_ES: Record<ConditionCategory, string> = {
  cardiovascular: 'Corazón o circulación',
  hypertension: 'Presión arterial alta',
  metabolic: 'Metabólica (diabetes tipo 1 o 2, prediabetes)',
  renal: 'Riñón',
  respiratory: 'Respiratoria (asma, EPOC)',
  musculoskeletal: 'Huesos, articulaciones o espalda',
  neurological: 'Neurológica (epilepsia, lesión medular, EVC)',
  cancer: 'Cáncer',
  mental_health: 'Salud mental',
  other: 'Otra',
};

export const ParqAnswers = z.object({
  q1: z.boolean(),
  q2: z.boolean(),
  q3: z.boolean(),
  q4: z.boolean(),
  q5: z.boolean(),
  q6: z.boolean(),
  q7: z.boolean(),
});
export type ParqAnswers = z.infer<typeof ParqAnswers>;

/** Seguimiento que se abre ante cualquier "sí" del PAR-Q+. */
export const ParqFollowUp = z.object({
  conditions: z.array(ConditionCategory).default([]),
  /** ¿La condición está controlada con tratamiento (medicamento, terapia)? */
  controlled: z.boolean().nullable().default(null),
  /** ¿Aparecen síntomas (dolor, falta de aire, mareo) al hacer esfuerzo? */
  symptomsOnExertion: z.boolean().nullable().default(null),
  /** ¿Un médico ya te autorizó a hacer ejercicio? */
  clearedByDoctor: z.boolean().nullable().default(null),
});
export type ParqFollowUp = z.infer<typeof ParqFollowUp>;

export const DesiredIntensity = z.enum(['light', 'moderate', 'vigorous']);
export type DesiredIntensity = z.infer<typeof DesiredIntensity>;

/** Tres factores del algoritmo ACSM + intensidad deseada. */
export const AcsmAnswers = z.object({
  /** ≥ 30 min de actividad moderada, 3 días por semana, en los últimos 3 meses. */
  exercisesRegularly: z.boolean(),
  /** Enfermedad cardiovascular, metabólica o renal diagnosticada. */
  knownDisease: z.boolean(),
  /** Signos o síntomas sugestivos (dolor de pecho, falta de aire anormal, desmayos, palpitaciones, edema). */
  symptoms: z.boolean(),
  desiredIntensity: DesiredIntensity,
});
export type AcsmAnswers = z.infer<typeof AcsmAnswers>;

export const ScreeningInput = z.object({
  parq: ParqAnswers,
  followUp: ParqFollowUp.optional(),
  acsm: AcsmAnswers,
});
export type ScreeningInput = z.infer<typeof ScreeningInput>;

export type IntensityCap = 'light_moderate' | 'moderate' | 'vigorous';

export type ScreeningResult = {
  /** Algún "sí" en el PAR-Q+: obliga a mostrar el seguimiento. */
  needsFollowUp: boolean;
  /** Recomendar valoración médica antes de entrenar o de subir intensidad. */
  clearanceRecommended: boolean;
  /** Intensidad máxima permitida mientras haya bandera. */
  intensityCap: IntensityCap;
  /** Banderas individuales (se guardan en `screening.acsm_flags`). */
  flags: Record<string, boolean>;
  /** Motivos legibles en español. */
  reasons: string[];
};

export function parqHasYes(parq: ParqAnswers): boolean {
  return Object.values(parq).some(Boolean);
}

/** Algoritmo ACSM (2015) simplificado a la decisión de valoración médica e intensidad. */
export function acsmDecision(acsm: AcsmAnswers): { clearance: boolean; cap: IntensityCap; reason: string | null } {
  if (acsm.symptoms) {
    return {
      clearance: true,
      cap: 'light_moderate',
      reason: acsm.exercisesRegularly
        ? 'Tienes síntomas: el ACSM recomienda pausar el ejercicio y obtener valoración médica.'
        : 'Tienes síntomas: el ACSM recomienda valoración médica antes de empezar.',
    };
  }
  if (acsm.knownDisease) {
    if (!acsm.exercisesRegularly) {
      return {
        clearance: true,
        cap: 'light_moderate',
        reason: 'Con una enfermedad diagnosticada y sin entrenar hoy, el ACSM recomienda valoración médica antes de empezar.',
      };
    }
    if (acsm.desiredIntensity === 'vigorous') {
      return {
        clearance: true,
        cap: 'moderate',
        reason: 'Puedes seguir a intensidad moderada; para entrenar vigoroso el ACSM recomienda valoración médica.',
      };
    }
    return { clearance: false, cap: 'moderate', reason: null };
  }
  if (!acsm.exercisesRegularly) {
    return { clearance: false, cap: 'light_moderate', reason: 'Empieza ligero a moderado y progresa poco a poco.' };
  }
  return { clearance: false, cap: 'vigorous', reason: null };
}

const CAP_ORDER: IntensityCap[] = ['light_moderate', 'moderate', 'vigorous'];

function minCap(a: IntensityCap, b: IntensityCap): IntensityCap {
  return CAP_ORDER[Math.min(CAP_ORDER.indexOf(a), CAP_ORDER.indexOf(b))] ?? 'light_moderate';
}

/** Combina PAR-Q+ y ACSM. Cualquier bandera limita la rutina a ligera–moderada (sección 4 del PRD). */
export function evaluateScreening(input: ScreeningInput): ScreeningResult {
  const parq = ParqAnswers.parse(input.parq);
  const acsm = AcsmAnswers.parse(input.acsm);
  const followUp = input.followUp ? ParqFollowUp.parse(input.followUp) : undefined;
  const needsFollowUp = parqHasYes(parq);
  const reasons: string[] = [];
  const flags: Record<string, boolean> = {
    parqYes: needsFollowUp,
    knownDisease: acsm.knownDisease,
    symptoms: acsm.symptoms,
    exercisesRegularly: acsm.exercisesRegularly,
  };

  const acsmResult = acsmDecision(acsm);
  let clearance = acsmResult.clearance;
  let cap = acsmResult.cap;
  if (acsmResult.reason) reasons.push(acsmResult.reason);

  if (needsFollowUp) {
    const answered = followUp && followUp.symptomsOnExertion !== null && followUp.clearedByDoctor !== null;
    const risky =
      !answered ||
      parq.q2 ||
      parq.q7 ||
      followUp?.symptomsOnExertion === true ||
      followUp?.controlled === false ||
      followUp?.clearedByDoctor === false;
    flags.parqRisk = risky;
    if (followUp?.conditions.some((c) => ['cardiovascular', 'metabolic', 'renal'].includes(c))) {
      flags.knownDisease = true;
    }
    if (risky) {
      clearance = true;
      cap = minCap(cap, 'light_moderate');
      reasons.push(
        parq.q2
          ? 'Reportas dolor de pecho: consulta a un médico antes de entrenar.'
          : parq.q7
            ? 'Tu médico indicó actividad supervisada: entrena solo con su autorización.'
            : 'Tus respuestas del PAR-Q+ sugieren pedir valoración médica antes de subir la intensidad.',
      );
    } else {
      cap = minCap(cap, 'moderate');
      reasons.push('Condición controlada y con autorización médica: intensidad moderada como punto de partida.');
    }
  }

  if (clearance) cap = minCap(cap, 'light_moderate');
  return { needsFollowUp, clearanceRecommended: clearance, intensityCap: cap, flags, reasons };
}

export const INTENSITY_CAP_LABELS_ES: Record<IntensityCap, string> = {
  light_moderate: 'Ligera a moderada',
  moderate: 'Moderada',
  vigorous: 'Sin límite (moderada a vigorosa)',
};
