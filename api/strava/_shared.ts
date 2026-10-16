// Utilitários das Vercel Functions do Strava. O secret só existe aqui, no servidor.

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { firstname?: string; lastname?: string };
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

/** Chama o endpoint de token do Strava com as credenciais do app. */
export async function stravaToken(params: Record<string, string>): Promise<Response> {
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

  // Devolve só o necessário ao cliente.
  return json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete: data.athlete ? { firstname: data.athlete.firstname, lastname: data.athlete.lastname } : undefined,
  });
}
