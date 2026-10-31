import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { fmtDate, fmtNumber } from '../../lib/format';
import type { DayTotals } from '../../lib/meals';
import type { ISODate } from '../../types';

const KCAL = '#F4952A';
const PROTEIN = '#C0C0C0';

function IntakeTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload as DayTotals;
  return (
    <div className="min-w-[150px] rounded-lg border border-ta-border bg-ta-card2 px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 text-ta-muted">{fmtDate(day.date, "EEE, d 'de' MMM")}</div>
      {day.meals === 0 ? (
        <div className="text-ta-muted">Sem registros</div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KCAL }} aria-hidden />
              Calorias
            </span>
            <span className="tabular text-ta-text">{fmtNumber(day.kcal, 0)} kcal</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PROTEIN }} aria-hidden />
              Proteína
            </span>
            <span className="tabular text-ta-text">{fmtNumber(day.protein_g, 0)} g</span>
          </div>
        </>
      )}
    </div>
  );
}

type Props = {
  data: DayTotals[];
  selected: ISODate;
  onSelect: (date: ISODate) => void;
};

/** Calorias (barras) e proteína (linha) por dia. Toque numa barra para abrir o dia. */
export function DailyIntakeChart({ data, selected, onSelect }: Props) {
  return (
    <figure>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legenda">
        <li className="flex items-center gap-1.5 text-ta-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KCAL }} aria-hidden />
          Calorias (kcal)
        </li>
        <li className="flex items-center gap-1.5 text-ta-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PROTEIN }} aria-hidden />
          Proteína (g)
        </li>
      </ul>
      <div className="h-56" role="img" aria-label="Gráfico de calorias e proteína por dia">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: -8, bottom: 0, left: -16 }}
            barCategoryGap="22%"
            onClick={(state) => {
              const i = Number(state?.activeTooltipIndex);
              if (Number.isInteger(i) && data[i]) onSelect(data[i].date);
            }}
          >
            <CartesianGrid vertical={false} stroke="#222222" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => fmtDate(v, 'dd/MM')}
              tick={{ fill: '#9A9A9A', fontSize: 12 }}
              axisLine={{ stroke: '#2A2A2A' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              yAxisId="kcal"
              tickFormatter={(v: number) => fmtNumber(v, 0)}
              tick={{ fill: '#9A9A9A', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={52}
            />
            <YAxis
              yAxisId="protein"
              orientation="right"
              tickFormatter={(v: number) => `${fmtNumber(v, 0)}g`}
              tick={{ fill: '#9A9A9A', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={44}
            />
            <Tooltip content={IntakeTooltip} cursor={{ fill: 'rgba(244,149,42,0.08)' }} />
            <Bar
              yAxisId="kcal"
              dataKey="kcal"
              fill={KCAL}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; payload?: DayTotals }) => (
                <rect
                  x={props.x}
                  y={props.y}
                  width={props.width}
                  height={props.height}
                  rx={4}
                  fill={KCAL}
                  fillOpacity={props.payload?.date === selected ? 1 : 0.55}
                  style={{ cursor: 'pointer' }}
                />
              )}
            />
            <Line
              yAxisId="protein"
              dataKey="protein_g"
              stroke={PROTEIN}
              strokeWidth={2}
              dot={{ r: 3, fill: PROTEIN, stroke: PROTEIN }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {data
          .map((d) => `${fmtDate(d.date)}: ${fmtNumber(d.kcal, 0)} kcal, ${fmtNumber(d.protein_g, 0)} g de proteína`)
          .join('; ')}
      </figcaption>
    </figure>
  );
}
