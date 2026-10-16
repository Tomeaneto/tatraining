import { Bike, Dumbbell, Flag, Moon, Repeat, Waves, Footprints, type LucideIcon } from 'lucide-react';
import type { Sport } from '../types';

export const SPORTS: Record<Sport, { label: string; icon: LucideIcon; color: string }> = {
  swim: { label: 'Natação', icon: Waves, color: '#C0C0C0' },
  bike: { label: 'Bike', icon: Bike, color: '#F4952A' },
  run: { label: 'Corrida', icon: Footprints, color: '#FFD700' },
  strength: { label: 'Força', icon: Dumbbell, color: '#7A7A7A' },
  brick: { label: 'Brick', icon: Repeat, color: '#E0B84E' },
  race: { label: 'Prova', icon: Flag, color: '#FFD700' },
  rest: { label: 'Descanso', icon: Moon, color: '#4A4A4A' },
};

/** Modalidades do triathlon usadas nos resumos de volume (brick conta como corrida). */
export type TriSport = 'swim' | 'bike' | 'run';

export function triSportOf(sport: Sport): TriSport | null {
  if (sport === 'swim' || sport === 'bike' || sport === 'run') return sport;
  if (sport === 'brick') return 'run';
  return null;
}
