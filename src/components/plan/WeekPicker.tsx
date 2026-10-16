import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isRecoveryWeek, phaseForWeek } from '../../lib/calendar';
import type { Phase } from '../../types';

type Props = {
  phases: Phase[];
  totalWeeks: number;
  currentWeek: number;
  selectedWeek: number;
  onChange: (week: number) => void;
};

/** Faixa rolável com as semanas do programa + botões anterior/próxima. */
export function WeekPicker({ phases, totalWeeks, currentWeek, selectedWeek, onChange }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-week="${selectedWeek}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedWeek]);

  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const navBtn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ta-border bg-ta-card text-ta-text disabled:opacity-30';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={navBtn}
        onClick={() => onChange(selectedWeek - 1)}
        disabled={selectedWeek <= 1}
        aria-label="Semana anterior"
      >
        <ChevronLeft size={20} />
      </button>
      <div ref={stripRef} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]" role="tablist" aria-label="Semanas do programa">
        {weeks.map((w) => {
          const selected = w === selectedWeek;
          const isCurrent = w === currentWeek;
          const recovery = isRecoveryWeek(phaseForWeek(phases, w), w);
          return (
            <button
              key={w}
              type="button"
              role="tab"
              data-week={w}
              aria-selected={selected}
              aria-label={`Semana ${w}${recovery ? ', recuperação' : ''}${isCurrent ? ', atual' : ''}`}
              onClick={() => onChange(w)}
              className={`relative flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border font-display text-xl tabular transition-colors ${
                selected
                  ? 'border-ta-gold bg-ta-gold text-ta-bg'
                  : isCurrent
                    ? 'border-ta-gold text-ta-gold'
                    : 'border-ta-border bg-ta-card text-ta-muted hover:text-ta-text'
              }`}
            >
              {w}
              {recovery && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? 'bg-ta-bg' : 'bg-ta-yellow'}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={navBtn}
        onClick={() => onChange(selectedWeek + 1)}
        disabled={selectedWeek >= totalWeeks}
        aria-label="Próxima semana"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
