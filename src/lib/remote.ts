// Conversão entre os tipos do app (camelCase) e as linhas do Supabase (snake_case).
// Veja supabase/schema.sql.

import type { Athlete, BodyComposition, ProgramSettings, Segmental, Sport, Workout, WorkoutSource } from '../types';

export interface ProfileRow {
  user_id: string;
  name: string;
  birth_year: number | null;
  age: number;
  sex: 'M' | 'F';
  height_cm: number;
  hr_max: number;
  hr_max_source: 'estimated' | 'measured';
  start_date: string;
  race_date: string;
  phase_weeks: number[];
  created_at?: string;
  updated_at?: string;
}

export interface WorkoutRow {
  id: string;
  date: string;
  sport: Sport;
  duration_min: number;
  distance_km: number | null;
  avg_hr: number | null;
  rpe: number | null;
  name: string | null;
  notes: string | null;
  source: WorkoutSource;
  external_id: string | null;
  planned_date: string | null;
}

type SegmentCol = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg';

export type BodyRow = {
  id: string;
  date: string;
  is_baseline: boolean;
  weight_kg: number;
  skeletal_muscle_kg: number;
  fat_mass_kg: number;
  body_fat_pct: number;
  bmi: number;
  total_body_water_l: number;
  protein_kg: number;
  minerals_kg: number;
  bmr_kcal: number;
  waist_hip_ratio: number;
  visceral_fat_level: number;
  obesity_degree_pct: number;
  inbody_score: number;
  ideal_weight_kg: number;
  fat_control_kg: number;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
} & Record<`lean_${SegmentCol}` | `fat_${SegmentCol}`, number>;

const SEGMENTS: [keyof Segmental, SegmentCol][] = [
  ['rightArm', 'right_arm'],
  ['leftArm', 'left_arm'],
  ['trunk', 'trunk'],
  ['rightLeg', 'right_leg'],
  ['leftLeg', 'left_leg'],
];

/** null/undefined → undefined; o resto vira número (o PostgREST pode devolver numeric como texto). */
const num = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const round = (v: number | undefined, digits = 0): number | null => {
  if (v === undefined || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

const inRange = (v: number | null, min: number, max: number): number | null =>
  v !== null && v >= min && v <= max ? v : null;

/** Remove chaves `undefined` para o objeto ficar igual ao criado pelo app. */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

// ---------------------------------------------------------------------------- perfil

export function profileToRow(athlete: Athlete, program: ProgramSettings): Omit<ProfileRow, 'user_id'> {
  return {
    name: athlete.name,
    birth_year: athlete.birthYear ?? null,
    age: Math.round(athlete.age),
    sex: athlete.sex,
    height_cm: round(athlete.heightCm, 1) ?? 172,
    hr_max: Math.round(athlete.hrMax),
    hr_max_source: athlete.hrMaxSource,
    start_date: program.startDate,
    race_date: program.raceDate,
    phase_weeks: program.phaseWeeks.map((w) => Math.max(1, Math.round(w))),
  };
}

export function rowToProfile(row: ProfileRow, fallback: Athlete): { athlete: Athlete; program: ProgramSettings } {
  const weeks = row.phase_weeks.map(Number);
  return {
    athlete: {
      name: row.name,
      birthYear: row.birth_year ?? fallback.birthYear,
      age: Number(row.age),
      sex: row.sex,
      heightCm: Number(row.height_cm),
      hrMax: Number(row.hr_max),
      hrMaxSource: row.hr_max_source,
    },
    program: {
      startDate: row.start_date,
      raceDate: row.race_date,
      phaseWeeks: [weeks[0], weeks[1], weeks[2], weeks[3]],
    },
  };
}

// ---------------------------------------------------------------------------- treinos

export function workoutToRow(w: Workout): WorkoutRow {
  return {
    id: w.id,
    date: w.date,
    sport: w.sport,
    duration_min: Math.max(0, Math.round(w.durationMin)),
    distance_km: inRange(round(w.distanceKm, 3), 0, 9999),
    // Valores opcionais fora das faixas do schema (ex.: importação com FC errada) viram null,
    // em vez de o servidor recusar o treino inteiro.
    avg_hr: inRange(round(w.avgHr), 30, 230),
    rpe: inRange(round(w.rpe), 1, 10),
    name: w.name ?? null,
    notes: w.notes ?? null,
    source: w.source,
    external_id: w.externalId ?? null,
    planned_date: w.plannedDate ?? null,
  };
}

export function rowToWorkout(r: WorkoutRow): Workout {
  return compact<Workout>({
    id: r.id,
    date: r.date,
    sport: r.sport,
    durationMin: Number(r.duration_min),
    distanceKm: num(r.distance_km),
    avgHr: num(r.avg_hr),
    rpe: num(r.rpe),
    name: opt(r.name),
    notes: opt(r.notes),
    source: r.source,
    externalId: opt(r.external_id),
    plannedDate: opt(r.planned_date),
  });
}

// ---------------------------------------------------------------------------- composição corporal

/** Linha sem `id` (a linha de base é gravada pelo `is_baseline`, não pelo id). */
export function bodyToRow(b: BodyComposition): Omit<BodyRow, 'id'> {
  const row = {
    date: b.date,
    is_baseline: !!b.isBaseline,
    weight_kg: round(b.weightKg, 1)!,
    skeletal_muscle_kg: round(b.skeletalMuscleKg, 1)!,
    fat_mass_kg: round(b.fatMassKg, 1)!,
    body_fat_pct: round(b.bodyFatPct, 1)!,
    bmi: round(b.bmi, 1)!,
    total_body_water_l: round(b.totalBodyWaterL, 1)!,
    protein_kg: round(b.proteinKg, 1)!,
    minerals_kg: round(b.mineralsKg, 2)!,
    bmr_kcal: round(b.bmrKcal)!,
    waist_hip_ratio: round(b.waistHipRatio, 2)!,
    visceral_fat_level: round(b.visceralFatLevel)!,
    obesity_degree_pct: round(b.obesityDegreePct)!,
    inbody_score: round(b.inbodyScore)!,
    ideal_weight_kg: round(b.idealWeightKg, 1)!,
    fat_control_kg: round(b.fatControlKg, 1)!,
    notes: b.notes ?? null,
  } as Omit<BodyRow, 'id'>;
  for (const [key, col] of SEGMENTS) {
    row[`lean_${col}`] = round(b.segmentalLean[key], 2)!;
    row[`fat_${col}`] = round(b.segmentalFat[key], 2)!;
  }
  return row;
}

export function rowToBody(r: BodyRow): BodyComposition {
  const lean = {} as Segmental;
  const fat = {} as Segmental;
  for (const [key, col] of SEGMENTS) {
    lean[key] = Number(r[`lean_${col}`]);
    fat[key] = Number(r[`fat_${col}`]);
  }
  return compact<BodyComposition>({
    id: r.id,
    date: r.date,
    isBaseline: r.is_baseline || undefined,
    weightKg: Number(r.weight_kg),
    skeletalMuscleKg: Number(r.skeletal_muscle_kg),
    fatMassKg: Number(r.fat_mass_kg),
    bodyFatPct: Number(r.body_fat_pct),
    bmi: Number(r.bmi),
    totalBodyWaterL: Number(r.total_body_water_l),
    proteinKg: Number(r.protein_kg),
    mineralsKg: Number(r.minerals_kg),
    bmrKcal: Number(r.bmr_kcal),
    waistHipRatio: Number(r.waist_hip_ratio),
    visceralFatLevel: Number(r.visceral_fat_level),
    obesityDegreePct: Number(r.obesity_degree_pct),
    inbodyScore: Number(r.inbody_score),
    idealWeightKg: Number(r.ideal_weight_kg),
    fatControlKg: Number(r.fat_control_kg),
    segmentalLean: lean,
    segmentalFat: fat,
    notes: opt(r.notes),
  });
}
