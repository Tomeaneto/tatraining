import type { Sport, Workout } from '../../types';

export type ImportedWorkout = Omit<Workout, 'id'>;

export interface ImportResult {
  file: string;
  workouts: ImportedWorkout[];
  /** Atividades cuja modalidade não foi reconhecida (receberam a modalidade padrão). */
  guessed: number;
  error?: string;
}

/** Mapeia nomes de esporte (FIT, GPX, CSV — inglês e português) para a modalidade do app. */
export function sportFromName(raw: string | undefined | null): Sport | null {
  const s = (raw ?? '').toLowerCase();
  if (!s) return null;
  if (/swim|nata|piscina|open.?water|águas/.test(s)) return 'swim';
  if (/cycl|bike|ride|bici|ciclis|pedal|biking/.test(s)) return 'bike';
  if (/run|corrid|trail|treadmill|esteira/.test(s)) return 'run';
  if (/strength|training|força|forca|muscula|cardio|hiit|gym/.test(s)) return 'strength';
  if (/multisport|triathlon|brick|transition|transi/.test(s)) return 'brick';
  return null;
}

/** Lê uma lista de arquivos e devolve os treinos encontrados em cada um. */
export async function importFiles(files: File[], fallback: Sport): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'fit') {
        const { parseFit } = await import('./fit');
        results.push(parseFit(file.name, await file.arrayBuffer(), fallback));
      } else if (ext === 'gpx') {
        const { parseGpx } = await import('./gpx');
        results.push(parseGpx(file.name, await file.text(), fallback));
      } else if (ext === 'csv') {
        const { parseCsv } = await import('./csv');
        results.push(parseCsv(file.name, await file.text(), fallback));
      } else {
        results.push({ file: file.name, workouts: [], guessed: 0, error: 'Formato não suportado (use .fit, .gpx ou .csv).' });
      }
    } catch (e) {
      results.push({ file: file.name, workouts: [], guessed: 0, error: e instanceof Error ? e.message : 'Falha ao ler o arquivo.' });
    }
  }
  return results;
}
