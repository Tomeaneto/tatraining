import { useBody } from '../store/body';
import { useSettings } from '../store/settings';
import { useStrava } from '../store/strava';
import { useWorkouts } from '../store/workouts';
import type { Athlete, BodyComposition, ProgramSettings, Workout } from '../types';
import { todayISO } from './dates';

const FORMAT = 'ta-triathlon-backup';
const VERSION = 1;

export interface Backup {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  athlete: Athlete;
  program: ProgramSettings;
  workouts: Workout[];
  assessments: BodyComposition[];
}

/** Monta o backup (sem tokens do Strava — reconecte após restaurar). */
export function buildBackup(): Backup {
  const { athlete, program } = useSettings.getState();
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    athlete,
    program,
    workouts: useWorkouts.getState().workouts,
    assessments: useBody.getState().assessments,
  };
}

export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ta-triathlon-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Valida e lê um backup. Lança erro com mensagem amigável se o arquivo não servir. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  const b = data as Partial<Backup>;
  if (b?.format !== FORMAT) throw new Error('Este arquivo não é um backup do TA Triathlon.');
  if (typeof b.version !== 'number' || b.version > VERSION) throw new Error('Versão de backup não suportada.');
  if (!b.athlete || !b.program || !Array.isArray(b.workouts) || !Array.isArray(b.assessments)) {
    throw new Error('Backup incompleto.');
  }
  if (!b.assessments.length) throw new Error('O backup não tem avaliações (a linha de base é obrigatória).');
  return b as Backup;
}

export function restoreBackup(b: Backup): void {
  useSettings.setState({ athlete: b.athlete, program: b.program });
  useWorkouts.setState({ workouts: b.workouts });
  useBody.setState({ assessments: [...b.assessments].sort((x, y) => x.date.localeCompare(y.date)) });
}

/** Volta tudo ao estado inicial (linha de base do InBody, sem treinos, Strava desconectado). */
export function resetAll(): void {
  useSettings.getState().reset();
  useWorkouts.getState().reset();
  useBody.getState().reset();
  useStrava.getState().disconnect();
}
