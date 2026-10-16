import { Pencil, Trash2 } from 'lucide-react';
import { fmtBpm, fmtDate, fmtDuration, fmtKm } from '../../lib/format';
import { SPORTS } from '../../lib/sports';
import type { Workout, WorkoutSource } from '../../types';

const SOURCE_BADGE: Record<WorkoutSource, { label: string; className: string } | null> = {
  manual: null,
  plan: { label: 'Plano', className: 'border-ta-silver/40 text-ta-silver' },
  strava: { label: 'Strava', className: 'border-ta-gold/60 bg-ta-gold/10 text-ta-gold' },
  garmin: { label: 'Garmin', className: 'border-ta-silver/40 text-ta-silver' },
};

type Props = {
  workouts: Workout[];
  onEdit: (w: Workout) => void;
  onRemove: (w: Workout) => void;
};

export function WorkoutList({ workouts, onEdit, onRemove }: Props) {
  if (!workouts.length) {
    return <p className="py-6 text-center text-ta-muted">Nenhum treino registrado ainda.</p>;
  }
  return (
    <ul className="divide-y divide-ta-border">
      {workouts.map((w) => {
        const S = SPORTS[w.sport];
        const badge = SOURCE_BADGE[w.source];
        const stats = [
          fmtDuration(w.durationMin),
          w.distanceKm ? fmtKm(w.distanceKm, w.distanceKm < 10 ? 2 : 1) : null,
          w.avgHr ? fmtBpm(w.avgHr) : null,
          w.rpe ? `RPE ${w.rpe}` : null,
        ].filter(Boolean);
        return (
          <li key={w.id} className="flex items-start gap-3 py-3">
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ta-card2"
              aria-hidden
            >
              <S.icon size={20} style={{ color: S.color }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{w.name || S.label}</span>
                {badge && (
                  <span className={`rounded-md border px-1.5 text-xs font-semibold uppercase tracking-wider ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <div className="text-sm text-ta-muted">
                {fmtDate(w.date, "EEE, d 'de' MMM")} · {S.label}
              </div>
              <div className="flex flex-wrap gap-x-3 font-display text-lg tracking-wide tabular">
                {stats.map((s, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {s}
                  </span>
                ))}
              </div>
              {w.notes && <p className="line-clamp-2 text-sm text-ta-muted">{w.notes}</p>}
            </div>
            <div className="flex shrink-0">
              <button
                type="button"
                onClick={() => onEdit(w)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-ta-muted hover:text-ta-gold"
                aria-label={`Editar treino de ${fmtDate(w.date)}`}
              >
                <Pencil size={18} />
              </button>
              <button
                type="button"
                onClick={() => onRemove(w)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-ta-muted hover:text-red-400"
                aria-label={`Excluir treino de ${fmtDate(w.date)}`}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
