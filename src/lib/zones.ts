import type { ZoneNumber } from '../types';

export interface ZoneDef {
  zone: ZoneNumber;
  name: string;
  /** Faixa em % da FC máx. */
  minPct: number;
  maxPct: number;
  color: string;
  feel: string;
}

// Cores do cinza ao dourado — iguais a `zone` no tailwind.config.
export const ZONES: ZoneDef[] = [
  { zone: 1, name: 'Recuperação', minPct: 50, maxPct: 60, color: '#6B6B6B', feel: 'Muito leve, respiração solta' },
  { zone: 2, name: 'Aeróbico', minPct: 60, maxPct: 70, color: '#9A9A9A', feel: 'Conversa fácil — base do triathlon' },
  { zone: 3, name: 'Tempo', minPct: 70, maxPct: 80, color: '#C9A66B', feel: 'Frases curtas, ritmo de prova longa' },
  { zone: 4, name: 'Limiar', minPct: 80, maxPct: 90, color: '#F4952A', feel: 'Difícil, poucas palavras' },
  { zone: 5, name: 'VO₂ máx', minPct: 90, maxPct: 100, color: '#FFD700', feel: 'Máximo, esforço curto' },
];

export const ZONE_COLORS = Object.fromEntries(ZONES.map((z) => [z.zone, z.color])) as Record<
  ZoneNumber,
  string
>;

export interface HrZone extends ZoneDef {
  minBpm: number;
  maxBpm: number;
}

export function hrZones(hrMax: number): HrZone[] {
  return ZONES.map((z) => ({
    ...z,
    minBpm: Math.round((hrMax * z.minPct) / 100),
    maxBpm: Math.round((hrMax * z.maxPct) / 100),
  }));
}

/** Zona correspondente a uma FC média. */
export function zoneForHr(hr: number, hrMax: number): ZoneNumber | null {
  const pct = (hr / hrMax) * 100;
  if (pct < 50) return null;
  const z = ZONES.find((zone) => pct < zone.maxPct) ?? ZONES[ZONES.length - 1];
  return z.zone;
}
