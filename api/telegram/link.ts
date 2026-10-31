import { randomBytes } from 'node:crypto';
import { json, requestUser } from '../strava/_shared.js';
import { getBotUsername } from './_telegram.js';

// Vínculo da conta com o chat do Telegram (`telegram_links`). Todas as rotas exigem login.

const CODE_TTL_MIN = 15;

async function authed(request: Request) {
  const user = await requestUser(request);
  if (user === null) return json({ error: 'Entre na conta para conectar o Telegram.' }, 401);
  return user;
}

/** GET → { linked, username } */
export async function GET(request: Request): Promise<Response> {
  const user = await authed(request);
  if (user instanceof Response) return user;
  const { data, error } = await user.db
    .from('telegram_links')
    .select('chat_id, username')
    .eq('user_id', user.id)
    .maybeSingle<{ chat_id: number | null; username: string | null }>();
  if (error) return json({ error: error.message }, 500);
  return json({ linked: !!data?.chat_id, username: data?.username ?? null });
}

/** POST → { url } com o link `t.me/<bot>?start=<código>` (vale 15 min, uso único). */
export async function POST(request: Request): Promise<Response> {
  const user = await authed(request);
  if (user instanceof Response) return user;

  let bot: string;
  try {
    bot = await getBotUsername();
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bot do Telegram não configurado.' }, 500);
  }
  const code = randomBytes(18).toString('base64url');
  const { error } = await user.db.from('telegram_links').upsert({
    user_id: user.id,
    link_code: code,
    link_code_expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
  });
  if (error) return json({ error: error.message }, 500);
  return json({ url: `https://t.me/${bot}?start=${code}` });
}

/** DELETE → desvincula o chat. */
export async function DELETE(request: Request): Promise<Response> {
  const user = await authed(request);
  if (user instanceof Response) return user;
  const { error } = await user.db.from('telegram_links').delete().eq('user_id', user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
