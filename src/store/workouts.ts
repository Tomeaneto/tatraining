import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { newId } from '../lib/id';
import type { ISODate, Session, Workout } from '../types';

interface WorkoutsState {
  workouts: Workout[];
  add: (w: Omit<Workout, 'id'>) => void;
  update: (id: string, patch: Partial<Workout>) => void;
  remove: (id: string) => void;
  /** Importa em lote ignorando os que já existem (mesma origem + externalId). Retorna quantos entraram. */
  importMany: (list: Omit<Workout, 'id'>[]) => number;
  /** Registra a sessão planejada como feita (um treino por bloco). */
  completeSession: (session: Session) => void;
  /** Desfaz o "marcar como feito". */
  uncompleteSession: (date: ISODate) => void;
  reset: () => void;
}

const byDateDesc = (a: Workout, b: Workout) => b.date.localeCompare(a.date);

export const useWorkouts = create<WorkoutsState>()(
  persist(
    (set, get) => ({
      workouts: [],
      add: (w) => set((s) => ({ workouts: [{ ...w, id: newId('w') }, ...s.workouts].sort(byDateDesc) })),
      update: (id, patch) =>
        set((s) => ({ workouts: s.workouts.map((w) => (w.id === id ? { ...w, ...patch } : w)).sort(byDateDesc) })),
      remove: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
      importMany: (list) => {
        const seen = new Set(get().workouts.map((w) => `${w.source}:${w.externalId}`));
        const fresh = list
          .filter((w) => !w.externalId || !seen.has(`${w.source}:${w.externalId}`))
          .map((w) => ({ ...w, id: newId('w') }));
        if (fresh.length) set((s) => ({ workouts: [...fresh, ...s.workouts].sort(byDateDesc) }));
        return fresh.length;
      },
      completeSession: (session) => {
        if (get().workouts.some((w) => w.plannedDate === session.date)) return;
        const done: Workout[] = session.blocks.map((b) => ({
          id: newId('w'),
          date: session.date,
          sport: b.sport,
          durationMin: b.durationMin,
          name: session.title,
          notes: b.description,
          source: 'plan',
          plannedDate: session.date,
        }));
        set((s) => ({ workouts: [...done, ...s.workouts].sort(byDateDesc) }));
      },
      uncompleteSession: (date) =>
        set((s) => ({ workouts: s.workouts.filter((w) => !(w.source === 'plan' && w.plannedDate === date)) })),
      reset: () => set({ workouts: [] }),
    }),
    { name: 'ta-workouts', version: 1 },
  ),
);

/** Datas planejadas já cumpridas (por "marcar como feito" ou treino vinculado). */
export function completedDates(workouts: Workout[]): Set<ISODate> {
  return new Set(workouts.filter((w) => w.plannedDate).map((w) => w.plannedDate!));
}
