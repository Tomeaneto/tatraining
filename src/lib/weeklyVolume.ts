import { addWeeks, startOfWeek } from 'date-fns';
import type { Workout } from '../types';
import { fromISODate, toISODate } from './dates';

export type VolumeKey = 'swim' | 'bike' | 'run' | 'strength';
export const VOLUME_KEYS: VolumeKey[] = ['swim', 'bike', 'run', 'strength'];

export interface WeekVolume {
  /** Segunda-feira da semana (yyyy-MM-dd). */
  weekStart: string;
  /** Horas por modalidade. */
  swim: number;
  bike: number;
  run: number;
  strength: number;
  total: number;
}

function volumeKey(sport: Workout['sport']): VolumeKey | null {
  if (sport === 'swim' || sport === 'bike' || sport === 'run' || sport === 'strength') return sport;
  if (sport === 'brick') return 'run';
  return null;
}

/** Horas por modalidade nas últimas `weeks` semanas (segunda a domingo), terminando na semana de `today`. */
export function weeklyVolume(workouts: Workout[], today: string, weeks = 12): WeekVolume[] {
  const lastMonday = startOfWeek(fromISODate(today), { weekStartsOn: 1 });
  const buckets: WeekVolume[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: toISODate(addWeeks(lastMonday, i - weeks + 1)),
    swim: 0,
    bike: 0,
    run: 0,
    strength: 0,
    total: 0,
  }));
  const index = new Map(buckets.map((b, i) => [b.weekStart, i]));

  for (const w of workouts) {
    const key = volumeKey(w.sport);
    if (!key) continue;
    const monday = toISODate(startOfWeek(fromISODate(w.date), { weekStartsOn: 1 }));
    const i = index.get(monday);
    if (i === undefined) continue;
    const h = w.durationMin / 60;
    buckets[i][key] += h;
    buckets[i].total += h;
  }
  return buckets;
}
