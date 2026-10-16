import type { Phase } from '../../types';

type Props = {
  phases: Phase[];
  currentWeek: number;
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
};

/** Linha do tempo horizontal das 4 fases, com largura proporcional às semanas. */
export function PhaseTimeline({ phases, currentWeek, selectedWeek, onSelectWeek }: Props) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <ol className="flex min-w-[560px] gap-2">
        {phases.map((p, i) => {
          const weeks = p.endWeek - p.startWeek + 1;
          const isCurrent = currentWeek >= p.startWeek && currentWeek <= p.endWeek;
          const isSelected = selectedWeek >= p.startWeek && selectedWeek <= p.endWeek;
          const markerPct = isCurrent ? ((currentWeek - p.startWeek + 0.5) / weeks) * 100 : null;
          return (
            <li key={p.id} style={{ flexGrow: weeks, flexBasis: 0 }} className="min-w-[120px]">
              <button
                type="button"
                onClick={() => onSelectWeek(isCurrent ? currentWeek : p.startWeek)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`relative flex h-full min-h-[96px] w-full flex-col rounded-card border p-3 text-left transition-colors ${
                  isCurrent
                    ? 'border-ta-gold bg-ta-card2 shadow-glow'
                    : isSelected
                      ? 'border-ta-silver/50 bg-ta-card2'
                      : 'border-ta-border bg-ta-card hover:border-ta-gold/50'
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ta-muted">Fase {i + 1}</span>
                <span className={`font-display text-2xl leading-tight ${isCurrent ? 'text-ta-gold' : 'text-ta-text'}`}>
                  {p.name}
                </span>
                <span className="text-sm text-ta-muted tabular">
                  Sem. {p.startWeek}–{p.endWeek} · {weeks} sem.
                </span>
                <span className="mt-auto block h-1.5 w-full overflow-hidden rounded-full bg-ta-border pt-0">
                  {markerPct !== null && (
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-ta-gold to-ta-yellow"
                      style={{ width: `${markerPct}%` }}
                    />
                  )}
                  {currentWeek > p.endWeek && <span className="block h-full w-full rounded-full bg-ta-gold/60" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
