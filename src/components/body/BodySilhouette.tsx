import { useId, useState } from 'react';
import { fmtDelta, fmtNumber } from '../../lib/format';
import type { BodyComposition, Segmental } from '../../types';
import { SEGMENTS } from './BodyForm';

type Mode = 'lean' | 'fat';

/**
 * Silhueta em vista frontal (o lado direito do atleta fica à esquerda da imagem),
 * com os valores segmentares e a variação desde a linha de base.
 */
const SHAPES: Record<keyof Segmental, { d: string; label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }; lead?: [number, number, number, number] }> = {
  rightArm: {
    d: 'M118 62 q-14 4 -18 22 l-10 62 q-2 12 8 14 q9 1 11 -10 l12 -56 z',
    label: { x: 70, y: 96, anchor: 'end' },
    lead: [74, 92, 100, 100],
  },
  leftArm: {
    d: 'M202 62 q14 4 18 22 l10 62 q2 12 -8 14 q-9 1 -11 -10 l-12 -56 z',
    label: { x: 250, y: 96, anchor: 'start' },
    lead: [246, 92, 220, 100],
  },
  trunk: {
    d: 'M126 56 q34 -10 68 0 q8 3 8 14 l-4 56 q-2 16 2 36 h-80 q4 -20 2 -36 l-4 -56 q0 -11 8 -14 z',
    label: { x: 160, y: 118, anchor: 'middle' },
  },
  rightLeg: {
    d: 'M122 168 h36 l-4 70 l-4 48 q-1 8 -10 8 q-9 0 -10 -8 l-6 -50 z',
    label: { x: 70, y: 236, anchor: 'end' },
    lead: [74, 232, 122, 232],
  },
  leftLeg: {
    d: 'M162 168 h36 l-2 68 l-6 50 q-1 8 -10 8 q-9 0 -10 -8 l-4 -48 z',
    label: { x: 250, y: 236, anchor: 'start' },
    lead: [246, 232, 198, 232],
  },
};

type Props = { latest: BodyComposition; baseline: BodyComposition };

export function BodySilhouette({ latest, baseline }: Props) {
  const [mode, setMode] = useState<Mode>('lean');
  const gid = useId();
  const values = mode === 'lean' ? latest.segmentalLean : latest.segmentalFat;
  const base = mode === 'lean' ? baseline.segmentalLean : baseline.segmentalFat;
  const showDelta = latest.id !== baseline.id;
  const decimals = mode === 'lean' ? 2 : 1;

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de massa">
        {(['lean', 'fat'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-[44px] rounded-xl border text-sm font-semibold uppercase tracking-wider ${
              mode === m ? 'border-ta-gold bg-ta-gold text-ta-bg' : 'border-ta-border bg-ta-card2 text-ta-muted'
            }`}
          >
            {m === 'lean' ? 'Massa magra' : 'Gordura'}
          </button>
        ))}
      </div>

      <svg viewBox="0 0 320 300" className="mx-auto block w-full max-w-[420px]" role="img" aria-labelledby={`${gid}-t`}>
        <title id={`${gid}-t`}>
          {`${mode === 'lean' ? 'Massa magra' : 'Gordura'} por segmento: ${SEGMENTS.map((s) => `${s.label} ${fmtNumber(values[s.key], decimals)} kg`).join(', ')}`}
        </title>
        <defs>
          <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
            {mode === 'lean' ? (
              <>
                <stop offset="0%" stopColor="#E8E8E8" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#9A9A9A" stopOpacity={0.35} />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#FFD700" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#F4952A" stopOpacity={0.4} />
              </>
            )}
          </linearGradient>
        </defs>

        <circle cx="160" cy="30" r="18" fill="#1E1E1E" stroke="#3A3A3A" strokeWidth="1.5" />
        {SEGMENTS.map((s) => {
          const shape = SHAPES[s.key];
          return (
            <path key={s.key} d={shape.d} fill={`url(#${gid}-g)`} stroke={mode === 'lean' ? '#C0C0C0' : '#F4952A'} strokeWidth="1.5" strokeLinejoin="round" />
          );
        })}

        {SEGMENTS.map((s) => {
          const shape = SHAPES[s.key];
          const delta = values[s.key] - base[s.key];
          // Melhorar = ganhar massa magra / perder gordura.
          const improved = mode === 'lean' ? delta > 0 : delta < 0;
          return (
            <g key={s.key}>
              {shape.lead && (
                <line x1={shape.lead[0]} y1={shape.lead[1]} x2={shape.lead[2]} y2={shape.lead[3]} stroke="#3A3A3A" strokeWidth="1" />
              )}
              <text
                x={shape.label.x}
                y={shape.label.y - 18}
                textAnchor={shape.label.anchor}
                fill="#9A9A9A"
                fontFamily="Barlow Condensed"
                fontWeight={600}
                fontSize="11"
                letterSpacing="1"
              >
                {s.short.toUpperCase()}
              </text>
              <text
                x={shape.label.x}
                y={shape.label.y + 2}
                textAnchor={shape.label.anchor}
                fill="#F5F5F5"
                fontFamily="Bebas Neue"
                fontSize="22"
              >
                {fmtNumber(values[s.key], decimals)}
                <tspan fontFamily="Barlow Condensed" fontSize="11" fill="#C0C0C0"> kg</tspan>
              </text>
              {showDelta && Math.abs(delta) > 1e-9 && (
                <text
                  x={shape.label.x}
                  y={shape.label.y + 16}
                  textAnchor={shape.label.anchor}
                  fill={improved ? '#FFD700' : '#F87171'}
                  fontFamily="Barlow Condensed"
                  fontWeight={600}
                  fontSize="12"
                >
                  {fmtDelta(delta, decimals)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
