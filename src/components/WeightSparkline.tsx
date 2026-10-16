import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis, type TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { fmtDate, fmtKg } from '../lib/format';
import type { BodyComposition } from '../types';

type Point = { date: string; weight: number };

function SparkTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="rounded-lg border border-ta-border bg-ta-card2 px-2 py-1 text-sm">
      <div className="text-ta-muted">{fmtDate(p.date)}</div>
      <div className="font-display text-lg text-ta-text tabular">{fmtKg(p.weight)}</div>
    </div>
  );
}

/** Linha do peso ao longo das avaliações — uma série, sem eixos. */
export function WeightSparkline({ assessments, height = 56 }: { assessments: BodyComposition[]; height?: number }) {
  const data: Point[] = assessments.map((a) => ({ date: a.date, weight: a.weightKg }));
  const lastIndex = data.length - 1;

  return (
    <div style={{ height }} role="img" aria-label={`Evolução do peso em ${data.length} avaliações`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 6, left: 8 }}>
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip content={SparkTooltip} cursor={{ stroke: '#3A3A3A', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#F4952A"
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, index } = props as { cx: number; cy: number; index: number };
              if (index !== lastIndex) return <g key={index} />;
              return <circle key={index} cx={cx} cy={cy} r={4} fill="#FFD700" stroke="#111111" strokeWidth={2} />;
            }}
            activeDot={{ r: 5, fill: '#FFD700', stroke: '#111111', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
