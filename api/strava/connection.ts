import {
  json,
  readJson,
  requestStravaToken,
  requestUser,
  storeConnection,
  type ConnectionRow,
} from './_shared.js';

// Conexão do Strava guardada no Supabase (`strava_connections`). Todas as rotas exigem login.

async function authed(request: Request) {
  const user = await requestUser(request);
  if (user === null) return json({ error: 'Entre na conta (e configure o Supabase no servidor) para usar esta rota.' }, 401);
  return user;
}

/** GET → access token válido (renovado aqui se faltar menos de 1 min), nome do atleta e última sincronização. */
export async function GET(request: Request): Promise<Response> {
  const user = await authed(request);
  if (user instanceof Response) return user;

  const { data: row, error } = await user.db
    .from('strava_connections')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle<ConnectionRow>();
  if (error) return json({ error: error.message }, 500);
  if (!row) return json({ connected: false }, 404);

  const expiresAt = Math.floor(new Date(row.expires_at).getTime() / 1000);
  if (expiresAt - 60 > Date.now() / 1000) {
    return json({
      stored: true,
      access_token: row.access_token,
      expires_at: expiresAt,
      athlete_name: row.athlete_name,
      last_sync_at: row.last_sync_at,
    });
  }

  const data = await requestStravaToken({ refresh_token: row.refresh_token, grant_type: 'refresh_token' });
  if (data instanceof Response) {
    // Autorização revogada no Strava: a conexão guardada não serve mais.
    if (data.status === 400 || data.status === 401) {
      await user.db.from('strava_connections').delete().eq('user_id', user.id);
      return json({ connected: false }, 404);
    }
    return data;
  }
  return storeConnection(user.db, user.id, data);
}

/**
 * POST { refresh_token, athlete_name?, last_sync_at? } → move para o servidor uma conexão
 * feita no aparelho antes do login.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await authed(request);
  if (user instanceof Response) return user;
  const body = await readJson<{ refresh_token?: string; athlete_name?: string | null; last_sync_at?: string | null }>(request);
  if (!body?.refresh_token) return json({ error: 'Parâmetro "refresh_token" ausente.' }, 400);

  const data = await requestStravaToken({ refresh_token: body.refresh_token, grant_type: 'refresh_token' });
  if (data instanceof Response) return data;
  return storeConnection(user.db, user.id, data, { athlete_name: body.athlete_name, last_sync_at: body.last_sync_at });
}

/** PATCH { last_sync_at } → registra a última sincronização. */
export async function PATCH(request: Request): Promise<Response> {
  const user = await authed(request);
  if (user instanceof Response) return user;
  const body = await readJson<{ last_sync_at?: string }>(request);
  const at = body?.last_sync_at ? new Date(body.last_sync_at) : null;
  if (!at || Number.isNaN(at.getTime())) return json({ error: 'Parâmetro "last_sync_at" inválido.' }, 400);

  const { error } = await user.db
    .from('strava_connections')
    .update({ last_sync_at: at.toISOString() })
    .eq('user_id', user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

/** DELETE → desconecta: revoga no Strava (melhor esforço) e apaga os tokens. */
export async function DELETE(request: Request): Promise<Response> {
  const user = await authed(request);
  if (user instanceof Response) return user;

  const { data: row } = await user.db
    .from('strava_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .maybeSingle<Pick<ConnectionRow, 'access_token'>>();
  if (row) {
    await fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: row.access_token }),
    }).catch(() => {});
  }

  const { error } = await user.db.from('strava_connections').delete().eq('user_id', user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
