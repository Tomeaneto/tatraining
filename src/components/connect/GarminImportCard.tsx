import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { importFiles, type ImportResult } from '../../lib/importers';
import { SPORTS } from '../../lib/sports';
import { useWorkouts } from '../../store/workouts';
import type { Sport } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardTitle } from '../ui/Card';
import { Field, Select } from '../ui/Field';

const FALLBACKS: Sport[] = ['run', 'bike', 'swim', 'strength', 'brick'];

type Summary = { results: ImportResult[]; added: number; duplicates: number };

export function GarminImportCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importMany = useWorkouts((s) => s.importMany);
  const [fallback, setFallback] = useState<Sport>('run');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      const results = await importFiles(Array.from(list), fallback);
      const all = results.flatMap((r) => r.workouts);
      const added = importMany(all);
      setSummary({ results, added, duplicates: all.length - added });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const guessed = summary?.results.reduce((s, r) => s + r.guessed, 0) ?? 0;
  const failures = summary?.results.filter((r) => r.error) ?? [];

  return (
    <Card>
      <CardTitle>Garmin</CardTitle>
      <p className="mb-3 text-ta-muted">
        A API oficial da Garmin exige aprovação de parceiro. Exporte do Garmin Connect e importe aqui: atividade em
        <span className="text-ta-text"> .fit</span> ou <span className="text-ta-text">.gpx</span>, ou a lista de
        atividades em <span className="text-ta-text">.csv</span>.
      </p>
      <Field label="Modalidade quando não identificada" className="mb-3">
        <Select value={fallback} onChange={(e) => setFallback(e.target.value as Sport)}>
          {FALLBACKS.map((s) => (
            <option key={s} value={s}>
              {SPORTS[s].label}
            </option>
          ))}
        </Select>
      </Field>
      <input
        ref={inputRef}
        type="file"
        accept=".fit,.gpx,.csv"
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-label="Arquivos do Garmin"
      />
      <Button block variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload size={18} aria-hidden /> {busy ? 'Lendo arquivos…' : 'Escolher arquivos'}
      </Button>

      {summary && (
        <div role="status" className="mt-3 space-y-1 text-sm">
          <p className="text-ta-yellow">
            {summary.added} {summary.added === 1 ? 'treino importado' : 'treinos importados'}
            {summary.duplicates > 0 && <span className="text-ta-muted"> · {summary.duplicates} {summary.duplicates === 1 ? 'já existia' : 'já existiam'}</span>}
          </p>
          {guessed > 0 && (
            <p className="text-ta-muted">
              {guessed} sem modalidade identificada — salvos como {SPORTS[fallback].label}. Ajuste na aba Treinos se preciso.
            </p>
          )}
          {failures.map((f) => (
            <p key={f.file} className="text-red-400">
              {f.file}: {f.error}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
