import { useMemo } from 'react';
import {
  daysToRace,
  getPhases,
  isRecoveryWeek,
  phaseForWeek,
  sessionForDate,
  sessionsForWeek,
  totalWeeks,
  weekNumberFor,
} from '../lib/calendar';
import { todayISO } from '../lib/dates';
import { useSettings } from '../store/settings';

/** Situação do programa hoje: semana, fase, contagem regressiva e sessão do dia. */
export function useProgram() {
  const program = useSettings((s) => s.program);
  const today = todayISO();

  return useMemo(() => {
    const phases = getPhases(program);
    const total = totalWeeks(program);
    const rawWeek = weekNumberFor(program, today);
    const week = Math.min(Math.max(rawWeek, 1), total);
    const phase = phaseForWeek(phases, week);
    return {
      program,
      today,
      phases,
      totalWeeks: total,
      week,
      started: rawWeek >= 1 && today >= program.startDate,
      phase,
      recovery: isRecoveryWeek(phase, week),
      daysToRace: daysToRace(program, today),
      todaySession: sessionForDate(program, today),
      weekSessions: sessionsForWeek(program, week),
      /** 0–1 */
      progress: Math.min(Math.max((rawWeek - 1) / total, 0), 1),
    };
  }, [program, today]);
}
