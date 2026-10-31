import { json, readJson, requestStravaToken, requestUser, storeConnection, stravaToken } from './_shared.js';

/**
 * POST /api/strava/token  { code } → troca o código de autorização por tokens.
 * Com login no Supabase (Authorization: Bearer …), os tokens ficam em `strava_connections`
 * e o cliente recebe só o access token. Sem login, o cliente recebe os dois tokens.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ code?: string }>(request);
  if (!body?.code) return json({ error: 'Parâmetro "code" ausente.' }, 400);
  const params = { code: body.code, grant_type: 'authorization_code' };

  const user = await requestUser(request);
  if (user instanceof Response) return user;
  if (!user) return stravaToken(params);

  const data = await requestStravaToken(params);
  if (data instanceof Response) return data;
  return storeConnection(user.db, user.id, data);
}
