import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { fmtDate, fmtHours, fmtNumber } from '../../lib/format';
import { SPORTS } from '../../lib/sports';
import { VOLUME_KEYS, type VolumeKey, type WeekVolume } from '../../lib/weeklyVolume';

const SURFACE = '#111111';
const COLORS: Record<VolumeKey, string> = {
  swim: SPORTS.swim.color,
  bike: SPORTS.bike.color,
  run: SPORTS.run.color,
  strength: SPORTS.strength.color,
};

function VolumeTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const week = payload[0].payload as WeekVolume;
  return (
    <div className="min-w-[150px] rounded-lg border border-ta-border bg-ta-card2 px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 text-ta-muted">Semana de {fmtDate(week.weekStart, "d 'de' MMM")}</div>
      {[...VOLUME_KEYS].reverse().map((k) => (
        <div key={k} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] }} aria-hidden />
            {SPORTS[k].label}
          </span>
          <span className="tabular text-ta-text">{fmtHours(week[k] * 60)}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-ta-border pt-1 font-semibold">
        <span>Total</span>
        <span className="tabular">{fmtHours(week.total * 60)}</span>
      </div>
    </div>
  );
}

/** Volume semanal (horas) empilhado por modalidade. */
export function WeeklyVolumeChart({ data }: { data: WeekVolume[] }) {
  const top = VOLUME_KEYS[VOLUME_KEYS.length - 1];
  return (
    <figure>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legenda">
        {VOLUME_KEYS.map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-ta-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] }} aria-hidden />
            {SPORTS[k].label}
          </li>
        ))}
      </ul>
      <div className="h-56" role="img" aria-label="Gráfico de horas de treino por semana, empilhado por modalidade">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#222222" />
            <XAxis
              dataKey="weekStart"
              tickFormatter={(v: string) => fmtDate(v, 'dd/MM')}
              tick={{ fill: '#9A9A9A', fontSize: 12 }}
              axisLine={{ stroke: '#2A2A2A' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickFormatter={(v: number) => `${fmtNumber(v, 0)}h`}
              tick={{ fill: '#9A9A9A', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={44}
            />
            <Tooltip content={VolumeTooltip} cursor={{ fill: 'rgba(244,149,42,0.08)' }} />
            {VOLUME_KEYS.map((k) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="v"
                fill={COLORS[k]}
                stroke={SURFACE}
                strokeWidth={2}
                radius={k === top ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data.map((w) => `Semana de ${fmtDate(w.weekStart)}: ${fmtHours(w.total * 60)}`).join('; ')}
      </figcaption>
    </figure>
  );
}
