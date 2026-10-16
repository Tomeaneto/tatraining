import type { ISODate, Session, Workout } from '../types';
import { triSportOf, type TriSport } from './sports';

export interface WeekSummary {
  planned: number;
  done: number;
  /** Minutos por modalidade do triathlon. */
  plannedMin: Record<TriSport, number>;
  doneMin: Record<TriSport, number>;
}

const zero = (): Record<TriSport, number> => ({ swim: 0, bike: 0, run: 0 });

/**
 * Resumo da semana. Uma sessão conta como feita se foi marcada no plano
 * ou se existe qualquer treino registrado naquela data.
 */
export function summarizeWeek(sessions: Session[], workouts: Workout[], startDate: ISODate): WeekSummary {
  const active = sessions.filter((s) => s.blocks.length > 0 && s.date >= startDate);
  const first = sessions[0]?.date ?? '';
  const last = sessions[sessions.length - 1]?.date ?? '';
  const inWeek = workouts.filter((w) => w.date >= first && w.date <= last);
  const datesWithWorkout = new Set(inWeek.map((w) => w.plannedDate ?? w.date));

  const plannedMin = zero();
  for (const s of active) {
    for (const b of s.blocks) {
      const t = triSportOf(b.sport);
      if (t) plannedMin[t] += b.durationMin;
    }
  }

  const doneMin = zero();
  for (const w of inWeek) {
    const t = triSportOf(w.sport);
    if (t) doneMin[t] += w.durationMin;
  }

  return {
    planned: active.length,
    done: active.filter((s) => datesWithWorkout.has(s.date)).length,
    plannedMin,
    doneMin,
  };
}
