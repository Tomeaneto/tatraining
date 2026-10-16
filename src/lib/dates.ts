import { format, parse } from 'date-fns';
import type { ISODate } from '../types';

const ISO = 'yyyy-MM-dd';

/** Converte Date → `yyyy-MM-dd` no fuso local. */
export function toISODate(date: Date): ISODate {
  return format(date, ISO);
}

/** Converte `yyyy-MM-dd` → Date à meia-noite local (sem o deslocamento de UTC). */
export function fromISODate(iso: ISODate): Date {
  return parse(iso, ISO, new Date());
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}
