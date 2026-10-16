import { ZONE_COLORS } from '../../lib/zones';
import type { ZoneNumber } from '../../types';

export function ZoneBadge({ zone, className = '' }: { zone: ZoneNumber; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-display text-sm tracking-wider text-ta-bg ${className}`}
      style={{ backgroundColor: ZONE_COLORS[zone] }}
    >
      Z{zone}
    </span>
  );
}
