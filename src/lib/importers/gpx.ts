import type { Sport } from '../../types';
import { toISODate } from '../dates';
import { sportFromName, type ImportResult } from './index';

/** Distância em metros entre dois pontos (fórmula de haversine). */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Lê um .gpx: distância pelo traçado, duração pelo 1º e último ponto, FC média das extensões. */
export function parseGpx(fileName: string, xml: string, fallback: Sport): ImportResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Arquivo .gpx inválido.');

  const points = Array.from(doc.getElementsByTagName('trkpt'));
  if (points.length < 2) throw new Error('O .gpx não tem pontos de trajeto suficientes.');

  let meters = 0;
  let hrSum = 0;
  let hrCount = 0;
  let first: Date | null = null;
  let last: Date | null = null;
  let prev: { lat: number; lon: number } | null = null;

  for (const p of points) {
    const lat = Number(p.getAttribute('lat'));
    const lon = Number(p.getAttribute('lon'));
    if (prev) meters += haversine(prev.lat, prev.lon, lat, lon);
    prev = { lat, lon };

    const time = p.getElementsByTagName('time')[0]?.textContent;
    if (time) {
      const t = new Date(time);
      if (!first) first = t;
      last = t;
    }
    // Garmin usa <gpxtpx:hr> dentro de <extensions>; getElementsByTagName com prefixo cobre o caso comum.
    const hrEl = p.getElementsByTagName('gpxtpx:hr')[0] ?? p.getElementsByTagNameNS('*', 'hr')[0];
    const hr = Number(hrEl?.textContent);
    if (hr > 0) {
      hrSum += hr;
      hrCount++;
    }
  }

  if (!first || !last) throw new Error('O .gpx não tem horários nos pontos.');

  const typeText = doc.querySelector('trk > type')?.textContent ?? doc.querySelector('trk > name')?.textContent;
  let sport = sportFromName(typeText);
  const guessed = sport ? 0 : 1;
  sport ??= fallback;

  return {
    file: fileName,
    guessed,
    workouts: [
      {
        date: toISODate(first),
        sport,
        durationMin: Math.round((last.getTime() - first.getTime()) / 60000),
        distanceKm: Math.round(meters) / 1000,
        avgHr: hrCount ? Math.round(hrSum / hrCount) : undefined,
        name: doc.querySelector('trk > name')?.textContent?.trim() || fileName.replace(/\.gpx$/i, ''),
        source: 'garmin',
        externalId: `gpx:${first.toISOString()}`,
      },
    ],
  };
}
