import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { METRIC_LABELS, REFERENCE_RANGES } from '../../data/baseline';
import { fmtDate, fmtNumber } from '../../lib/format';
import type { BodyComposition, BodyMetricKey } from '../../types';

const METRICS: { key: BodyMetricKey; short: string }[] = [
  { key: 'weightKg', short: 'Peso' },
  { key: 'fatMassKg', short: 'Gordura' },
  { key: 'skeletalMuscleKg', short: 'Músculo' },
  { key: 'bodyFatPct', short: 'PGC' },
  { key: 'visceralFatLevel', short: 'Visceral' },
];

type Point = { date: string; value: number };

/** Evolução de uma métrica ao longo das avaliações, com a faixa normal sombreada. */
export function EvolutionChart({ assessments }: { assessments: BodyComposition[] }) {
  const [metric, setMetric] = useState<BodyMetricKey>('weightKg');
  const m = METRIC_LABELS[metric];
  const range = REFERENCE_RANGES[metric];
  const data: Point[] = assessments.map((a) => ({ date: a.date, value: a[metric] }));
  const lastIndex = data.length - 1;

  const values = data.map((d) => d.value);
  const lo = Math.min(...values, range?.max ?? Infinity);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.1, 1);
  const step = hi - lo > 20 ? 10 : hi - lo > 4 ? 5 : 1;
  const domain: [number, number] = [Math.floor((lo - pad) / step) * step, Math.ceil((hi + pad) / step) * step];
  const ticks = Array.from({ length: Math.round((domain[1] - domain[0]) / step) + 1 }, (_, i) => domain[0] + i * step);

  function ChartTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as Point;
    return (
      <div className="rounded-lg border border-ta-border bg-ta-card2 px-3 py-1.5 text-sm shadow-lg">
        <div className="text-ta-muted">{fmtDate(p.date)}</div>
        <div className="font-display text-xl tabular text-ta-text">
          {fmtNumber(p.value, m.decimals)} <span className="font-sans text-sm text-ta-muted">{m.unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Métrica">
        {METRICS.map((x) => (
          <button
            key={x.key}
            type="button"
            aria-pressed={metric === x.key}
            onClick={() => setMetric(x.key)}
            className={`min-h-[44px] shrink-0 rounded-xl border px-3 text-sm font-semibold uppercase tracking-wider ${
              metric === x.key
                ? 'border-ta-gold bg-ta-gold text-ta-bg'
                : 'border-ta-border bg-ta-card2 text-ta-muted hover:text-ta-text'
            }`}
          >
            {x.short}
          </button>
        ))}
      </div>

      <div className="mb-1 flex items-baseline justify-between text-sm text-ta-muted">
        <span>
          {m.label}
          {m.unit ? ` (${m.unit})` : ''}
        </span>
        {range && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-ta-yellow/20 ring-1 ring-ta-yellow/40" aria-hidden />
            Normal {fmtNumber(range.min, m.decimals)}–{fmtNumber(range.max, m.decimals)}
          </span>
        )}
      </div>

      <div className="h-52" role="img" aria-label={`Evolução de ${m.label} em ${data.length} avaliações`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="#222222" />
            {range && (
              <ReferenceArea y1={range.min} y2={range.max} fill="#FFD700" fillOpacity={0.08} stroke="none" ifOverflow="hidden" />
            )}
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => fmtDate(v, 'MMM/yy')}
              tick={{ fill: '#9A9A9A', fontSize: 12 }}
              axisLine={{ stroke: '#2A2A2A' }}
              tickLine={false}
              minTickGap={16}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis
              domain={domain}
              ticks={ticks.length <= 8 ? ticks : undefined}
              tickFormatter={(v: number) => fmtNumber(v, 0)}
              tick={{ fill: '#9A9A9A', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={ChartTooltip} cursor={{ stroke: '#3A3A3A', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#F4952A"
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, index } = props as { cx: number; cy: number; index: number };
                const last = index === lastIndex;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={last ? 5 : 4}
                    fill={last ? '#FFD700' : '#F4952A'}
                    stroke="#111111"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6, fill: '#FFD700', stroke: '#111111', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {data.length < 2 && (
        <p className="mt-1 text-sm text-ta-muted">Só a linha de base por enquanto — a linha aparece a partir da 2ª avaliação.</p>
      )}
    </div>
  );
}
