import { useState, type FormEvent } from 'react';
import { METRIC_LABELS } from '../../data/baseline';
import { todayISO } from '../../lib/dates';
import { parseDecimal, toInputDecimal } from '../../lib/format';
import type { BodyComposition, BodyMetricKey, Segmental } from '../../types';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';

type Draft = Omit<BodyComposition, 'id'>;

const GROUPS: { title: string; keys: BodyMetricKey[] }[] = [
  { title: 'Composição', keys: ['weightKg', 'skeletalMuscleKg', 'fatMassKg', 'bodyFatPct', 'bmi', 'inbodyScore'] },
  { title: 'Água e nutrientes', keys: ['totalBodyWaterL', 'proteinKg', 'mineralsKg', 'bmrKcal'] },
  { title: 'Obesidade e controle', keys: ['waistHipRatio', 'visceralFatLevel', 'obesityDegreePct', 'idealWeightKg', 'fatControlKg'] },
];

export const SEGMENTS: { key: keyof Segmental; label: string; short: string }[] = [
  { key: 'rightArm', label: 'Braço direito', short: 'BD' },
  { key: 'leftArm', label: 'Braço esquerdo', short: 'BE' },
  { key: 'trunk', label: 'Tronco', short: 'Tronco' },
  { key: 'rightLeg', label: 'Perna direita', short: 'PD' },
  { key: 'leftLeg', label: 'Perna esquerda', short: 'PE' },
];

type Values = Record<string, string>;

function toValues(src: BodyComposition): Values {
  const v: Values = {};
  for (const g of GROUPS) for (const k of g.keys) v[k] = toInputDecimal(src[k]);
  for (const s of SEGMENTS) {
    v[`lean.${s.key}`] = toInputDecimal(src.segmentalLean[s.key]);
    v[`fat.${s.key}`] = toInputDecimal(src.segmentalFat[s.key]);
  }
  return v;
}

type Props = {
  /** Avaliação a editar; se ausente, cria nova pré-preenchida com `prefill`. */
  initial?: BodyComposition;
  prefill: BodyComposition;
  onSubmit: (a: Draft) => void;
  onCancel: () => void;
};

export function BodyForm({ initial, prefill, onSubmit, onCancel }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [values, setValues] = useState<Values>(() => toValues(initial ?? prefill));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const bad = new Set<string>();
    const num = (k: string) => {
      const n = parseDecimal(values[k] ?? '');
      if (n == null) bad.add(k);
      return n ?? 0;
    };
    const metrics = {} as Record<BodyMetricKey, number>;
    for (const g of GROUPS) for (const k of g.keys) metrics[k] = num(k);
    const segmentalLean = {} as Segmental;
    const segmentalFat = {} as Segmental;
    for (const s of SEGMENTS) {
      segmentalLean[s.key] = num(`lean.${s.key}`);
      segmentalFat[s.key] = num(`fat.${s.key}`);
    }
    if (!date) bad.add('date');
    setInvalid(bad);
    if (bad.size) return;

    onSubmit({
      ...metrics,
      date,
      segmentalLean,
      segmentalFat,
      isBaseline: initial?.isBaseline,
      notes: notes.trim() || undefined,
    });
  }

  const err = (k: string) => (invalid.has(k) ? 'Valor inválido' : undefined);

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <Field label="Data da avaliação" error={invalid.has('date') ? 'Informe a data.' : undefined}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />
      </Field>

      {GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend className="mb-2 font-display text-xl text-ta-gold">{g.title}</legend>
          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
            {g.keys.map((k) => {
              const m = METRIC_LABELS[k];
              return (
                <Field key={k} label={m.unit && m.unit !== '/100' ? `${m.label} (${m.unit})` : m.label} error={err(k)}>
                  <Input inputMode="decimal" value={values[k]} onChange={(e) => set(k, e.target.value)} />
                </Field>
              );
            })}
          </div>
        </fieldset>
      ))}

      {(['lean', 'fat'] as const).map((kind) => (
        <fieldset key={kind}>
          <legend className="mb-2 font-display text-xl text-ta-gold">
            {kind === 'lean' ? 'Massa magra segmentar (kg)' : 'Gordura segmentar (kg)'}
          </legend>
          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-5">
            {SEGMENTS.map((s) => (
              <Field key={s.key} label={s.label} error={err(`${kind}.${s.key}`)}>
                <Input
                  inputMode="decimal"
                  value={values[`${kind}.${s.key}`]}
                  onChange={(e) => set(`${kind}.${s.key}`, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </fieldset>
      ))}

      <Field label="Observações">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {invalid.size > 0 && (
        <p className="text-sm text-red-400" role="alert">
          Corrija os campos marcados.
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {initial ? 'Salvar' : 'Registrar avaliação'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
