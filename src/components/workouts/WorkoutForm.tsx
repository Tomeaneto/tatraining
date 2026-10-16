import { useState, type FormEvent } from 'react';
import { todayISO } from '../../lib/dates';
import { parseDecimal, toInputDecimal } from '../../lib/format';
import { SPORTS } from '../../lib/sports';
import type { Sport, Workout } from '../../types';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';

const SPORT_OPTIONS: Sport[] = ['swim', 'bike', 'run', 'brick', 'strength'];

type Draft = Omit<Workout, 'id'>;

type Props = {
  initial?: Workout;
  onSubmit: (w: Draft) => void;
  onCancel: () => void;
};

type Errors = Partial<Record<'date' | 'durationMin' | 'distanceKm' | 'avgHr', string>>;

export function WorkoutForm({ initial, onSubmit, onCancel }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [sport, setSport] = useState<Sport>(initial?.sport ?? 'run');
  const [duration, setDuration] = useState(initial ? String(initial.durationMin) : '');
  const [distance, setDistance] = useState(toInputDecimal(initial?.distanceKm));
  const [avgHr, setAvgHr] = useState(initial?.avgHr ? String(initial.avgHr) : '');
  const [rpe, setRpe] = useState<number | undefined>(initial?.rpe);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const durationMin = parseDecimal(duration);
    const distanceKm = parseDecimal(distance);
    const hr = parseDecimal(avgHr);
    const next: Errors = {};
    if (!date) next.date = 'Informe a data.';
    if (!durationMin || durationMin <= 0) next.durationMin = 'Informe a duração em minutos.';
    if (distance && (distanceKm == null || distanceKm < 0)) next.distanceKm = 'Distância inválida.';
    if (avgHr && (hr == null || hr < 30 || hr > 230)) next.avgHr = 'FC entre 30 e 230 bpm.';
    setErrors(next);
    if (Object.keys(next).length) return;

    onSubmit({
      ...(initial ?? { source: 'manual' as const }),
      date,
      sport,
      durationMin: Math.round(durationMin!),
      distanceKm: distanceKm || undefined,
      avgHr: hr ? Math.round(hr) : undefined,
      rpe,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" error={errors.date}>
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Modalidade">
          <Select value={sport} onChange={(e) => setSport(e.target.value as Sport)}>
            {SPORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SPORTS[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duração (min)" error={errors.durationMin}>
          <Input inputMode="numeric" placeholder="45" value={duration} onChange={(e) => setDuration(e.target.value)} required />
        </Field>
        <Field label="Distância (km)" hint={sport === 'swim' ? '1500 m = 1,5' : undefined} error={errors.distanceKm}>
          <Input inputMode="decimal" placeholder="0,0" value={distance} onChange={(e) => setDistance(e.target.value)} />
        </Field>
        <Field label="FC média (bpm)" error={errors.avgHr}>
          <Input inputMode="numeric" placeholder="140" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ta-muted">
          Esforço percebido (RPE){rpe ? `: ${rpe}` : ''}
        </legend>
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rpe === n}
              onClick={() => setRpe(rpe === n ? undefined : n)}
              className={`min-h-[44px] rounded-lg border font-display text-lg tabular ${
                rpe === n
                  ? 'border-ta-gold bg-ta-gold text-ta-bg'
                  : rpe && n < rpe
                    ? 'border-ta-gold/40 bg-ta-gold/15 text-ta-text'
                    : 'border-ta-border bg-ta-card2 text-ta-muted'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Como foi o treino?" />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {initial ? 'Salvar' : 'Registrar treino'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
