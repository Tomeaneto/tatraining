import type { Sport } from '../../types';
import { sportFromName, type ImportResult, type ImportedWorkout } from './index';

/** Parser de CSV com suporte a aspas e vírgula ou ponto e vírgula como separador. */
function parseRows(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Nomes de coluna aceitos (export do Garmin Connect em inglês ou português). */
const COLUMNS = {
  type: ['activity type', 'tipo de atividade', 'tipo'],
  date: ['date', 'data', 'start time', 'hora de inicio'],
  title: ['title', 'titulo', 'nome'],
  distance: ['distance', 'distancia'],
  time: ['time', 'tempo', 'duration', 'duracao', 'moving time', 'tempo em movimento'],
  hr: ['avg hr', 'fc media', 'frequencia cardiaca media', 'average heart rate'],
};

function findCol(header: string[], names: string[]): number {
  return header.findIndex((h) => names.includes(norm(h)));
}

/** "1:02:03", "45:12", "00:45:12.3" → minutos. */
function parseTime(s: string): number | undefined {
  const parts = s.trim().split(':').map((p) => Number(p.replace(',', '.')));
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return undefined;
  const [h, m, sec] = parts.length === 3 ? parts : [0, parts[0], parts[1] ?? 0];
  return h * 60 + m + sec / 60;
}

/** Número em formato EN ("1,234.5") ou BR ("1.234,5"). */
function parseNumber(s: string, decimalComma: boolean): number | undefined {
  const t = s.trim();
  if (!t || t === '--') return undefined;
  const n = decimalComma ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** "2024-05-01 07:12:00" ou "01/05/2024 07:12" → yyyy-MM-dd. */
function parseDate(s: string): string | undefined {
  const t = s.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return undefined;
}

/** Lê o CSV de atividades exportado do Garmin Connect (lista de atividades). */
export function parseCsv(fileName: string, text: string, fallback: Sport): ImportResult {
  const rows = parseRows(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('CSV vazio.');
  const header = rows[0];
  const col = {
    type: findCol(header, COLUMNS.type),
    date: findCol(header, COLUMNS.date),
    title: findCol(header, COLUMNS.title),
    distance: findCol(header, COLUMNS.distance),
    time: findCol(header, COLUMNS.time),
    hr: findCol(header, COLUMNS.hr),
  };
  if (col.date < 0 || col.time < 0) {
    throw new Error('Colunas de data e tempo não encontradas. Use o CSV da lista de atividades do Garmin Connect.');
  }
  // Cabeçalho em português → números com vírgula decimal.
  const decimalComma = ['data', 'tempo', 'distancia'].includes(norm(header[col.date])) || norm(header[col.time]) === 'tempo';

  let guessed = 0;
  const workouts: ImportedWorkout[] = [];
  for (const r of rows.slice(1)) {
    const date = parseDate(r[col.date] ?? '');
    const minutes = parseTime(r[col.time] ?? '');
    if (!date || !minutes) continue;
    let sport = sportFromName(col.type >= 0 ? r[col.type] : col.title >= 0 ? r[col.title] : '');
    if (!sport) {
      sport = fallback;
      guessed++;
    }
    let km = col.distance >= 0 ? parseNumber(r[col.distance] ?? '', decimalComma) : undefined;
    // Natação no Garmin vem em metros.
    if (sport === 'swim' && km && km > 50) km = km / 1000;
    const hr = col.hr >= 0 ? parseNumber(r[col.hr] ?? '', decimalComma) : undefined;
    const title = col.title >= 0 ? r[col.title]?.trim() : undefined;
    workouts.push({
      date,
      sport,
      durationMin: Math.round(minutes),
      distanceKm: km || undefined,
      avgHr: hr ? Math.round(hr) : undefined,
      name: title || undefined,
      source: 'garmin',
      externalId: `csv:${r[col.date]?.trim()}:${title ?? ''}`,
    });
  }
  return { file: fileName, workouts, guessed };
}
