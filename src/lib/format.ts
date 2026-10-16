import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ISODate } from '../types';
import { fromISODate } from './dates';

const nfCache = new Map<number, Intl.NumberFormat>();

/** Número no padrão brasileiro (vírgula decimal, ponto de milhar). */
export function fmtNumber(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  let nf = nfCache.get(decimals);
  if (!nf) {
    nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    nfCache.set(decimals, nf);
  }
  return nf.format(value);
}

/** Lê número digitado no padrão brasileiro ("1.234,5" ou "12,5"). Vazio → undefined. */
export function parseDecimal(input: string): number | undefined {
  const s = input.trim();
  if (!s) return undefined;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

/** Número para preencher um campo de texto (vírgula decimal, sem milhar). */
export function toInputDecimal(value: number | undefined): string {
  return value == null ? '' : String(value).replace('.', ',');
}

/** Com sinal explícito (+/−), útil para variações. */
export function fmtDelta(value: number, decimals = 1): string {
  const s = fmtNumber(Math.abs(value), decimals);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return s;
}

export const fmtKg = (v: number | null | undefined, d = 1) => `${fmtNumber(v, d)} kg`;
export const fmtKm = (v: number | null | undefined, d = 1) => `${fmtNumber(v, d)} km`;
export const fmtBpm = (v: number | null | undefined) => `${fmtNumber(v, 0)} bpm`;
export const fmtPct = (v: number | null | undefined, d = 1) => `${fmtNumber(v, d)}%`;

/** Minutos → "45 min", "1h", "1h30". */
export function fmtDuration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, '0')}`;
}

/** Minutos → horas decimais "3,5 h". */
export const fmtHours = (min: number, d = 1) => `${fmtNumber(min / 60, d)} h`;

export function fmtDate(iso: ISODate, pattern = "d 'de' MMM yyyy"): string {
  return format(fromISODate(iso), pattern, { locale: ptBR });
}

export function fmtWeekday(iso: ISODate): string {
  return format(fromISODate(iso), 'EEEE', { locale: ptBR });
}
