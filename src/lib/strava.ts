import { subDays } from 'date-fns';
import { useStrava, type StravaTokens } from '../store/strava';
import type { Sport, Workout } from '../types';
import { accessToken } from './supabase';

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
  /** Ausente quando o servidor guardou os tokens no Supabase (`stored: true`). */
  refresh_token?: string;
  expires_at: number;
  athlete?: { firstname?: string; lastname?: string };
  athlete_name?: string | null;
  last_sync_at?: string | null;
  stored?: boolean;
  connected?: boolean;
  error?: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Chama uma Vercel Function, enviando o token do Supabase quando há login. */
async function callApi(url: string, init: { method?: string; body?: unknown } = {}): Promise<TokenPayload> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const jwt = await accessToken();
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  const res = await fetch(url, {
    method: init.method ?? 'POST',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  // Sem as funções /api (ex.: `npm run dev`), o servidor devolve o index.html ou um 404 sem JSON.
  const data = (await res.json().catch(() => null)) as TokenPayload | null;
  if (data?.connected === false) return data;
  if (!data || res.status === 404) {
    throw new ApiError('Servidor /api indisponível. Use o app publicado na Vercel ou rode localmente com "vercel dev".', 404);
  }
  if (!res.ok) throw new ApiError(data.error ?? `Erro ${res.status} no servidor.`, res.status);
  return data;
}

const toTokens = (d: TokenPayload): StravaTokens => ({
  accessToken: d.access_token,
  refreshToken: d.refresh_token ?? '',
  expiresAt: d.expires_at,
});

const athleteName = (d: TokenPayload) =>
  d.athlete_name ?? ([d.athlete?.firstname, d.athlete?.lastname].filter(Boolean).join(' ') || null);

/** Troca o `code` do callback por tokens (via /api/strava/token) e salva a conexão. */
export async function completeStravaAuth(code: string): Promise<void> {
  const data = await callApi('/api/strava/token', { body: { code } });
  useStrava.getState().setConnection(toTokens(data), athleteName(data), !!data.stored);
}

/** Lê a conexão guardada no Supabase (renovando o access token no servidor se preciso). */
async function loadServerConnection(): Promise<TokenPayload | null> {
  const data = await callApi('/api/strava/connection', { method: 'GET' });
  return data.connected === false ? null : data;
}

/** Access token válido, renovando se faltar menos de 1 min. */
async function validAccessToken(): Promise<string> {
  const { tokens, serverManaged, setTokens, disconnect } = useStrava.getState();
  if (!tokens) throw new Error('Strava não conectado.');
  if (tokens.expiresAt - 60 > Date.now() / 1000) return tokens.accessToken;
  if (serverManaged) {
    const data = await loadServerConnection();
    if (!data) {
      disconnect();
      throw new Error('Strava não está mais conectado. Conecte novamente.');
    }
    setTokens(toTokens(data));
    return data.access_token;
  }
  const data = await callApi('/api/strava/refresh', { body: { refresh_token: tokens.refreshToken } });
  const next = toTokens(data);
  setTokens(next);
  return next.accessToken;
}

/**
 * Depois do login no Supabase: se o Strava foi conectado neste aparelho antes do login,
 * move o refresh token para o servidor; senão, carrega a conexão feita em outro aparelho.
 * Falhas são silenciosas (ex.: `npm run dev` sem as funções /api).
 */
export async function linkStravaAccount(): Promise<void> {
  const s = useStrava.getState();
  try {
    if (s.tokens && !s.serverManaged && s.tokens.refreshToken) {
      const data = await callApi('/api/strava/connection', {
        body: { refresh_token: s.tokens.refreshToken, athlete_name: s.athleteName, last_sync_at: s.lastSyncAt },
      });
      if (data.stored) s.setConnection(toTokens(data), athleteName(data) ?? s.athleteName, true);
      return;
    }
    const data = await loadServerConnection();
    if (data) {
      s.setConnection(toTokens(data), athleteName(data), true);
      const remote = data.last_sync_at;
      const local = useStrava.getState().lastSyncAt;
      if (remote && (!local || remote > local)) s.setLastSync(remote);
    } else if (s.serverManaged) {
      s.disconnect();
    }
  } catch (e) {
    console.warn('[strava] não foi possível ler a conexão no servidor:', e);
  }
}

/** Registra a última sincronização (no aparelho e, com login, no servidor). */
export function markStravaSynced(iso: string): void {
  const s = useStrava.getState();
  s.setLastSync(iso);
  if (s.serverManaged) {
    callApi('/api/strava/connection', { method: 'PATCH', body: { last_sync_at: iso } }).catch(() => {});
  }
}

/** Desconecta o Strava (e apaga os tokens do servidor quando estão lá). */
export async function disconnectStrava(): Promise<void> {
  const s = useStrava.getState();
  if (s.serverManaged) {
    try {
      await callApi('/api/strava/connection', { method: 'DELETE' });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
  }
  s.disconnect();
}

/** Ao sair da conta: tokens que pertencem ao servidor não ficam no aparelho. */
export function forgetServerStrava(): void {
  if (useStrava.getState().serverManaged) useStrava.getState().disconnect();
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
