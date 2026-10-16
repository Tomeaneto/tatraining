import { useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { Check } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { SessionBlockList } from '../components/SessionBlockList';
import { HrZonesTable } from '../components/plan/HrZonesTable';
import { PhaseTimeline } from '../components/plan/PhaseTimeline';
import { WeekPicker } from '../components/plan/WeekPicker';
import { Card, CardTitle } from '../components/ui/Card';
import { DAY_NAMES } from '../data/program';
import { useProgram } from '../hooks/useProgram';
import { isRecoveryWeek, phaseForWeek, sessionsForWeek, weekStartDate } from '../lib/calendar';
import { toISODate } from '../lib/dates';
import { fmtDate, fmtDuration, fmtHours } from '../lib/format';
import { SPORTS, type TriSport } from '../lib/sports';
import { summarizeWeek } from '../lib/weekSummary';
import { useSettings } from '../store/settings';
import { completedDates, useWorkouts } from '../store/workouts';

const TRI: TriSport[] = ['swim', 'bike', 'run'];

export function Plano() {
  const p = useProgram();
  const athlete = useSettings((s) => s.athlete);
  const workouts = useWorkouts((s) => s.workouts);
  const [week, setWeek] = useState(p.week);

  const sessions = useMemo(() => sessionsForWeek(p.program, week), [p.program, week]);
  const phase = phaseForWeek(p.phases, week);
  const recovery = isRecoveryWeek(phase, week);
  const done = useMemo(() => completedDates(workouts), [workouts]);
  const summary = useMemo(() => summarizeWeek(sessions, workouts, p.program.startDate), [sessions, workouts, p.program.startDate]);
  const monday = weekStartDate(p.program, week);

  return (
    <>
      <PageHeader title="Plano" subtitle={`${p.totalWeeks} semanas · 4 fases`} />
      <div className="space-y-4">
        <PhaseTimeline phases={p.phases} currentWeek={p.week} selectedWeek={week} onSelectWeek={setWeek} />

        <section aria-labelledby="semana-titulo" className="space-y-3">
          <WeekPicker
            phases={p.phases}
            totalWeeks={p.totalWeeks}
            currentWeek={p.week}
            selectedWeek={week}
            onChange={setWeek}
          />

          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="semana-titulo" className="text-3xl">
                Semana {week}
                {week === p.week && <span className="ml-2 align-middle font-sans text-sm font-semibold uppercase tracking-wider text-ta-gold">atual</span>}
              </h2>
              <span className="text-sm text-ta-muted">
                {fmtDate(toISODate(monday), "d 'de' MMM")} – {fmtDate(toISODate(addDays(monday, 6)), "d 'de' MMM")}
              </span>
            </div>
            <p className="text-ta-muted">
              Fase <span className="font-semibold text-ta-text">{phase.name}</span>
              {recovery && <span className="font-semibold text-ta-yellow"> · Semana de recuperação (−35% de volume)</span>}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2">
              {TRI.map((t) => {
                const S = SPORTS[t];
                return (
                  <div key={t} className="rounded-xl bg-ta-card2 px-3 py-2">
                    <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ta-muted">
                      <S.icon size={14} style={{ color: S.color }} aria-hidden /> {S.label}
                    </dt>
                    <dd className="font-display text-2xl tabular">{fmtHours(summary.plannedMin[t])}</dd>
                  </div>
                );
              })}
            </dl>
          </Card>

          <ol className="space-y-2">
            {sessions.map((s) => {
              const isToday = s.date === p.today;
              const isDone = done.has(s.date);
              const beforeStart = s.date < p.program.startDate;
              return (
                <li key={s.date}>
                  <Card
                    variant={isToday ? 'highlight' : 'default'}
                    className={beforeStart ? 'opacity-50' : ''}
                    aria-current={isToday ? 'date' : undefined}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ta-muted">
                          {DAY_NAMES[s.dayIndex]} · {fmtDate(s.date, "d 'de' MMM")}
                          {isToday && <span className="text-ta-gold"> · hoje</span>}
                        </div>
                        <h3 className={`text-2xl leading-tight ${s.isRace ? 'text-ta-yellow' : ''}`}>{s.title}</h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isDone && (
                          <span className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider text-ta-yellow">
                            <Check size={16} aria-hidden /> Feito
                          </span>
                        )}
                        {s.totalMin > 0 && !beforeStart && (
                          <span className="font-display text-xl text-ta-gold tabular">{fmtDuration(s.totalMin)}</span>
                        )}
                      </div>
                    </div>
                    {beforeStart ? (
                      <p className="text-sm text-ta-muted">Antes do início do programa.</p>
                    ) : s.blocks.length ? (
                      <SessionBlockList blocks={s.blocks} compact />
                    ) : (
                      <p className="text-sm text-ta-muted">Descanso.</p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>

        <Card>
          <CardTitle>Zonas de frequência cardíaca</CardTitle>
          <HrZonesTable athlete={athlete} />
        </Card>
      </div>
    </>
  );
}
