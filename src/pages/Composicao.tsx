import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { BodyForm } from '../components/body/BodyForm';
import { BodySilhouette } from '../components/body/BodySilhouette';
import { ComparisonCard } from '../components/body/ComparisonCard';
import { EvolutionChart } from '../components/body/EvolutionChart';
import { InBodyBars } from '../components/body/InBodyBars';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { fmtDate, fmtKg, fmtPct } from '../lib/format';
import { selectBaseline, selectLatest, useBody } from '../store/body';
import type { BodyComposition } from '../types';

export function Composicao() {
  const assessments = useBody((s) => s.assessments);
  const add = useBody((s) => s.add);
  const update = useBody((s) => s.update);
  const remove = useBody((s) => s.remove);
  const [editing, setEditing] = useState<BodyComposition | 'new' | null>(null);

  const baseline = selectBaseline(assessments);
  const latest = selectLatest(assessments);

  function handleRemove(a: BodyComposition) {
    if (window.confirm(`Excluir a avaliação de ${fmtDate(a.date)}?`)) remove(a.id);
  }

  return (
    <>
      <PageHeader
        title="Composição"
        subtitle={`Última avaliação: ${fmtDate(latest.date)}`}
        action={
          editing === null && (
            <Button onClick={() => setEditing('new')} aria-label="Registrar nova avaliação">
              <Plus size={20} aria-hidden /> Nova
            </Button>
          )
        }
      />
      <div className="space-y-3">
        {editing !== null && (
          <Card variant="highlight">
            <CardTitle>{editing === 'new' ? 'Nova avaliação InBody' : `Editar avaliação de ${fmtDate(editing.date)}`}</CardTitle>
            {editing === 'new' && (
              <p className="mb-3 text-sm text-ta-muted">Campos pré-preenchidos com a última avaliação — atualize com o novo laudo.</p>
            )}
            <BodyForm
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : editing}
              prefill={latest}
              onCancel={() => setEditing(null)}
              onSubmit={(a) => {
                if (editing === 'new') add(a);
                else update(editing.id, a);
                setEditing(null);
              }}
            />
          </Card>
        )}

        <Card>
          <CardTitle>Análise músculo-gordura</CardTitle>
          <InBodyBars latest={latest} baseline={baseline} />
        </Card>

        <Card>
          <CardTitle>Comparação</CardTitle>
          <ComparisonCard latest={latest} baseline={baseline} />
        </Card>

        <Card>
          <CardTitle>Evolução</CardTitle>
          <EvolutionChart assessments={assessments} />
        </Card>

        <Card>
          <CardTitle>Análise segmentar</CardTitle>
          <BodySilhouette latest={latest} baseline={baseline} />
        </Card>

        <Card>
          <CardTitle>Avaliações</CardTitle>
          <ul className="divide-y divide-ta-border">
            {[...assessments].reverse().map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {fmtDate(a.date)}
                    {a.isBaseline && (
                      <span className="rounded-md border border-ta-gold/60 px-1.5 text-xs uppercase tracking-wider text-ta-gold">
                        Linha de base
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ta-muted tabular">
                    {fmtKg(a.weightKg)} · {fmtPct(a.bodyFatPct)} gordura · InBody {a.inbodyScore}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-ta-muted hover:text-ta-gold"
                  aria-label={`Editar avaliação de ${fmtDate(a.date)}`}
                >
                  <Pencil size={18} />
                </button>
                {!a.isBaseline && (
                  <button
                    type="button"
                    onClick={() => handleRemove(a)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-ta-muted hover:text-red-400"
                    aria-label={`Excluir avaliação de ${fmtDate(a.date)}`}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
