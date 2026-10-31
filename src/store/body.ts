import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BASELINE } from '../data/baseline';
import { newId, toUuid } from '../lib/id';
import type { BodyComposition } from '../types';
import { persistDefaults } from './persistDefaults';

interface BodyState {
  /** Ordenado por data crescente; o primeiro é a linha de base. */
  assessments: BodyComposition[];
  add: (a: Omit<BodyComposition, 'id'>) => void;
  update: (id: string, patch: Partial<BodyComposition>) => void;
  /** A linha de base pode ser editada, mas não removida. */
  remove: (id: string) => void;
  reset: () => void;
}

const byDateAsc = (a: BodyComposition, b: BodyComposition) => a.date.localeCompare(b.date);

export const useBody = create<BodyState>()(
  persist(
    (set) => ({
      assessments: [BASELINE],
      add: (a) => set((s) => ({ assessments: [...s.assessments, { ...a, id: newId() }].sort(byDateAsc) })),
      update: (id, patch) =>
        set((s) => ({
          assessments: s.assessments.map((a) => (a.id === id ? { ...a, ...patch } : a)).sort(byDateAsc),
        })),
      remove: (id) =>
        set((s) => ({ assessments: s.assessments.filter((a) => a.id !== id || a.isBaseline) })),
      // Mantém o id da linha de base: no Supabase ela é uma linha só, criada no cadastro.
      reset: () => set((s) => ({ assessments: [{ ...BASELINE, id: selectBaseline(s.assessments).id }] })),
    }),
    {
      name: 'ta-body',
      version: 2,
      // v2: ids viram UUID (o formato das linhas no Supabase). A linha de base mantém o seu.
      migrate: (persisted, version) => {
        const s = persisted as { assessments?: BodyComposition[] };
        if (version < 2 && s.assessments) {
          s.assessments = s.assessments.map((a) => (a.isBaseline ? a : { ...a, id: toUuid(a.id) }));
        }
        return s as BodyState;
      },
    },
  ),
);

persistDefaults(useBody);

export function selectBaseline(assessments: BodyComposition[]): BodyComposition {
  return assessments.find((a) => a.isBaseline) ?? assessments[0] ?? BASELINE;
}

export function selectLatest(assessments: BodyComposition[]): BodyComposition {
  return assessments[assessments.length - 1] ?? BASELINE;
}
