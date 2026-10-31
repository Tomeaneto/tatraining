import type { SupabaseClient } from '@supabase/supabase-js';
import { json, supabaseAdmin } from '../strava/_shared.js';
import { analyzeMeal, type Analysis, type MealType } from './_gemini.js';
import { downloadPhoto, esc, reply, tg, type TgMessage, type TgUpdate } from './_telegram.js';

// Webhook do bot do Telegram: recebe fotos/descrições das refeições, analisa com o Gemini
// e grava em `meals` no Supabase. Configure com /api/telegram/setup (veja o README).

const TZ = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Café da manhã',
  morning_snack: 'Lanche da manhã',
  lunch: 'Almoço',
  afternoon_snack: 'Lanche da tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
  pre_workout: 'Pré-treino',
  post_workout: 'Pós-treino',
  other: 'Refeição',
};

const HELP = [
  '<b>TA Triathlon · Dieta</b>',
  'Mande uma <b>foto</b> do prato ou <b>descreva</b> o que comeu (ex.: "almoço: arroz, feijão e 150 g de frango").',
  'Eu estimo calorias e macros, comento e salvo no app.',
  '',
  '/hoje — total do dia',
  '/desfazer — apaga a última refeição registrada',
  '/ajuda — esta mensagem',
].join('\n');

interface MealRow {
  id: string;
  meal_type: MealType;
  description: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }
  const update = (await request.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  // Sempre 200: um erro aqui faria o Telegram reenviar a mesma mensagem várias vezes.
  if (!msg || msg.chat.type !== 'private') return json({ ok: true });

  try {
    await handle(msg);
  } catch (e) {
    console.error('[telegram]', e);
    await reply(msg.chat.id, `⚠️ ${esc(e instanceof Error ? e.message : 'Algo deu errado.')}`, msg.message_id).catch(() => {});
  }
  return json({ ok: true });
}

async function handle(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const db = supabaseAdmin();
  if (!db) throw new Error('Supabase não configurado no servidor (SUPABASE_SERVICE_ROLE_KEY).');

  const text = (msg.text ?? msg.caption ?? '').trim();
  const command = text.startsWith('/') ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : null;

  if (command === '/start') return link(db, msg, text.split(/\s+/)[1]);

  const { data: account } = await db.from('telegram_links').select('user_id').eq('chat_id', chatId).maybeSingle<{ user_id: string }>();
  if (!account) {
    await reply(chatId, 'Este chat ainda não está vinculado. No app, abra <b>Conectar → Telegram</b> e toque em <b>Conectar Telegram</b>.');
    return;
  }
  const userId = account.user_id;
  const today = localDate(new Date());

  if (command === '/ajuda' || command === '/help') {
    await reply(chatId, HELP);
    return;
  }
  if (command === '/hoje') {
    const meals = await mealsOn(db, userId, today);
    if (!meals.length) {
      await reply(chatId, 'Nenhuma refeição registrada hoje.');
      return;
    }
    const lines = meals.map((m) => `• <b>${MEAL_LABEL[m.meal_type]}</b>: ${esc(m.description)} — ${Math.round(m.kcal ?? 0)} kcal`);
    await reply(chatId, [`<b>Hoje</b>`, ...lines, '', `<b>Total:</b> ${macros(sum(meals))}`].join('\n'));
    return;
  }
  if (command === '/desfazer') {
    const { data: last } = await db
      .from('meals')
      .select('id, description')
      .eq('user_id', userId)
      .eq('source', 'telegram')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; description: string }>();
    if (!last) {
      await reply(chatId, 'Não há refeição para desfazer.');
      return;
    }
    const { error } = await db.from('meals').delete().eq('id', last.id);
    if (error) throw new Error(`Falha ao apagar: ${error.message}`);
    await reply(chatId, `🗑 Apagada: ${esc(last.description)}`);
    return;
  }
  if (command) {
    await reply(chatId, HELP);
    return;
  }
  if (!text && !msg.photo?.length) {
    await reply(chatId, 'Mande uma foto ou um texto descrevendo a refeição.');
    return;
  }

  // O Telegram reenvia a mensagem se a resposta demorar; não analisa a mesma duas vezes.
  const { data: dup } = await db
    .from('meals')
    .select('id')
    .eq('user_id', userId)
    .eq('telegram_chat_id', chatId)
    .eq('telegram_message_id', msg.message_id)
    .maybeSingle();
  if (dup) return;

  await tgTyping(chatId);
  const eatenAt = new Date(msg.date * 1000);
  const [photo, context] = await Promise.all([
    msg.photo?.length ? downloadPhoto(msg.photo) : Promise.resolve(undefined),
    buildContext(db, userId, eatenAt),
  ]);
  const a = await analyzeMeal({ text, photo, context });

  if (!a.is_meal) {
    await reply(chatId, esc(a.feedback || 'Não identifiquei uma refeição. Mande uma foto do prato ou descreva o que comeu.'), msg.message_id);
    return;
  }

  const { error } = await db.from('meals').insert({
    user_id: userId,
    date: localDate(eatenAt),
    eaten_at: eatenAt.toISOString(),
    meal_type: a.meal_type,
    description: a.description || text || 'Refeição',
    items: a.items,
    kcal: Math.max(0, Math.round(a.kcal)),
    protein_g: round1(a.protein_g),
    carbs_g: round1(a.carbs_g),
    fat_g: round1(a.fat_g),
    fiber_g: round1(a.fiber_g),
    feedback: a.feedback || null,
    source: 'telegram',
    telegram_chat_id: chatId,
    telegram_message_id: msg.message_id,
  });
  if (error?.code === '23505') return; // reenvio processado em paralelo
  if (error) throw new Error(`Falha ao salvar a refeição: ${error.message}`);

  const dayTotal = sum(await mealsOn(db, userId, localDate(eatenAt)));
  await reply(chatId, formatMeal(a, dayTotal), msg.message_id);
}

// ---------------------------------------------------------------------------- vínculo

async function link(db: SupabaseClient, msg: TgMessage, code: string | undefined): Promise<void> {
  const chatId = msg.chat.id;
  if (!code) {
    const { data } = await db.from('telegram_links').select('user_id').eq('chat_id', chatId).maybeSingle();
    await reply(chatId, data ? HELP : `${HELP}\n\nPara começar, vincule a sua conta no app: <b>Conectar → Telegram</b>.`);
    return;
  }

  const { data: row } = await db
    .from('telegram_links')
    .select('user_id, link_code_expires_at')
    .eq('link_code', code)
    .maybeSingle<{ user_id: string; link_code_expires_at: string | null }>();
  if (!row || !row.link_code_expires_at || new Date(row.link_code_expires_at) < new Date()) {
    await reply(chatId, 'Código inválido ou expirado. Gere outro no app em <b>Conectar → Telegram</b>.');
    return;
  }

  // Um chat só pode estar ligado a uma conta.
  await db.from('telegram_links').update({ chat_id: null }).eq('chat_id', chatId).neq('user_id', row.user_id);
  const { error } = await db
    .from('telegram_links')
    .update({
      chat_id: chatId,
      username: msg.from?.username ?? msg.from?.first_name ?? null,
      linked_at: new Date().toISOString(),
      link_code: null,
      link_code_expires_at: null,
    })
    .eq('user_id', row.user_id);
  if (error) throw new Error(`Falha ao vincular: ${error.message}`);
  await reply(chatId, `✅ Conta vinculada!\n\n${HELP}`);
}

// ---------------------------------------------------------------------------- contexto e formatação

/** Dados do atleta e do dia para o Gemini comentar a refeição com contexto. */
async function buildContext(db: SupabaseClient, userId: string, at: Date): Promise<string> {
  const day = localDate(at);
  const [profile, body, workouts, meals] = await Promise.all([
    db.from('profiles').select('age, sex, height_cm').eq('user_id', userId).maybeSingle(),
    db
      .from('body_compositions')
      .select('date, weight_kg, body_fat_pct, skeletal_muscle_kg, bmr_kcal')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('workouts').select('sport, duration_min, distance_km').eq('user_id', userId).eq('date', day),
    mealsOn(db, userId, day),
  ]);

  const lines = [
    `Data e hora local: ${day} ${at.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`,
  ];
  if (profile.data) lines.push(`Atleta: ${JSON.stringify(profile.data)}`);
  if (body.data) lines.push(`Última avaliação InBody: ${JSON.stringify(body.data)}`);
  lines.push(`Treinos realizados hoje: ${workouts.data?.length ? JSON.stringify(workouts.data) : 'nenhum registrado'}`);
  lines.push(
    meals.length
      ? `Já comeu hoje: ${meals.map((m) => `${MEAL_LABEL[m.meal_type]} (${m.description}, ${Math.round(m.kcal ?? 0)} kcal)`).join('; ')}. Total: ${macros(sum(meals))}`
      : 'Ainda não registrou refeições hoje.',
  );
  return lines.join('\n');
}

async function mealsOn(db: SupabaseClient, userId: string, day: string): Promise<MealRow[]> {
  const { data, error } = await db
    .from('meals')
    .select('id, meal_type, description, kcal, protein_g, carbs_g, fat_g')
    .eq('user_id', userId)
    .eq('date', day)
    .order('eaten_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as MealRow[];
}

type Totals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };

function sum(meals: MealRow[]): Totals {
  return meals.reduce<Totals>(
    (t, m) => ({
      kcal: t.kcal + Number(m.kcal ?? 0),
      protein_g: t.protein_g + Number(m.protein_g ?? 0),
      carbs_g: t.carbs_g + Number(m.carbs_g ?? 0),
      fat_g: t.fat_g + Number(m.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

const macros = (t: Totals) =>
  `${Math.round(t.kcal)} kcal · P ${Math.round(t.protein_g)} g · C ${Math.round(t.carbs_g)} g · G ${Math.round(t.fat_g)} g`;

function formatMeal(a: Analysis, day: Totals): string {
  return [
    `🍽 <b>${MEAL_LABEL[a.meal_type]}</b> — ${esc(a.description)}`,
    ...a.items.map((i) => `• ${esc(i.quantity)} ${esc(i.name)} — ${Math.round(i.kcal)} kcal`),
    '',
    `<b>Refeição:</b> ${macros(a)}`,
    `<b>Hoje:</b> ${macros(day)}`,
    a.feedback ? `\n💬 ${esc(a.feedback)}` : '',
    '\n<i>Errou? /desfazer</i>',
  ].join('\n');
}

const round1 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.round(v * 10) / 10) : null);

/** `yyyy-MM-dd` no fuso do atleta. */
const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

async function tgTyping(chatId: number): Promise<void> {
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
}
