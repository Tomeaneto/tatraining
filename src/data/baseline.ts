import type { Athlete, BodyComposition, BodyMetricKey, ReferenceRange } from '../types';

/** Avaliação InBody de 26/01/2026 — ponto de partida do programa. */
export const BASELINE_ID = 'baseline-2026-01-26';

export const BASELINE: BodyComposition = {
  id: BASELINE_ID,
  date: '2026-01-26',
  isBaseline: true,
  weightKg: 106.2,
  skeletalMuscleKg: 39.4,
  fatMassKg: 37.5,
  bodyFatPct: 35.3,
  bmi: 35.9,
  totalBodyWaterL: 50.3,
  proteinKg: 13.7,
  mineralsKg: 4.6,
  bmrKcal: 1854,
  waistHipRatio: 0.96,
  visceralFatLevel: 16,
  obesityDegreePct: 163,
  inbodyScore: 68,
  idealWeightKg: 80.9,
  fatControlKg: -25.3,
  segmentalLean: { rightArm: 4.27, leftArm: 4.27, trunk: 31.97, rightLeg: 10.74, leftLeg: 10.56 },
  segmentalFat: { rightArm: 3, leftArm: 3, trunk: 20, rightLeg: 5, leftLeg: 5 },
};

/** Faixas de referência do laudo InBody. */
export const REFERENCE_RANGES: Partial<Record<BodyMetricKey, ReferenceRange>> = {
  weightKg: { min: 55.3, max: 74.8 },
  // O laudo de 26/01 não traz a faixa de massa muscular; estes valores são
  // uma estimativa típica do InBody para homem de 172 cm (90–110% do padrão).
  // Ajuste se o seu laudo indicar outra faixa.
  skeletalMuscleKg: { min: 28.7, max: 35.1 },
  fatMassKg: { min: 7.8, max: 15.6 },
  bodyFatPct: { min: 10, max: 20 },
  bmi: { min: 18.5, max: 25 },
  totalBodyWaterL: { min: 36.6, max: 44.7 },
  proteinKg: { min: 9.8, max: 12 },
  mineralsKg: { min: 3.4, max: 4.1 },
  waistHipRatio: { min: 0.8, max: 0.9 },
  visceralFatLevel: { min: 1, max: 9 },
  obesityDegreePct: { min: 90, max: 110 },
};

/**
 * Direção desejada de cada métrica: `down` = melhorar é diminuir.
 * Usado para colorir comparações (dourado = melhorou).
 */
export const METRIC_DIRECTION: Record<BodyMetricKey, 'up' | 'down' | 'neutral'> = {
  weightKg: 'down',
  skeletalMuscleKg: 'up',
  fatMassKg: 'down',
  bodyFatPct: 'down',
  bmi: 'down',
  totalBodyWaterL: 'neutral',
  proteinKg: 'up',
  mineralsKg: 'neutral',
  bmrKcal: 'up',
  waistHipRatio: 'down',
  visceralFatLevel: 'down',
  obesityDegreePct: 'down',
  inbodyScore: 'up',
  idealWeightKg: 'neutral',
  fatControlKg: 'up',
};

export const METRIC_LABELS: Record<BodyMetricKey, { label: string; unit: string; decimals: number }> = {
  weightKg: { label: 'Peso', unit: 'kg', decimals: 1 },
  skeletalMuscleKg: { label: 'Massa muscular esquelética', unit: 'kg', decimals: 1 },
  fatMassKg: { label: 'Massa de gordura', unit: 'kg', decimals: 1 },
  bodyFatPct: { label: 'Percentual de gordura', unit: '%', decimals: 1 },
  bmi: { label: 'IMC', unit: '', decimals: 1 },
  totalBodyWaterL: { label: 'Água corporal total', unit: 'L', decimals: 1 },
  proteinKg: { label: 'Proteína', unit: 'kg', decimals: 1 },
  mineralsKg: { label: 'Minerais', unit: 'kg', decimals: 1 },
  bmrKcal: { label: 'Taxa metabólica basal', unit: 'kcal', decimals: 0 },
  waistHipRatio: { label: 'Relação cintura-quadril', unit: '', decimals: 2 },
  visceralFatLevel: { label: 'Gordura visceral (nível)', unit: '', decimals: 0 },
  obesityDegreePct: { label: 'Grau de obesidade', unit: '%', decimals: 0 },
  inbodyScore: { label: 'Pontuação InBody', unit: '/100', decimals: 0 },
  idealWeightKg: { label: 'Peso ideal', unit: 'kg', decimals: 1 },
  fatControlKg: { label: 'Controle de gordura', unit: 'kg', decimals: 1 },
};

/** FC máx. estimada pela fórmula de Tanaka: 208 − 0,7 × idade. */
export function tanakaHrMax(age: number): number {
  return Math.round(208 - 0.7 * age);
}

export const DEFAULT_ATHLETE: Athlete = {
  name: 'Tomé Brígido de Almeida',
  birthYear: 1993,
  age: 33,
  sex: 'M',
  heightCm: 172,
  hrMax: tanakaHrMax(33),
  hrMaxSource: 'estimated',
};
