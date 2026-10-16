import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { WeeklyVolumeChart } from '../components/workouts/WeeklyVolumeChart';
import { WorkoutForm } from '../components/workouts/WorkoutForm';
import { WorkoutList } from '../components/workouts/WorkoutList';
import { todayISO } from '../lib/dates';
import { SPORTS } from '../lib/sports';
import { weeklyVolume } from '../lib/weeklyVolume';
import { useWorkouts } from '../store/workouts';
import type { Sport, Workout } from '../types';

type Filter = 'all' | Sport;
const FILTERS: Filter[] = ['all', 'swim', 'bike', 'run', 'brick', 'strength'];

export function Treinos() {
  const workouts = useWorkouts((s) => s.workouts);
  const add = useWorkouts((s) => s.add);
  const update = useWorkouts((s) => s.update);
  const remove = useWorkouts((s) => s.remove);

  const [editing, setEditing] = useState<Workout | 'new' | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const volume = useMemo(() => weeklyVolume(workouts, todayISO(), 12), [workouts]);
  const filtered = useMemo(
    () => (filter === 'all' ? workouts : workouts.filter((w) => w.sport === filter)),
    [workouts, filter],
  );

  function handleRemove(w: Workout) {
    if (window.confirm('Excluir este treino?')) remove(w.id);
  }

  return (
    <>
      <PageHeader
        title="Treinos"
        subtitle={`${workouts.length} ${workouts.length === 1 ? 'registro' : 'registros'}`}
        action={
          editing === null && (
            <Button onClick={() => setEditing('new')} aria-label="Registrar novo treino">
              <Plus size={20} aria-hidden /> Novo
            </Button>
          )
        }
      />
      <div className="space-y-3">
        {editing !== null && (
          <Card variant="highlight">
            <CardTitle>{editing === 'new' ? 'Novo treino' : 'Editar treino'}</CardTitle>
            <WorkoutForm
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : editing}
              onCancel={() => setEditing(null)}
              onSubmit={(w) => {
                if (editing === 'new') add(w);
                else update(editing.id, w);
                setEditing(null);
              }}
            />
          </Card>
        )}

        <Card>
          <CardTitle>Volume semanal (últimas 12 semanas)</CardTitle>
          <WeeklyVolumeChart data={volume} />
        </Card>

        <Card>
          <CardTitle>Histórico</CardTitle>
          <div className="-mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar por modalidade">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-[44px] shrink-0 rounded-xl border px-3 text-sm font-semibold uppercase tracking-wider ${
                  filter === f
                    ? 'border-ta-gold bg-ta-gold text-ta-bg'
                    : 'border-ta-border bg-ta-card2 text-ta-muted hover:text-ta-text'
                }`}
              >
                {f === 'all' ? 'Todos' : SPORTS[f].label}
              </button>
            ))}
          </div>
          <WorkoutList workouts={filtered} onEdit={setEditing} onRemove={handleRemove} />
        </Card>
      </div>
    </>
  );
}
