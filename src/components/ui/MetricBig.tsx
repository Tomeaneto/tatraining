import type { ReactNode } from 'react';

type Props = {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: 'default' | 'gold' | 'yellow';
  size?: 'md' | 'lg' | 'xl';
};

const tones = { default: 'text-ta-text', gold: 'text-ta-gold', yellow: 'text-ta-yellow' };
const sizes = { md: 'text-3xl', lg: 'text-5xl', xl: 'text-7xl' };

export function MetricBig({ label, value, unit, hint, tone = 'default', size = 'md' }: Props) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ta-muted">{label}</div>
      <div className={`font-display leading-none tabular ${sizes[size]} ${tones[tone]}`}>
        {value}
        {unit && <span className="ml-1 font-sans text-base font-medium text-ta-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-sm text-ta-muted">{hint}</div>}
    </div>
  );
}
