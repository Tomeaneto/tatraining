import { useRef, useState, type FormEvent } from 'react';
import { addWeeks } from 'date-fns';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { tanakaHrMax } from '../../data/baseline';
import { downloadBackup, parseBackup, resetAll, restoreBackup } from '../../lib/backup';
import { totalWeeks } from '../../lib/calendar';
import { fromISODate } from '../../lib/dates';
import { useSettings } from '../../store/settings';
import { Button } from '../ui/Button';
import { Card, CardTitle } from '../ui/Card';
import { Field, Input } from '../ui/Field';

const PHASE_LABELS = ['Base', 'Construção', 'Específico', 'Pico'];

type Msg = { kind: 'ok' | 'error'; text: string } | null;

export function SettingsCard() {
  const { athlete, program, setAthlete, setProgram } = useSettings();
  const [startDate, setStartDate] = useState(program.startDate);
  const [raceDate, setRaceDate] = useState(program.raceDate);
  const [phases, setPhases] = useState(program.phaseWeeks.map(String));
  const [hrMax, setHrMax] = useState(String(athlete.hrMax));
  const [age, setAge] = useState(String(athlete.age));
  const [msg, setMsg] = useState<Msg>(null);
  const [backupMsg, setBackupMsg] = useState<Msg>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const estimate = tanakaHrMax(Number(age) || athlete.age);

  function save(e: FormEvent) {
    e.preventDefault();
    const weeks = phases.map((p) => Number(p));
    const hr = Number(hrMax);
    const ageN = Number(age);
    if (!startDate || !raceDate) return setMsg({ kind: 'error', text: 'Informe as duas datas.' });
    if (fromISODate(raceDate) < addWeeks(fromISODate(startDate), 8)) {
      return setMsg({ kind: 'error', text: 'A prova precisa estar pelo menos 8 semanas após o início.' });
    }
    if (weeks.some((w) => !Number.isFinite(w) || w <= 0)) {
      return setMsg({ kind: 'error', text: 'As proporções das fases devem ser números positivos.' });
    }
    if (!Number.isFinite(hr) || hr < 120 || hr > 230) return setMsg({ kind: 'error', text: 'FC máx. entre 120 e 230 bpm.' });
    if (!Number.isFinite(ageN) || ageN < 10 || ageN > 100) return setMsg({ kind: 'error', text: 'Idade inválida.' });

    setProgram({ startDate, raceDate, phaseWeeks: weeks as [number, number, number, number] });
    setAthlete({
      age: Math.round(ageN),
      hrMax: Math.round(hr),
      // Só vira "medida" se o valor for diferente da estimativa.
      hrMaxSource: Math.round(hr) === tanakaHrMax(Math.round(ageN)) ? 'estimated' : 'measured',
    });
    const total = totalWeeks({ startDate, raceDate, phaseWeeks: weeks as [number, number, number, number] });
    setMsg({ kind: 'ok', text: `Configurações salvas — programa de ${total} semanas.` });
  }

  async function handleImport(file: File | undefined) {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const ok = window.confirm(
        `Restaurar backup de ${new Date(backup.exportedAt).toLocaleDateString('pt-BR')}? ` +
          `Isso substitui todos os dados atuais (${backup.workouts.length} treinos, ${backup.assessments.length} avaliações).`,
      );
      if (!ok) return;
      restoreBackup(backup);
      setBackupMsg({ kind: 'ok', text: 'Backup restaurado.' });
      window.location.reload();
    } catch (e) {
      setBackupMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao ler o backup.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <Card>
        <CardTitle>Configurações</CardTitle>
        <form onSubmit={save} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Início do programa">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Data da prova">
              <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-ta-muted">
              Proporção das fases (semanas)
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {PHASE_LABELS.map((label, i) => (
                <Field key={label} label={label}>
                  <Input
                    inputMode="numeric"
                    value={phases[i]}
                    onChange={(e) => setPhases((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-1 text-sm text-ta-muted">Ajustadas automaticamente ao total de semanas até a prova.</p>
          </fieldset>

          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Idade">
              <Input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
            <Field
              label="FC máxima (bpm)"
              hint={
                <button type="button" className="-my-2 min-h-[44px] font-semibold text-ta-gold" onClick={() => setHrMax(String(estimate))}>
                  Usar estimativa: {estimate}
                </button>
              }
            >
              <Input inputMode="numeric" value={hrMax} onChange={(e) => setHrMax(e.target.value)} />
            </Field>
          </div>
          <p className="text-sm text-ta-muted">
            A estimativa usa a fórmula de Tanaka (208 − 0,7 × idade). O ideal é substituir pelo valor de um teste de esforço.
          </p>

          <Button type="submit" block>
            Salvar configurações
          </Button>
          {msg && (
            <p role="status" className={`text-sm ${msg.kind === 'ok' ? 'text-ta-yellow' : 'text-red-400'}`}>
              {msg.text}
            </p>
          )}
        </form>
      </Card>

      <Card>
        <CardTitle>Backup</CardTitle>
        <p className="mb-3 text-ta-muted">
          Os dados ficam só neste aparelho. Exporte um backup de vez em quando e guarde em local seguro.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={downloadBackup}>
            <Download size={18} aria-hidden /> Exportar
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden /> Importar
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => handleImport(e.target.files?.[0])}
          aria-label="Arquivo de backup"
        />
        {backupMsg && (
          <p role="status" className={`mt-3 text-sm ${backupMsg.kind === 'ok' ? 'text-ta-yellow' : 'text-red-400'}`}>
            {backupMsg.text}
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Zona de perigo</CardTitle>
        <p className="mb-3 text-ta-muted">
          Apaga treinos, avaliações (exceto a linha de base) e configurações, e desconecta o Strava.
        </p>
        <Button
          variant="danger"
          block
          onClick={() => {
            if (window.confirm('Resetar todos os dados? Esta ação não pode ser desfeita. Exporte um backup antes.')) {
              resetAll();
              window.location.reload();
            }
          }}
        >
          <RotateCcw size={18} aria-hidden /> Resetar dados
        </Button>
      </Card>
    </>
  );
}
