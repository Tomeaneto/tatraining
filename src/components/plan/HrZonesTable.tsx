import { Link } from 'react-router-dom';
import { hrZones } from '../../lib/zones';
import type { Athlete } from '../../types';
import { ZoneBadge } from '../ui/ZoneBadge';

export function HrZonesTable({ athlete }: { athlete: Athlete }) {
  const zones = hrZones(athlete.hrMax);
  return (
    <>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-ta-muted">
          FC máx.{' '}
          <span className="font-display text-2xl text-ta-text tabular">{athlete.hrMax}</span> bpm
        </span>
        <Link to="/conectar" className="-mr-2 min-h-[44px] min-w-[44px] content-center px-2 text-center text-sm font-semibold uppercase tracking-wider text-ta-gold">
          Editar
        </Link>
      </div>
      <table className="w-full border-separate border-spacing-y-1.5 text-left">
        <caption className="sr-only">Zonas de frequência cardíaca</caption>
        <thead>
          <tr className="text-xs uppercase tracking-[0.12em] text-ta-muted">
            <th scope="col" className="font-semibold">Zona</th>
            <th scope="col" className="font-semibold">% FC máx.</th>
            <th scope="col" className="text-right font-semibold">bpm</th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.zone}>
              <td className="py-1 pr-2 align-top">
                <div className="flex items-center gap-2">
                  <ZoneBadge zone={z.zone} />
                  <span className="font-semibold">{z.name}</span>
                </div>
                <div className="text-sm text-ta-muted">{z.feel}</div>
              </td>
              <td className="py-1 align-top tabular text-ta-muted">
                {z.minPct}–{z.maxPct}%
              </td>
              <td className="py-1 text-right align-top font-display text-xl tabular" style={{ color: z.zone >= 4 ? z.color : undefined }}>
                {z.minBpm}–{z.maxBpm}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {athlete.hrMaxSource === 'estimated' && (
        <p className="mt-2 text-sm text-ta-muted">
          Estimada pela fórmula de Tanaka (208 − 0,7 × idade). O ideal é substituir pelo valor de um teste de esforço.
        </p>
      )}
    </>
  );
}
