import { METRIC_DIRECTION } from '../data/baseline';
import type { BodyMetricKey, ReferenceRange } from '../types';

export type RangeStatus = 'below' | 'normal' | 'above';

export const RANGE_LABEL: Record<RangeStatus, string> = {
  below: 'Abaixo',
  normal: 'Normal',
  above: 'Acima',
};

export function rangeStatus(value: number, range: ReferenceRange): RangeStatus {
  if (value < range.min) return 'below';
  if (value > range.max) return 'above';
  return 'normal';
}

/** `true` = melhorou, `false` = piorou, `null` = sem mudança ou métrica neutra. */
export function improvement(key: BodyMetricKey, from: number, to: number): boolean | null {
  const dir = METRIC_DIRECTION[key];
  const delta = to - from;
  if (dir === 'neutral' || Math.abs(delta) < 1e-9) return null;
  return dir === 'up' ? delta > 0 : delta < 0;
}

/**
 * Padrões do gráfico InBody (barras ABAIXO / NORMAL / ACIMA).
 * O valor é mostrado em % do padrão; `normal` é a faixa sombreada e `scale`, a régua.
 * Padrão de peso e gordura saem das faixas do laudo (peso 85–115%, gordura 80–160%).
 */
export interface InBodyBarSpec {
  key: Extract<BodyMetricKey, 'weightKg' | 'skeletalMuscleKg' | 'fatMassKg'>;
  label: string;
  standard: number;
  normal: [number, number];
  scale: number[];
}

export function inbodyBarSpecs(ranges: Partial<Record<BodyMetricKey, ReferenceRange>>): InBodyBarSpec[] {
  const w = ranges.weightKg!;
  const m = ranges.skeletalMuscleKg!;
  const f = ranges.fatMassKg!;
  return [
    { key: 'weightKg', label: 'Peso', standard: (w.min + w.max) / 2, normal: [85, 115], scale: [55, 70, 85, 100, 115, 130, 145, 160, 175, 190, 205] },
    { key: 'skeletalMuscleKg', label: 'Massa muscular', standard: (m.min + m.max) / 2, normal: [90, 110], scale: [70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170] },
    { key: 'fatMassKg', label: 'Massa de gordura', standard: f.min / 0.8, normal: [80, 160], scale: [40, 60, 80, 100, 160, 220, 280, 340, 400, 460, 520] },
  ];
}

/**
 * Posição (0–1) de um percentual na régua: interpolação linear entre os ticks,
 * cada intervalo com a mesma largura — como no laudo impresso.
 */
export function scalePosition(pct: number, scale: number[]): number {
  if (pct <= scale[0]) return 0;
  const last = scale.length - 1;
  if (pct >= scale[last]) return 1;
  for (let i = 0; i < last; i++) {
    if (pct <= scale[i + 1]) {
      const t = (pct - scale[i]) / (scale[i + 1] - scale[i]);
      return (i + t) / last;
    }
  }
  return 1;
}
