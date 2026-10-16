import { Decoder, Stream } from '@garmin/fitsdk';
import type { Sport } from '../../types';
import { toISODate } from '../dates';
import { sportFromName, type ImportResult, type ImportedWorkout } from './index';

/** Lê um .fit (atividade exportada do Garmin Connect) usando o SDK oficial da Garmin. */
export function parseFit(fileName: string, buffer: ArrayBuffer, fallback: Sport): ImportResult {
  const decoder = new Decoder(Stream.fromArrayBuffer(buffer));
  if (!decoder.isFIT()) throw new Error('Arquivo .fit inválido.');
  const { messages, errors } = decoder.read();
  const sessions = messages.sessionMesgs ?? [];
  if (!sessions.length) {
    throw new Error(errors[0]?.message ?? 'Nenhuma sessão de atividade encontrada no arquivo.');
  }

  let guessed = 0;
  // Multisport (ex.: brick) vira um treino por sessão; transições são ignoradas.
  const workouts: ImportedWorkout[] = [];
  sessions.forEach((s, i) => {
    const sportName = String(s.sport ?? '');
    if (sportName === 'transition') return;
    let sport = sportFromName(sportName) ?? sportFromName(String(s.subSport ?? ''));
    if (!sport) {
      sport = fallback;
      guessed++;
    }
    const start = s.startTime instanceof Date ? s.startTime : new Date(String(s.startTime));
    const seconds = Number(s.totalTimerTime ?? s.totalElapsedTime ?? 0);
    const meters = Number(s.totalDistance ?? 0);
    workouts.push({
      date: toISODate(start),
      sport,
      durationMin: Math.round(seconds / 60),
      distanceKm: meters ? Math.round(meters) / 1000 : undefined,
      avgHr: s.avgHeartRate ? Math.round(Number(s.avgHeartRate)) : undefined,
      name: fileName.replace(/\.fit$/i, ''),
      source: 'garmin',
      externalId: `fit:${start.toISOString()}:${i}`,
    });
  });

  return { file: fileName, workouts, guessed };
}
