import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { METRIC_LABELS, REFERENCE_RANGES } from '../../data/baseline';
import { improvement, RANGE_LABEL, rangeStatus } from '../../lib/body';
import { fmtDate, fmtDelta, fmtNumber } from '../../lib/format';
import type { BodyComposition, BodyMetricKey } from '../../types';

const ROWS: BodyMetricKey[] = [
  'weightKg',
  'skeletalMuscleKg',
  'fatMassKg',
  'bodyFatPct',
  'bmi',
  'visceralFatLevel',
  'waistHipRatio',
  'totalBodyWaterL',
  'proteinKg',
  'mineralsKg',
  'bmrKcal',
  'obesityDegreePct',
  'inbodyScore',
];

type Props = { latest: BodyComposition; baseline: BodyComposition };

/** Última avaliação vs. linha de base vs. faixa de referência. */
export function ComparisonCard({ latest, baseline }: Props) {
  const same = latest.id === baseline.id;
  return (
    <table className="w-full text-left">
      <caption className="mb-2 text-left text-sm text-ta-muted">
        {same
          ? `Linha de base de ${fmtDate(baseline.date)} — registre uma nova avaliação para comparar.`
          : `${fmtDate(latest.date)} vs. base de ${fmtDate(baseline.date)}`}
      </caption>
      <thead>
        <tr className="text-xs uppercase tracking-[0.1em] text-ta-muted">
          <th scope="col" className="pb-1 font-semibold">Métrica · referência</th>
          <th scope="col" className="pb-1 text-right font-semibold">Atual</th>
          <th scope="col" className="w-[76px] pb-1 text-right font-semibold">Δ base</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ta-border">
        {ROWS.map((k) => {
          const m = METRIC_LABELS[k];
          const range = REFERENCE_RANGES[k];
          const delta = latest[k] - baseline[k];
          const imp = same ? null : improvement(k, baseline[k], latest[k]);
          const status = range ? rangeStatus(latest[k], range) : null;
          const Arrow = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
          const tone = imp === true ? 'text-ta-yellow' : imp === false ? 'text-red-400' : 'text-ta-muted';
          return (
            <tr key={k}>
              <th scope="row" className="py-2 pr-2 align-top font-medium">
                {m.label}
                {range && (
                  <span className="block text-xs font-normal text-ta-muted tabular">
                    {fmtNumber(range.min, m.decimals)}–{fmtNumber(range.max, m.decimals)}
                    <span className={`ml-1.5 font-semibold uppercase tracking-wider ${status === 'normal' || (k === 'skeletalMuscleKg' && status === 'above') ? 'text-ta-yellow' : 'text-ta-gold'}`}>
                      {RANGE_LABEL[status!]}
                    </span>
                  </span>
                )}
              </th>
              <td className="whitespace-nowrap py-2 text-right align-top font-display text-xl tabular">
                {fmtNumber(latest[k], m.decimals)}
                {m.unit && <span className="ml-0.5 font-sans text-xs text-ta-muted">{m.unit}</span>}
              </td>
              <td className={`whitespace-nowrap py-2 pt-2.5 text-right align-top tabular ${tone}`}>
                {same ? (
                  <span className="text-ta-muted">—</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 font-semibold">
                    <Arrow size={14} aria-hidden />
                    {fmtDelta(delta, m.decimals)}
                    <span className="sr-only">{imp === true ? ' (melhorou)' : imp === false ? ' (piorou)' : ''}</span>
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
