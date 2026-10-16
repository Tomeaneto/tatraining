/** Datas de calendário sempre em ISO local `yyyy-MM-dd`. */
export type ISODate = string;

export type Sport = 'swim' | 'bike' | 'run' | 'strength' | 'brick' | 'race' | 'rest';
export type ZoneNumber = 1 | 2 | 3 | 4 | 5;
export type PhaseId = 'base' | 'build' | 'specific' | 'peak';
export type Sex = 'M' | 'F';

export interface Athlete {
  name: string;
  birthYear: number;
  age: number;
  sex: Sex;
  heightCm: number;
  hrMax: number;
  /** `estimated` = Tanaka; `measured` = teste de esforço. */
  hrMaxSource: 'estimated' | 'measured';
}

export interface Segmental {
  rightArm: number;
  leftArm: number;
  trunk: number;
  rightLeg: number;
  leftLeg: number;
}

export interface BodyComposition {
  id: string;
  date: ISODate;
  weightKg: number;
  skeletalMuscleKg: number;
  fatMassKg: number;
  bodyFatPct: number;
  bmi: number;
  totalBodyWaterL: number;
  proteinKg: number;
  mineralsKg: number;
  bmrKcal: number;
  waistHipRatio: number;
  visceralFatLevel: number;
  obesityDegreePct: number;
  inbodyScore: number;
  idealWeightKg: number;
  fatControlKg: number;
  segmentalLean: Segmental;
  segmentalFat: Segmental;
  isBaseline?: boolean;
  notes?: string;
}

export type BodyMetricKey = Exclude<
  keyof BodyComposition,
  'id' | 'date' | 'segmentalLean' | 'segmentalFat' | 'isBaseline' | 'notes'
>;

export interface ReferenceRange {
  min: number;
  max: number;
}

export interface Phase {
  id: PhaseId;
  name: string;
  focus: string;
  startWeek: number;
  endWeek: number;
}

export interface SessionBlock {
  sport: Sport;
  durationMin: number;
  zone: ZoneNumber;
  description: string;
}

/** Sessão planejada para um dia do programa. */
export interface Session {
  date: ISODate;
  weekNumber: number;
  /** 0 = segunda … 6 = domingo */
  dayIndex: number;
  title: string;
  blocks: SessionBlock[];
  totalMin: number;
  isRecoveryWeek: boolean;
  isRace: boolean;
}

export type WorkoutSource = 'manual' | 'plan' | 'strava' | 'garmin';

/** Treino realizado. */
export interface Workout {
  id: string;
  date: ISODate;
  sport: Sport;
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  /** Percepção de esforço 1–10 */
  rpe?: number;
  notes?: string;
  name?: string;
  source: WorkoutSource;
  /** Id na origem (Strava/Garmin) — evita duplicar na importação. */
  externalId?: string;
  /** Data da sessão do plano que este treino cumpre. */
  plannedDate?: ISODate;
}

export interface ProgramSettings {
  startDate: ISODate;
  raceDate: ISODate;
  /** Proporção das 4 fases, em semanas (base, construção, específico, pico). */
  phaseWeeks: [number, number, number, number];
}
