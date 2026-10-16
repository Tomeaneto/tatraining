import { fmtDuration } from '../lib/format';
import { SPORTS } from '../lib/sports';
import type { SessionBlock } from '../types';
import { ZoneBadge } from './ui/ZoneBadge';

/** Lista dos blocos de uma sessão (modalidade, duração, zona e descrição). */
export function SessionBlockList({ blocks, compact = false }: { blocks: SessionBlock[]; compact?: boolean }) {
  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'}>
      {blocks.map((b, i) => {
        const S = SPORTS[b.sport];
        return (
          <li key={i} className="flex gap-3">
            <S.icon size={compact ? 18 : 22} className="mt-0.5 shrink-0" style={{ color: S.color }} aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {S.label}
                {b.durationMin > 0 && <> · {fmtDuration(b.durationMin)}</>}
                <ZoneBadge zone={b.zone} />
              </div>
              <p className="text-sm text-ta-muted">{b.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
