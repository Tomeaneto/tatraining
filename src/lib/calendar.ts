import { addDays, differenceInCalendarDays, differenceInCalendarWeeks, startOfWeek } from 'date-fns';
import {
  PHASE_ORDER,
  PROGRAM,
  RACE_DAY,
  RECOVERY_EVERY,
  RECOVERY_FACTOR,
  type DayTemplate,
} from '../data/program';
import type { ISODate, Phase, ProgramSettings, Session, SessionBlock } from '../types';
import { fromISODate, toISODate } from './dates';

const WEEK_OPTS = { weekStartsOn: 1 } as const;

/** Segunda-feira da semana 1 (a semana que contém a data de início). */
export function programStart(settings: ProgramSettings): Date {
  return startOfWeek(fromISODate(settings.startDate), WEEK_OPTS);
}

/** Total de semanas do programa — a última é a semana da prova. */
export function totalWeeks(settings: ProgramSettings): number {
  const weeks =
    differenceInCalendarWeeks(fromISODate(settings.raceDate), programStart(settings), WEEK_OPTS) + 1;
  return Math.max(weeks, PHASE_ORDER.length);
}

/**
 * Distribui as semanas entre as 4 fases mantendo a proporção de `phaseWeeks`.
 * Cada fase recebe pelo menos 1 semana e a soma bate com o total.
 */
export function getPhases(settings: ProgramSettings): Phase[] {
  const total = totalWeeks(settings);
  const weights = settings.phaseWeeks;
  const sum = weights.reduce((a, b) => a + b, 0);
  const lengths = weights.map((w) => Math.max(1, Math.round((w / sum) * total)));
  // Ajusta o arredondamento na fase mais longa.
  let diff = total - lengths.reduce((a, b) => a + b, 0);
  while (diff !== 0) {
    const i = lengths.indexOf(Math.max(...lengths));
    const step = diff > 0 ? 1 : -1;
    lengths[i] += step;
    diff -= step;
  }

  let start = 1;
  return PHASE_ORDER.map((id, i) => {
    const phase: Phase = {
      id,
      name: PROGRAM[id].name,
      focus: PROGRAM[id].focus,
      startWeek: start,
      endWeek: start + lengths[i] - 1,
    };
    start += lengths[i];
    return phase;
  });
}

export function phaseForWeek(phases: Phase[], week: number): Phase {
  return phases.find((p) => week >= p.startWeek && week <= p.endWeek) ?? phases[phases.length - 1];
}

/** Semana do programa para uma data (pode ser < 1 antes do início ou > total depois da prova). */
export function weekNumberFor(settings: ProgramSettings, date: ISODate): number {
  return differenceInCalendarWeeks(fromISODate(date), programStart(settings), WEEK_OPTS) + 1;
}

export function weekStartDate(settings: ProgramSettings, week: number): Date {
  return addDays(programStart(settings), (week - 1) * 7);
}

export function isRecoveryWeek(phase: Phase, week: number): boolean {
  return phase.id !== 'peak' && week % RECOVERY_EVERY === 0;
}

export function daysToRace(settings: ProgramSettings, today: ISODate): number {
  return differenceInCalendarDays(fromISODate(settings.raceDate), fromISODate(today));
}

/** Arredonda para múltiplos de 5 minutos. */
function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

function buildBlocks(template: DayTemplate, progress: number, factor: number): SessionBlock[] {
  return template.blocks
    .map((b) => ({
      sport: b.sport,
      zone: b.zone,
      description: b.description,
      durationMin: round5((b.minutes[0] + (b.minutes[1] - b.minutes[0]) * progress) * factor),
    }))
    .filter((b) => b.durationMin > 0);
}

/** Sessões planejadas de uma semana (segunda a domingo). */
export function sessionsForWeek(settings: ProgramSettings, week: number): Session[] {
  const phases = getPhases(settings);
  const total = totalWeeks(settings);
  const w = Math.min(Math.max(week, 1), total);
  const phase = phaseForWeek(phases, w);
  const len = phase.endWeek - phase.startWeek;
  const progress = len === 0 ? 1 : (w - phase.startWeek) / len;
  const recovery = isRecoveryWeek(phase, w);
  const factor = recovery ? RECOVERY_FACTOR : 1;
  const monday = weekStartDate(settings, w);

  return PROGRAM[phase.id].days.map((template, dayIndex) => {
    const date = toISODate(addDays(monday, dayIndex));
    const isRace = date === settings.raceDate;
    const afterRace = date > settings.raceDate;
    const blocks: SessionBlock[] = isRace
      ? RACE_DAY.blocks.map((b) => ({ ...b }))
      : afterRace
        ? []
        : buildBlocks(template, progress, factor);
    return {
      date,
      weekNumber: w,
      dayIndex,
      title: isRace ? RACE_DAY.title : afterRace ? 'Descanso — pós-prova' : template.title,
      blocks,
      totalMin: blocks.reduce((s, b) => s + b.durationMin, 0),
      isRecoveryWeek: recovery,
      isRace,
    };
  });
}

/** Sessão planejada para uma data, ou `null` fora do programa. */
export function sessionForDate(settings: ProgramSettings, date: ISODate): Session | null {
  const week = weekNumberFor(settings, date);
  if (week < 1 || week > totalWeeks(settings) || date < settings.startDate) return null;
  return sessionsForWeek(settings, week).find((s) => s.date === date) ?? null;
}
