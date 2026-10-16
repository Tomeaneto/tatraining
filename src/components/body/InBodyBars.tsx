import { REFERENCE_RANGES } from '../../data/baseline';
import { inbodyBarSpecs, RANGE_LABEL, scalePosition, type RangeStatus } from '../../lib/body';
import { fmtNumber } from '../../lib/format';
import type { BodyComposition } from '../../types';

const SPECS = inbodyBarSpecs(REFERENCE_RANGES);

/** Barras horizontais no estilo do laudo InBody (ABAIXO / NORMAL / ACIMA), em % do padrão. */
export function InBodyBars({ latest, baseline }: { latest: BodyComposition; baseline: BodyComposition }) {
  return (
    <div className="space-y-5">
      {SPECS.map((spec) => {
        const value = latest[spec.key];
        const pct = (value / spec.standard) * 100;
        const basePct = (baseline[spec.key] / spec.standard) * 100;
        const pos = scalePosition(pct, spec.scale);
        const basePos = scalePosition(basePct, spec.scale);
        const nLo = scalePosition(spec.normal[0], spec.scale);
        const nHi = scalePosition(spec.normal[1], spec.scale);
        const status: RangeStatus = pct < spec.normal[0] ? 'below' : pct > spec.normal[1] ? 'above' : 'normal';
        const showBase = latest.id !== baseline.id;
        // Músculo acima do normal é desejável; só o resto acende como alerta.
        const good = status === 'normal' || (spec.key === 'skeletalMuscleKg' && status === 'above');
        return (
          <div key={spec.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-semibold">{spec.label}</span>
              <span className="tabular">
                <span className="font-display text-2xl">{fmtNumber(value)}</span>
                <span className="text-sm text-ta-muted"> kg · {fmtNumber(pct, 0)}%</span>
                <span
                  className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                    good ? 'bg-ta-yellow text-ta-bg' : 'border border-ta-gold/60 text-ta-gold'
                  }`}
                >
                  {RANGE_LABEL[status]}
                </span>
              </span>
            </div>
            <div
              className="relative h-5 rounded-md bg-ta-card2"
              role="meter"
              aria-label={`${spec.label}: ${fmtNumber(pct, 0)}% do padrão, ${RANGE_LABEL[status].toLowerCase()}`}
              aria-valuemin={spec.scale[0]}
              aria-valuemax={spec.scale[spec.scale.length - 1]}
              aria-valuenow={Math.round(pct)}
            >
              {/* faixa normal */}
              <div
                className="absolute inset-y-0 border-x border-ta-yellow/40 bg-ta-yellow/10"
                style={{ left: `${nLo * 100}%`, width: `${(nHi - nLo) * 100}%` }}
                aria-hidden
              />
              {/* barra do valor */}
              <div
                className="absolute inset-y-1 left-0 rounded-r-[4px] bg-gradient-to-r from-ta-silver/70 to-ta-gold"
                style={{ width: `${Math.max(pos * 100, 1)}%` }}
                aria-hidden
              />
              {showBase && (
                <div
                  className="absolute -inset-y-0.5 w-0.5 bg-ta-text/70"
                  style={{ left: `calc(${basePos * 100}% - 1px)` }}
                  title="Linha de base"
                  aria-hidden
                />
              )}
            </div>
            <div className="relative mt-1 h-4 text-[11px] text-ta-muted tabular" aria-hidden>
              {spec.scale.map((t, i) => (
                i % 2 === 0 && (
                  <span
                    key={t}
                    className={`absolute ${i === 0 ? '' : i === spec.scale.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
                    style={{ left: `${(i / (spec.scale.length - 1)) * 100}%` }}
                  >
                    {t}
                  </span>
                )
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-sm text-ta-muted">
        Valores em % do padrão InBody. A faixa clara é o normal; o traço branco marca a linha de base.
        A faixa de massa muscular é uma estimativa, pois o laudo de base não a informa.
      </p>
    </div>
  );
}
