import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCw, Send, Trash2 } from 'lucide-react';
import { DailyIntakeChart } from '../components/diet/DailyIntakeChart';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { MetricBig } from '../components/ui/MetricBig';
import { fromISODate, toISODate, todayISO } from '../lib/dates';
import { fmtDate, fmtNumber } from '../lib/format';
import { dailyTotals, deleteMeal, fetchMeals, MEAL_LABEL, sumMacros, type Meal } from '../lib/meals';
import { supabase } from '../lib/supabase';
import { useSync } from '../store/sync';
import type { ISODate } from '../types';

/** Dias exibidos no gráfico (terminando no dia selecionado). */
const CHART_DAYS = 14;

const shift = (iso: ISODate, days: number) => toISODate(addDays(fromISODate(iso), days));

function dayLabel(iso: ISODate): string {
  const today = todayISO();
  if (iso === today) return 'Hoje';
  if (iso === shift(today, -1)) return 'Ontem';
  return fmtDate(iso, "EEE, d 'de' MMM");
}

export function Dieta() {
  const email = useSync((s) => s.email);
  const signedIn = !!supabase && !!email;

  const [date, setDate] = useState<ISODate>(todayISO);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const from = shift(date, -(CHART_DAYS - 1));

  const load = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    try {
      setMeals(await fetchMeals(from, date));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar as refeições.');
    } finally {
      setLoading(false);
    }
  }, [signedIn, from, date]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRemove(m: Meal) {
    if (!window.confirm(`Excluir "${m.description}"?`)) return;
    try {
      await deleteMeal(m.id);
      setMeals((all) => all.filter((x) => x.id !== m.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir a refeição.');
    }
  }

  if (!signedIn) {
    return (
      <>
        <PageHeader title="Dieta" subtitle="Refeições registradas pelo Telegram" />
        <Card>
          <CardTitle>Sem conta conectada</CardTitle>
          <p className="mb-3 text-ta-muted">
            Entre na sua conta e vincule o bot do Telegram. Mande fotos ou descrições das refeições e o Gemini calcula
            calorias e macros — tudo aparece aqui.
          </p>
          <Link
            to="/conectar"
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-ta-gold px-4 text-base font-semibold uppercase tracking-wider text-ta-bg transition-colors hover:bg-[#ffa543]"
          >
            <Send size={18} aria-hidden /> Conectar Telegram · Dieta
          </Link>
        </Card>
      </>
    );
  }

  const ofDay = meals.filter((m) => m.date === date);
  const total = sumMacros(ofDay);
  const days = Array.from({ length: CHART_DAYS }, (_, i) => shift(from, i));
  const series = dailyTotals(meals, days);
  const logged = series.filter((d) => d.meals > 0);
  const avg = logged.length ? sumMacros(logged) : null;

  return (
    <>
      <PageHeader
        title="Dieta"
        subtitle="Refeições registradas pelo Telegram"
        action={
          <Button variant="ghost" onClick={() => void load()} disabled={loading} aria-label="Atualizar refeições">
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} aria-hidden />
          </Button>
        }
      />
      <div className="space-y-3">
        <Card variant="highlight">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button variant="secondary" className="px-3" onClick={() => setDate(shift(date, -1))} aria-label="Dia anterior">
              <ChevronLeft size={20} aria-hidden />
            </Button>
            <div className="min-w-0 text-center">
              <div className="truncate text-lg font-semibold capitalize text-ta-text">{dayLabel(date)}</div>
              <div className="text-sm text-ta-muted">{fmtDate(date)}</div>
            </div>
            <Button
              variant="secondary"
              className="px-3"
              onClick={() => setDate(shift(date, 1))}
              disabled={date >= today}
              aria-label="Próximo dia"
            >
              <ChevronRight size={20} aria-hidden />
            </Button>
          </div>
          <MetricBig label="Calorias" value={fmtNumber(total.kcal, 0)} unit="kcal" tone="gold" size="lg" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MetricBig label="Proteína" value={fmtNumber(total.protein_g, 0)} unit="g" />
            <MetricBig label="Carboidrato" value={fmtNumber(total.carbs_g, 0)} unit="g" />
            <MetricBig label="Gordura" value={fmtNumber(total.fat_g, 0)} unit="g" />
          </div>
          {total.fiber_g > 0 && <p className="mt-2 text-sm text-ta-muted">Fibras: {fmtNumber(total.fiber_g, 0)} g</p>}
          {date !== today && (
            <Button variant="ghost" className="mt-2 w-full" onClick={() => setDate(today)}>
              Voltar para hoje
            </Button>
          )}
        </Card>

        {error && (
          <p role="alert" className="rounded-card border border-red-500/50 p-3 text-sm text-red-400">
            {error}
          </p>
        )}

        <Card>
          <CardTitle>Refeições ({ofDay.length})</CardTitle>
          {ofDay.length === 0 ? (
            <p className="text-ta-muted">
              {loading ? 'Carregando…' : 'Nenhuma refeição neste dia. Mande uma foto ou descrição para o bot no Telegram.'}
            </p>
          ) : (
            <ul className="divide-y divide-ta-border">
              {ofDay.map((m) => (
                <MealRow key={m.id} meal={m} onRemove={() => void handleRemove(m)} />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Últimos {CHART_DAYS} dias</CardTitle>
          <DailyIntakeChart data={series} selected={date} onSelect={setDate} />
          {avg && (
            <p className="mt-2 text-sm text-ta-muted">
              Média nos {logged.length} dias com registro: {fmtNumber(avg.kcal / logged.length, 0)} kcal ·{' '}
              {fmtNumber(avg.protein_g / logged.length, 0)} g de proteína
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function MealRow({ meal, onRemove }: { meal: Meal; onRemove: () => void }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-ta-gold">{MEAL_LABEL[meal.meal_type]}</span>
            <span className="text-sm text-ta-muted tabular">{format(new Date(meal.eaten_at), 'HH:mm')}</span>
          </div>
          <p className="text-ta-text">{meal.description}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl leading-none tabular text-ta-text">{fmtNumber(meal.kcal, 0)}</div>
          <div className="text-xs text-ta-muted">kcal</div>
        </div>
        <Button variant="ghost" className="px-2 text-ta-muted" onClick={onRemove} aria-label={`Excluir ${meal.description}`}>
          <Trash2 size={18} aria-hidden />
        </Button>
      </div>

      <p className="mt-1 text-sm text-ta-muted tabular">
        P {fmtNumber(meal.protein_g, 0)} g · C {fmtNumber(meal.carbs_g, 0)} g · G {fmtNumber(meal.fat_g, 0)} g
        {meal.fiber_g > 0 && <> · Fibras {fmtNumber(meal.fiber_g, 0)} g</>}
      </p>

      {meal.items.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-ta-card2 p-2 text-sm">
          {meal.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="text-ta-text">{it.name}</span>
                {it.quantity && <span className="text-ta-muted"> · {it.quantity}</span>}
              </span>
              <span className="shrink-0 text-ta-muted tabular">
                {fmtNumber(it.kcal, 0)} kcal · {fmtNumber(it.protein_g, 0)} g P
              </span>
            </li>
          ))}
        </ul>
      )}

      {meal.feedback && (
        <p className="mt-2 border-l-2 border-ta-gold/60 pl-2 text-sm italic text-ta-silver">{meal.feedback}</p>
      )}
    </li>
  );
}
