type Props = {
  /** 0–1 */
  value: number;
  label?: string;
  className?: string;
};

export function ProgressBar({ value, label, className = '' }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-ta-border ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-ta-gold to-ta-yellow"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
