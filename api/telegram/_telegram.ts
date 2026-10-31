// Chamadas à Bot API do Telegram. O token do bot só existe aqui, no servidor.

const API = 'https://api.telegram.org';

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TgPhotoSize {
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TgMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: TgPhotoSize[];
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN não configurado no servidor.');
  return token;
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null;
  if (!data?.ok) throw new Error(`Telegram ${method}: ${data?.description ?? res.status}`);
  return data.result as T;
}

/** Envia uma mensagem em HTML (escape o texto com `esc`). */
export function reply(chatId: number, html: string, replyTo?: number): Promise<unknown> {
  return tg('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}),
  });
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Baixa a foto (a maior resolução até ~1600 px) e devolve em base64 para o Gemini. */
export async function downloadPhoto(sizes: TgPhotoSize[]): Promise<{ data: string; mimeType: string }> {
  const fit = sizes.filter((p) => Math.max(p.width, p.height) <= 1600);
  const best = (fit.length ? fit : sizes).reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  const file = await tg<{ file_path?: string }>('getFile', { file_id: best.file_id });
  if (!file.file_path) throw new Error('Telegram não devolveu o arquivo da foto.');
  const res = await fetch(`${API}/file/bot${botToken()}/${file.file_path}`);
  if (!res.ok) throw new Error(`Falha ao baixar a foto (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mimeType = file.file_path.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return { data: buf.toString('base64'), mimeType };
}

let botUsername: string | undefined;

export async function getBotUsername(): Promise<string> {
  botUsername ??= process.env.TELEGRAM_BOT_USERNAME || (await tg<{ username: string }>('getMe')).username;
  return botUsername;
}
