import { addMonths } from 'date-fns';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_ATHLETE } from '../data/baseline';
import { DEFAULT_PHASE_WEEKS } from '../data/program';
import { toISODate } from '../lib/dates';
import type { Athlete, ProgramSettings } from '../types';
import { persistDefaults } from './persistDefaults';

interface SettingsState {
  athlete: Athlete;
  program: ProgramSettings;
  setAthlete: (patch: Partial<Athlete>) => void;
  setProgram: (patch: Partial<ProgramSettings>) => void;
  reset: () => void;
}

function defaultProgram(): ProgramSettings {
  const start = new Date();
  return {
    startDate: toISODate(start),
    raceDate: toISODate(addMonths(start, 12)),
    phaseWeeks: [...DEFAULT_PHASE_WEEKS],
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      athlete: DEFAULT_ATHLETE,
      program: defaultProgram(),
      setAthlete: (patch) => set((s) => ({ athlete: { ...s.athlete, ...patch } })),
      setProgram: (patch) => set((s) => ({ program: { ...s.program, ...patch } })),
      reset: () => set({ athlete: DEFAULT_ATHLETE, program: defaultProgram() }),
    }),
    { name: 'ta-settings', version: 1 },
  ),
);

// Grava os padrões já no primeiro acesso: sem isso a data de início ("hoje")
// seria recalculada a cada dia até o usuário editar algo.
persistDefaults(useSettings);
