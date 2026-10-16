import { json, readJson, stravaToken } from './_shared.js';

/** POST /api/strava/refresh  { refresh_token } → renova o access token. */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ refresh_token?: string }>(request);
  if (!body?.refresh_token) return json({ error: 'Parâmetro "refresh_token" ausente.' }, 400);
  return stravaToken({ refresh_token: body.refresh_token, grant_type: 'refresh_token' });
}
