// Utilitários das Vercel Functions do Strava. O secret e a service_role key só existem aqui, no servidor.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id?: number; firstname?: string; lastname?: string };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** Chama o endpoint de token do Strava com as credenciais do app. Devolve os dados ou uma Response de erro. */
export async function requestStravaToken(params: Record<string, string>): Promise<TokenResponse | Response> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json({ error: 'STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET não configurados no servidor.' }, 500);
  }

  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const data = (await res.json().catch(() => null)) as (TokenResponse & { message?: string }) | null;
  if (!res.ok || !data?.access_token) {
    return json({ error: data?.message ?? 'Falha ao autenticar no Strava.' }, res.ok ? 502 : res.status);
  }
  return data;
}

/** Modo sem login: devolve os tokens ao cliente, que os guarda no aparelho. */
export async function stravaToken(params: Record<string, string>): Promise<Response> {
  const data = await requestStravaToken(params);
  if (data instanceof Response) return data;
  return json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete ? { firstname: data.athlete.firstname, lastname: data.athlete.lastname } : undefined,
  });
}

export function athleteName(data: TokenResponse): string | null {
  return [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ') || null;
}

// ---------------------------------------------------------------------------- Supabase

let admin: SupabaseClient | null | undefined;

/** Cliente com a service_role key (ignora o RLS), ou null se o servidor não tiver as variáveis. */
export function supabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  admin = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return admin;
}

/**
 * Usuário do Supabase dono do `Authorization: Bearer <access token>`.
 * - `null`: requisição sem login (ou servidor sem Supabase) — segue o modo antigo.
 * - Response: token presente mas inválido.
 */
export async function requestUser(request: Request): Promise<{ id: string; db: SupabaseClient } | Response | null> {
  const auth = request.headers.get('authorization');
  const jwt = auth?.match(/^Bearer\s+(.+)$/i)?.[1];
  const db = supabaseAdmin();
  if (!jwt || !db) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) return json({ error: 'Sessão expirada. Entre na conta de novo.' }, 401);
  return { id: data.user.id, db };
}

export interface ConnectionRow {
  user_id: string;
  athlete_id: number | null;
  athlete_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_sync_at: string | null;
}

/** Grava os tokens em `strava_connections` e devolve ao cliente só o access token. */
export async function storeConnection(
  db: SupabaseClient,
  userId: string,
  data: TokenResponse,
  extra: { athlete_name?: string | null; last_sync_at?: string | null } = {},
): Promise<Response> {
  const row: Partial<ConnectionRow> = {
    user_id: userId,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(data.expires_at * 1000).toISOString(),
  };
  const name = athleteName(data) ?? extra.athlete_name;
  if (name) row.athlete_name = name;
  if (data.athlete?.id) row.athlete_id = data.athlete.id;
  if (extra.last_sync_at) row.last_sync_at = extra.last_sync_at;

  const { data: saved, error } = await db
    .from('strava_connections')
    .upsert(row)
    .select('athlete_name, last_sync_at')
    .single<Pick<ConnectionRow, 'athlete_name' | 'last_sync_at'>>();
  if (error) return json({ error: `Falha ao salvar a conexão: ${error.message}` }, 500);
  return json({
    stored: true,
    access_token: data.access_token,
    expires_at: data.expires_at,
    athlete_name: saved.athlete_name,
    last_sync_at: saved.last_sync_at,
  });
}
