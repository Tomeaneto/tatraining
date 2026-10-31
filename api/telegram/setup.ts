import { json } from '../strava/_shared.js';
import { tg } from './_telegram.js';

// Registra o webhook e os comandos do bot. Abra uma vez no navegador, após o deploy:
//   https://<seu-app>.vercel.app/api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const url = new URL(request.url);
  if (!secret || url.searchParams.get('secret') !== secret) {
    return json({ error: 'Informe ?secret= igual ao TELEGRAM_WEBHOOK_SECRET.' }, 401);
  }

  const webhook = `${url.origin}/api/telegram/webhook`;
  try {
    await tg('setWebhook', {
      url: webhook,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    });
    await tg('setMyCommands', {
      commands: [
        { command: 'hoje', description: 'Total de calorias e macros do dia' },
        { command: 'desfazer', description: 'Apaga a última refeição registrada' },
        { command: 'ajuda', description: 'Como usar o bot' },
      ],
    });
    const info = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>('getWebhookInfo');
    return json({ ok: true, webhook: info.url, pending: info.pending_update_count, last_error: info.last_error_message ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Falha ao configurar o webhook.' }, 502);
  }
}
