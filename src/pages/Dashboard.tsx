import { useMemo } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { WeightSparkline } from '../components/WeightSparkline';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { MetricBig } from '../components/ui/MetricBig';
import { ProgressBar } from '../components/ui/ProgressBar';
import { SessionBlockList } from '../components/SessionBlockList';
import { useProgram } from '../hooks/useProgram';
import { fmtDate, fmtDelta, fmtDuration, fmtHours, fmtNumber } from '../lib/format';
import { SPORTS, type TriSport } from '../lib/sports';
import { summarizeWeek } from '../lib/weekSummary';
import { selectBaseline, selectLatest, useBody } from '../store/body';
import { useSettings } from '../store/settings';
import { completedDates, useWorkouts } from '../store/workouts';

const TRI: TriSport[] = ['swim', 'bike', 'run'];

export function Dashboard() {
  const firstName = useSettings((s) => s.athlete.name.split(' ')[0]);
  const p = useProgram();
  const workouts = useWorkouts((s) => s.workouts);
  const completeSession = useWorkouts((s) => s.completeSession);
  const uncompleteSession = useWorkouts((s) => s.uncompleteSession);
  const assessments = useBody((s) => s.assessments);

  const done = useMemo(() => completedDates(workouts), [workouts]);
  const week = useMemo(
    () => summarizeWeek(p.weekSessions, workouts, p.program.startDate),
    [p.weekSessions, workouts, p.program.startDate],
  );

  const baseline = selectBaseline(assessments);
  const latest = selectLatest(assessments);
  const lost = baseline.weightKg - latest.weightKg;
  const toIdeal = latest.weightKg - baseline.idealWeightKg;

  const today = p.todaySession;
  const todayDone = today ? done.has(today.date) : false;

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} subtitle="Rumo ao Ironman 70.3" />
      <div className="space-y-3">
        {/* Contagem regressiva */}
        <Card variant="highlight">
          <CardTitle>Contagem regressiva</CardTitle>
          <MetricBig
            label="Dias para a prova"
            value={Math.max(p.daysToRace, 0)}
            size="xl"
            tone="gold"
            hint={fmtDate(p.program.raceDate, "EEEE, d 'de' MMMM 'de' yyyy")}
          />
        </Card>

        {/* Fase */}
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <CardTitle className="mb-0">Fase atual</CardTitle>
            <span className="font-display text-xl text-ta-text tabular">
              Semana {p.week} <span className="text-ta-muted">de {p.totalWeeks}</span>
            </span>
          </div>
          <div className="font-display text-3xl text-ta-gold">{p.phase.name}</div>
          <p className="mb-3 text-ta-muted">{p.phase.focus}</p>
          <ProgressBar value={p.progress} label="Progresso do programa" />
          {p.recovery && (
            <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-ta-yellow">
              Semana de recuperação — volume reduzido
            </p>
          )}
        </Card>

        {/* Treino de hoje */}
        <Card variant={todayDone ? 'default' : 'raised'} className={todayDone ? 'border-ta-yellow/50' : ''}>
          <CardTitle>Treino de hoje</CardTitle>
          {today && today.blocks.length > 0 ? (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <span className="font-display text-2xl">{today.title}</span>
                {today.totalMin > 0 && (
                  <span className="font-display text-xl text-ta-gold tabular">{fmtDuration(today.totalMin)}</span>
                )}
              </div>
              <div className="mb-4">
                <SessionBlockList blocks={today.blocks} />
              </div>
              {todayDone ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold uppercase tracking-wider text-ta-yellow">
                    <Check size={20} aria-hidden /> Feito
                  </span>
                  <Button variant="ghost" onClick={() => uncompleteSession(today.date)}>
                    <RotateCcw size={16} aria-hidden /> Desfazer
                  </Button>
                </div>
              ) : (
                <Button block onClick={() => completeSession(today)}>
                  <Check size={20} aria-hidden /> Marcar como feito
                </Button>
              )}
            </>
          ) : (
            <p className="text-ta-muted">
              {p.started ? 'Sem sessão planejada para hoje — descanso.' : `O programa começa em ${fmtDate(p.program.startDate)}.`}
            </p>
          )}
        </Card>

        {/* Resumo da semana */}
        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <CardTitle className="mb-0">Semana {p.week}</CardTitle>
            <span className="font-display text-2xl tabular">
              <span className={week.done === week.planned && week.planned > 0 ? 'text-ta-yellow' : 'text-ta-gold'}>
                {week.done}
              </span>
              <span className="text-ta-muted"> / {week.planned} sessões</span>
            </span>
          </div>
          <ul className="space-y-3">
            {TRI.map((t) => {
              const S = SPORTS[t];
              const planned = week.plannedMin[t];
              const doneMin = week.doneMin[t];
              return (
                <li key={t}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <S.icon size={18} style={{ color: S.color }} aria-hidden /> {S.label}
                    </span>
                    <span className="tabular text-ta-muted">
                      <span className="text-ta-text">{fmtHours(doneMin)}</span> de {fmtHours(planned)}
                    </span>
                  </div>
                  <ProgressBar value={planned ? doneMin / planned : 0} label={`${S.label}: horas feitas`} />
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Composição */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <MetricBig label="Peso atual" value={fmtNumber(latest.weightKg)} unit="kg" hint={fmtDate(latest.date)} />
          </Card>
          <Card>
            <MetricBig label="Gordura (PGC)" value={fmtNumber(latest.bodyFatPct)} unit="%" hint="Meta: 10–20%" />
          </Card>
          <Card>
            <MetricBig
              label="Desde a base"
              value={fmtDelta(-lost)}
              unit="kg"
              tone={lost > 0 ? 'yellow' : 'default'}
              hint={lost > 0 ? 'perdidos' : 'sem perda ainda'}
            />
          </Card>
          <Card>
            <MetricBig
              label="Até o peso ideal"
              value={fmtNumber(Math.max(toIdeal, 0))}
              unit="kg"
              tone={toIdeal <= 0 ? 'yellow' : 'gold'}
              hint={`Ideal: ${fmtNumber(baseline.idealWeightKg)} kg`}
            />
          </Card>
        </div>

        <Card>
          <div className="flex items-baseline justify-between">
            <CardTitle className="mb-0">Peso</CardTitle>
            <span className="text-sm text-ta-muted">
              {assessments.length} {assessments.length === 1 ? 'avaliação' : 'avaliações'}
            </span>
          </div>
          <WeightSparkline assessments={assessments} />
          {assessments.length < 2 && (
            <p className="text-sm text-ta-muted">Registre novas avaliações na aba Corpo para ver a evolução.</p>
          )}
        </Card>
      </div>
    </>
  );
}
