import { json, readJson, stravaToken } from './_shared.js';

/** POST /api/strava/token  { code } → troca o código de autorização por tokens. */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson<{ code?: string }>(request);
  if (!body?.code) return json({ error: 'Parâmetro "code" ausente.' }, 400);
  return stravaToken({ code: body.code, grant_type: 'authorization_code' });
}
