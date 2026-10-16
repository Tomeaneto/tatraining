import type { PhaseId, Sport, ZoneNumber } from '../types';

/**
 * Tabela do programa: fase × dia da semana (0 = segunda … 6 = domingo).
 *
 * `minutes: [início, fim]` é a duração na 1ª e na última semana da fase;
 * as semanas intermediárias são interpoladas. Na fase de pico o fim é menor
 * que o início (polimento). Blocos que chegam a 0 min são omitidos.
 *
 * Edite à vontade — os componentes só leem esta tabela.
 */
export interface BlockTemplate {
  sport: Sport;
  minutes: [number, number];
  zone: ZoneNumber;
  description: string;
}

export interface DayTemplate {
  title: string;
  blocks: BlockTemplate[];
}

export interface PhaseTemplate {
  name: string;
  focus: string;
  days: [DayTemplate, DayTemplate, DayTemplate, DayTemplate, DayTemplate, DayTemplate, DayTemplate];
}

export const PHASE_ORDER: PhaseId[] = ['base', 'build', 'specific', 'peak'];

/** Proporção padrão das fases em semanas (soma 52). */
export const DEFAULT_PHASE_WEEKS: [number, number, number, number] = [16, 16, 14, 6];

/** A cada N semanas, uma semana de recuperação (exceto no pico). */
export const RECOVERY_EVERY = 4;
/** Fator de volume na semana de recuperação (−35%). */
export const RECOVERY_FACTOR = 0.65;

export const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
export const DAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const PROGRAM: Record<PhaseId, PhaseTemplate> = {
  base: {
    name: 'Base',
    focus: 'Volume baixo, técnica de natação, Z1–Z2 e força geral',
    days: [
      {
        title: 'Natação',
        blocks: [
          { sport: 'swim', minutes: [35, 50], zone: 2, description: 'Técnica: educativos (catch-up, pernada com prancha, respiração bilateral) + séries de 50–100 m leves' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [25, 45], zone: 2, description: 'Corrida leve conversável. No início, alterne 4′ corrida / 1′ caminhada' },
          { sport: 'strength', minutes: [30, 40], zone: 1, description: 'Força geral: agachamento, terra romeno, remada, flexão, prancha, glúteo médio' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [25, 35], zone: 2, description: 'Nado contínuo leve com foco em alongar a braçada' },
          { sport: 'bike', minutes: [40, 60], zone: 2, description: 'Pedal aeróbico, cadência 85–95 rpm' },
          { sport: 'strength', minutes: [15, 20], zone: 1, description: 'Core e mobilidade de quadril/tornozelo' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [25, 45], zone: 2, description: 'Corrida aeróbica + 4 acelerações curtas e soltas no fim' },
          { sport: 'strength', minutes: [30, 40], zone: 1, description: 'Força geral: afundo, step-up, puxada, panturrilha, prancha lateral' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [25, 35], zone: 2, description: 'Educativos + 4–8×50 m técnica com descanso amplo' },
          { sport: 'bike', minutes: [30, 45], zone: 2, description: 'Pedal leve, trabalho de pedalada redonda' },
          { sport: 'strength', minutes: [15, 20], zone: 1, description: 'Core anti-rotação e estabilidade de ombro' },
        ],
      },
      {
        title: 'Corrida regenerativa',
        blocks: [
          { sport: 'run', minutes: [20, 35], zone: 1, description: 'Bem leve, terreno plano. Pode ser trote + caminhada' },
        ],
      },
      {
        title: 'Bike longo + Brick',
        blocks: [
          { sport: 'bike', minutes: [60, 120], zone: 2, description: 'Longo aeróbico; pratique hidratação a cada 15–20′' },
          { sport: 'brick', minutes: [10, 15], zone: 2, description: 'Transição: corrida leve logo após descer da bike' },
        ],
      },
    ],
  },

  build: {
    name: 'Construção',
    focus: 'Aumento progressivo de volume e introdução de Z3–Z4',
    days: [
      {
        title: 'Natação',
        blocks: [
          { sport: 'swim', minutes: [50, 65], zone: 3, description: 'Aquecimento 400 m + 8–12×100 m em Z3 (15″ desc.) + soltura' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [45, 60], zone: 4, description: 'Intervalado: 5–6×4′ em Z4 com 2′ de trote' },
          { sport: 'strength', minutes: [35, 40], zone: 1, description: 'Força: agachamento búlgaro, terra, remada, pliometria leve' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [35, 45], zone: 2, description: 'Endurance contínuo com respiração a cada 3' },
          { sport: 'bike', minutes: [60, 75], zone: 3, description: 'Tempo: 3×10–15′ em Z3 com 5′ leve' },
          { sport: 'strength', minutes: [20, 20], zone: 1, description: 'Core e mobilidade' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [45, 60], zone: 3, description: 'Tempo run: 20–30′ contínuos em Z3' },
          { sport: 'strength', minutes: [30, 35], zone: 1, description: 'Força unilateral + panturrilha excêntrica' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [40, 50], zone: 2, description: 'Séries de 200–300 m em Z2 + palmar/pull buoy' },
          { sport: 'bike', minutes: [45, 60], zone: 2, description: 'Aeróbico com 6×1′ cadência alta' },
          { sport: 'strength', minutes: [20, 20], zone: 1, description: 'Mobilidade e estabilidade de ombro' },
        ],
      },
      {
        title: 'Corrida regenerativa',
        blocks: [
          { sport: 'run', minutes: [35, 45], zone: 1, description: 'Regenerativo, terreno plano' },
        ],
      },
      {
        title: 'Bike longo + Brick',
        blocks: [
          { sport: 'bike', minutes: [150, 210], zone: 2, description: 'Longo Z2 com 2–3 blocos de 15′ em Z3; teste a nutrição' },
          { sport: 'brick', minutes: [20, 30], zone: 3, description: 'Brick: corrida firme logo após a bike' },
        ],
      },
    ],
  },

  specific: {
    name: 'Específico',
    focus: 'Ritmo de prova, bricks longos e simulados',
    days: [
      {
        title: 'Natação',
        blocks: [
          { sport: 'swim', minutes: [60, 75], zone: 3, description: 'Ritmo de prova: 3–4×500 m no pace do 70.3 + visada a cada 6 braçadas' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [60, 75], zone: 4, description: 'Limiar: 3×10′ em Z4 com 3′ de trote' },
          { sport: 'strength', minutes: [30, 30], zone: 1, description: 'Força de manutenção, menos volume e mais potência' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [40, 45], zone: 2, description: 'Contínuo com saídas rápidas e visada' },
          { sport: 'bike', minutes: [75, 90], zone: 3, description: 'Ritmo de prova: 3×20′ em Z3 na posição de prova' },
          { sport: 'strength', minutes: [20, 15], zone: 1, description: 'Core e mobilidade' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [60, 80], zone: 3, description: 'Ritmo de 21 km: blocos de 15–20′ no pace alvo' },
          { sport: 'strength', minutes: [25, 20], zone: 1, description: 'Manutenção leve' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [45, 45], zone: 2, description: 'Simulação de águas abertas (saída em grupo, visada, contorno de boia)' },
          { sport: 'bike', minutes: [60, 60], zone: 2, description: 'Aeróbico solto' },
          { sport: 'strength', minutes: [15, 15], zone: 1, description: 'Mobilidade' },
        ],
      },
      {
        title: 'Corrida regenerativa',
        blocks: [
          { sport: 'run', minutes: [40, 45], zone: 1, description: 'Regenerativo' },
        ],
      },
      {
        title: 'Bike longo + Brick',
        blocks: [
          { sport: 'bike', minutes: [210, 240], zone: 3, description: 'Longo com 2×45′ no ritmo de prova; nutrição exatamente como no dia' },
          { sport: 'brick', minutes: [30, 45], zone: 3, description: 'Brick longo no ritmo do 70.3' },
        ],
      },
    ],
  },

  peak: {
    name: 'Pico / Competição',
    focus: 'Polimento (taper) e prova',
    days: [
      {
        title: 'Natação',
        blocks: [
          { sport: 'swim', minutes: [60, 25], zone: 3, description: 'Séries curtas no ritmo de prova, volume reduzido' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [50, 25], zone: 4, description: 'Estímulos curtos: 4–6×2′ em Z4' },
          { sport: 'strength', minutes: [20, 0], zone: 1, description: 'Ativação leve' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [30, 20], zone: 2, description: 'Soltura com 4×50 m ritmo de prova' },
          { sport: 'bike', minutes: [60, 30], zone: 3, description: 'Blocos curtos no ritmo de prova' },
          { sport: 'strength', minutes: [15, 0], zone: 1, description: 'Mobilidade' },
        ],
      },
      {
        title: 'Corrida + Força',
        blocks: [
          { sport: 'run', minutes: [45, 20], zone: 3, description: 'Ritmo de prova curto' },
          { sport: 'strength', minutes: [15, 0], zone: 1, description: 'Ativação leve' },
        ],
      },
      {
        title: 'Natação / Bike / Força',
        blocks: [
          { sport: 'swim', minutes: [30, 15], zone: 2, description: 'Soltura' },
          { sport: 'bike', minutes: [40, 20], zone: 2, description: 'Giro leve, checar equipamento' },
        ],
      },
      {
        title: 'Corrida regenerativa',
        blocks: [
          { sport: 'run', minutes: [30, 15], zone: 1, description: 'Trote leve + 3 acelerações' },
        ],
      },
      {
        title: 'Bike longo + Brick',
        blocks: [
          { sport: 'bike', minutes: [180, 60], zone: 3, description: 'Longo reduzido com ritmo de prova' },
          { sport: 'brick', minutes: [30, 10], zone: 3, description: 'Brick curto' },
        ],
      },
    ],
  },
};

/** Sessão do dia da prova. */
export const RACE_DAY = {
  title: 'Ironman 70.3 — dia de prova',
  blocks: [
    { sport: 'race' as const, durationMin: 0, zone: 3 as ZoneNumber, description: '1,9 km natação · 90 km bike · 21,1 km corrida. Execute o plano de ritmo e nutrição.' },
  ],
};
