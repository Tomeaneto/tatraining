import { json, supabaseAdmin } from '../strava/_shared.js';
import { tg } from './_telegram.js';

// Diagnóstico do bot: mostra o que falta configurar. Abra no navegador:
//   https://<seu-app>.vercel.app/api/telegram/status?secret=<TELEGRAM_WEBHOOK_SECRET>
// Sem o secret, mostra só quais variáveis existem (nunca os valores).

type Check = { ok: boolean; detail?: unknown };

export async function GET(request: Request): Promise<Response> {
  const env = {
    TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: !!process.env.TELEGRAM_WEBHOOK_SECRET,
    GEMINI_API_KEY: !!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY),
    SUPABASE_URL: !!(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || new URL(request.url).searchParams.get('secret') !== secret) {
    return json({ env, hint: 'Para o diagnóstico completo, abra com ?secret=<TELEGRAM_WEBHOOK_SECRET>.' });
  }

  const checks: Record<string, Check> = {};
  const expected = `${new URL(request.url).origin}/api/telegram/webhook`;

  try {
    const me = await tg<{ username: string }>('getMe');
    checks.bot = { ok: true, detail: `@${me.username}` };
    const info = await tg<{
      url: string;
      pending_update_count: number;
      last_error_date?: number;
      last_error_message?: string;
    }>('getWebhookInfo');
    checks.webhook = {
      ok: info.url === expected,
      detail: {
        registrado: info.url || '(nenhum — abra /api/telegram/setup?secret=…)',
        esperado: expected,
        pendentes: info.pending_update_count,
        ultimo_erro: info.last_error_message
          ? `${new Date(info.last_error_date! * 1000).toISOString()} — ${info.last_error_message}`
          : null,
      },
    };
  } catch (e) {
    checks.bot = { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }

  const db = supabaseAdmin();
  if (!db) checks.supabase = { ok: false, detail: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.' };
  else {
    for (const table of ['telegram_links', 'meals'] as const) {
      const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
      checks[`tabela_${table}`] = error
        ? { ok: false, detail: `${error.message} — rode o supabase/schema.sql no SQL Editor.` }
        : { ok: true, detail: `${count ?? 0} linha(s)` };
    }
    const { count } = await db.from('telegram_links').select('*', { count: 'exact', head: true }).not('chat_id', 'is', null);
    checks.contas_vinculadas = {
      ok: (count ?? 0) > 0,
      detail: count
        ? `${count}`
        : process.env.TELEGRAM_LINK_TOKEN
          ? 'nenhuma — mande "/start <TELEGRAM_LINK_TOKEN>" ao bot'
          : 'nenhuma — no app: Conectar → Telegram · Dieta → Conectar Telegram',
    };
  }

  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!key) checks.gemini = { ok: false, detail: 'GEMINI_API_KEY ausente.' };
  else {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
      headers: { 'x-goog-api-key': key },
    });
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    checks.gemini = res.ok ? { ok: true, detail: model } : { ok: false, detail: body?.error?.message ?? res.status };
  }

  return json({ ok: Object.values(env).every(Boolean) && Object.values(checks).every((c) => c.ok), env, checks });
}
