import { subDays } from 'date-fns';
import { useStrava, type StravaTokens } from '../store/strava';
import type { Sport, Workout } from '../types';

const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const API = 'https://www.strava.com/api/v3';
const STATE_KEY = 'ta-strava-oauth-state';

export const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined;

export function redirectUri(): string {
  return `${window.location.origin}/conectar`;
}

/** Leva o usuário à tela de autorização do Strava. */
export function startStravaAuth(): void {
  if (!STRAVA_CLIENT_ID) throw new Error('VITE_STRAVA_CLIENT_ID não configurado.');
  const state = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, state);
  } catch {
    // segue sem verificação de state se o storage estiver bloqueado
  }
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
    state,
  });
  window.location.assign(`${AUTHORIZE_URL}?${params}`);
}

export function checkState(state: string | null): boolean {
  try {
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return !expected || expected === state;
  } catch {
    return true;
  }
}

interface TokenPayload {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { firstname?: string; lastname?: string };
  error?: string;
}

async function postJson(url: string, body: unknown): Promise<TokenPayload> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as TokenPayload;
  if (res.status === 404) {
    throw new Error('Servidor /api indisponível. Use o app publicado na Vercel ou rode localmente com "vercel dev".');
  }
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status} no servidor.`);
  return data;
}

const toTokens = (d: TokenPayload): StravaTokens => ({
  accessToken: d.access_token,
  refreshToken: d.refresh_token,
  expiresAt: d.expires_at,
});

/** Troca o `code` do callback por tokens (via /api/strava/token) e salva a conexão. */
export async function completeStravaAuth(code: string): Promise<void> {
  const data = await postJson('/api/strava/token', { code });
  const name = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ') || null;
  useStrava.getState().setConnection(toTokens(data), name);
}

/** Access token válido, renovando via /api/strava/refresh se faltar menos de 1 min. */
async function validAccessToken(): Promise<string> {
  const { tokens, setTokens } = useStrava.getState();
  if (!tokens) throw new Error('Strava não conectado.');
  if (tokens.expiresAt - 60 > Date.now() / 1000) return tokens.accessToken;
  const data = await postJson('/api/strava/refresh', { refresh_token: tokens.refreshToken });
  const next = toTokens(data);
  setTokens(next);
  return next.accessToken;
}

interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type: string;
  start_date_local: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  average_heartrate?: number;
  perceived_exertion?: number | null;
}

const SPORT_MAP: Record<string, Sport> = {
  Swim: 'swim',
  Ride: 'bike',
  VirtualRide: 'bike',
  GravelRide: 'bike',
  MountainBikeRide: 'bike',
  EBikeRide: 'bike',
  Velomobile: 'bike',
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  WeightTraining: 'strength',
  Crossfit: 'strength',
  Workout: 'strength',
  HighIntensityIntervalTraining: 'strength',
};

/** Converte uma atividade do Strava para o formato de treino do app (ou null se a modalidade não interessa). */
export function mapStravaActivity(a: StravaActivity): Omit<Workout, 'id'> | null {
  const sport = SPORT_MAP[a.sport_type ?? a.type] ?? SPORT_MAP[a.type];
  if (!sport) return null;
  return {
    date: a.start_date_local.slice(0, 10),
    sport,
    durationMin: Math.round((a.moving_time || a.elapsed_time) / 60),
    distanceKm: a.distance ? Math.round(a.distance) / 1000 : undefined,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
    rpe: a.perceived_exertion ? Math.round(a.perceived_exertion) : undefined,
    name: a.name,
    source: 'strava',
    externalId: String(a.id),
  };
}

/**
 * Busca atividades desde a última sincronização (ou últimos 90 dias na primeira vez).
 * Retorna os treinos mapeados; a deduplicação fica com o store.
 */
export async function fetchStravaWorkouts(): Promise<Omit<Workout, 'id'>[]> {
  const token = await validAccessToken();
  const { lastSyncAt } = useStrava.getState();
  // Volta 2 dias na margem para pegar atividades enviadas com atraso.
  const since = lastSyncAt ? subDays(new Date(lastSyncAt), 2) : subDays(new Date(), 90);
  const after = Math.floor(since.getTime() / 1000);

  const out: Omit<Workout, 'id'>[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) throw new Error('Autorização do Strava expirada. Conecte novamente.');
    if (res.status === 429) throw new Error('Limite de requisições do Strava atingido. Tente em alguns minutos.');
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar atividades.`);
    const list = (await res.json()) as StravaActivity[];
    for (const a of list) {
      const w = mapStravaActivity(a);
      if (w) out.push(w);
    }
    if (list.length < 100) break;
  }
  return out;
}
