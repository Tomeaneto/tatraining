import type { ISODate } from '../types';
import { supabase } from './supabase';

// Refeições registradas pelo bot do Telegram (tabela `meals`). Leitura direta do Supabase,
// sem a fila offline: o RLS já restringe às refeições do usuário logado.

export type MealType =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner'
  | 'supper'
  | 'pre_workout'
  | 'post_workout'
  | 'other';

/** Mesmos rótulos do bot (`api/telegram/webhook.ts`). */
export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Café da manhã',
  morning_snack: 'Lanche da manhã',
  lunch: 'Almoço',
  afternoon_snack: 'Lanche da tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
  pre_workout: 'Pré-treino',
  post_workout: 'Pós-treino',
  other: 'Refeição',
};

export interface MealItem {
  name: string;
  quantity: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface Meal extends Macros {
  id: string;
  date: ISODate;
  eaten_at: string;
  meal_type: MealType;
  description: string;
  items: MealItem[];
  feedback: string | null;
  source: 'telegram' | 'manual';
}

export interface DayTotals extends Macros {
  date: ISODate;
  meals: number;
}

const COLUMNS = 'id, date, eaten_at, meal_type, description, items, kcal, protein_g, carbs_g, fat_g, fiber_g, feedback, source';

// `numeric` do Postgres pode vir como string; colunas nulas viram 0.
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function toMeal(row: Record<string, unknown>): Meal {
  const items = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [];
  return {
    id: String(row.id),
    date: String(row.date),
    eaten_at: String(row.eaten_at),
    meal_type: (row.meal_type as MealType) in MEAL_LABEL ? (row.meal_type as MealType) : 'other',
    description: String(row.description ?? ''),
    items: items.map((i) => ({
      name: String(i.name ?? ''),
      quantity: String(i.quantity ?? ''),
      kcal: num(i.kcal),
      protein_g: num(i.protein_g),
      carbs_g: num(i.carbs_g),
      fat_g: num(i.fat_g),
    })),
    kcal: num(row.kcal),
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
    fiber_g: num(row.fiber_g),
    feedback: (row.feedback as string | null) ?? null,
    source: row.source === 'manual' ? 'manual' : 'telegram',
  };
}

/** Refeições entre `from` e `to` (inclusive), em ordem cronológica. */
export async function fetchMeals(from: ISODate, to: ISODate): Promise<Meal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('meals')
    .select(COLUMNS)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('eaten_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toMeal(r as Record<string, unknown>));
}

export async function deleteMeal(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function sumMacros(meals: Macros[]): Macros {
  return meals.reduce<Macros>(
    (t, m) => ({
      kcal: t.kcal + m.kcal,
      protein_g: t.protein_g + m.protein_g,
      carbs_g: t.carbs_g + m.carbs_g,
      fat_g: t.fat_g + m.fat_g,
      fiber_g: t.fiber_g + m.fiber_g,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  );
}

/** Totais por dia para cada data de `days` (dias sem refeição ficam zerados). */
export function dailyTotals(meals: Meal[], days: ISODate[]): DayTotals[] {
  return days.map((date) => {
    const ofDay = meals.filter((m) => m.date === date);
    return { date, meals: ofDay.length, ...sumMacros(ofDay) };
  });
}
