// Sincronização dos stores (localStorage) com o Supabase.
//
// - O localStorage continua sendo a fonte do app: tudo funciona sem login e offline.
// - Cada alteração nos stores vira uma operação na fila (`useSync.outbox`), enviada
//   assim que houver sessão e rede. A fila sobrevive a recarregar o app.
// - Ao logar (e ao voltar ao app), baixa tudo do Supabase e substitui o cache local,
//   reaplicando por cima o que ainda está na fila.
// - No primeiro login do aparelho, os dados locais que não existem no servidor sobem.

import type { PostgrestError, Session } from '@supabase/supabase-js';
import { DEFAULT_ATHLETE } from '../data/baseline';
import { selectBaseline, useBody } from '../store/body';
import { useSettings } from '../store/settings';
import { opKey, useSync, type Op, type OpTable } from '../store/sync';
import { useWorkouts } from '../store/workouts';
import type { BodyComposition, Workout } from '../types';
import {
  bodyToRow,
  profileToRow,
  rowToBody,
  rowToProfile,
  rowToWorkout,
  workoutToRow,
  type BodyRow,
  type ProfileRow,
  type WorkoutRow,
} from './remote';
import { forgetServerStrava, linkStravaAccount } from './strava';
import { supabase } from './supabase';

const PROFILE_ID = 'me';
const BASELINE_OP_ID = 'baseline';
const PAGE = 1000;
const PULL_INTERVAL_MS = 60_000;

/** Enquanto aplicamos dados vindos do servidor, as mudanças nos stores não entram na fila. */
let applyingRemote = false;
let currentUser: string | null = null;
let flushing: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let lastPullMs = 0;
let lastSession: Session | null = null;

const byDateDesc = (a: Workout, b: Workout) => b.date.localeCompare(a.date);
const byDateAsc = (a: BodyComposition, b: BodyComposition) => a.date.localeCompare(b.date);

function setStatus(phase: ReturnType<typeof useSync.getState>['phase'], error: string | null = null) {
  useSync.setState({ phase, error });
}

const RETRY_MS = 30_000;

/** Falha de envio/download: mensagem amigável e nova tentativa em 30 s. */
function setFailure(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  // Chrome: "Failed to fetch"; Firefox: "NetworkError…"; Safari: "Load failed".
  const network = !navigator.onLine || /failed to fetch|networkerror|load failed/i.test(msg);
  setStatus(network ? 'offline' : 'error', network ? null : msg);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void resume(true), RETRY_MS);
}
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function applyRemote(fn: () => void) {
  applyingRemote = true;
  try {
    fn();
  } finally {
    applyingRemote = false;
  }
}

// ---------------------------------------------------------------------------- fila

function enqueue(table: OpTable, id: string, kind: Op['kind']) {
  const s = useSync.getState();
  // Sem dono, os dados ainda não foram ligados a nenhuma conta: o primeiro login sobe tudo.
  if (!s.ownerId) return;
  const seq = s.seq + 1;
  const op: Op = { table, id, kind, seq };
  useSync.setState({ seq, outbox: { ...s.outbox, [opKey(op)]: op } });
  scheduleFlush();
}

function scheduleFlush(delay = 600) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), delay);
}

function watchStores() {
  useWorkouts.subscribe((s, prev) => {
    if (applyingRemote || s.workouts === prev.workouts) return;
    const before = new Map(prev.workouts.map((w) => [w.id, w]));
    const after = new Set(s.workouts.map((w) => w.id));
    for (const w of s.workouts) if (before.get(w.id) !== w) enqueue('workouts', w.id, 'upsert');
    for (const w of prev.workouts) if (!after.has(w.id)) enqueue('workouts', w.id, 'delete');
  });

  useBody.subscribe((s, prev) => {
    if (applyingRemote || s.assessments === prev.assessments) return;
    const before = new Map(prev.assessments.map((a) => [a.id, a]));
    const after = new Set(s.assessments.map((a) => a.id));
    for (const a of s.assessments) {
      if (before.get(a.id) === a) continue;
      if (a.isBaseline) enqueue('baseline', BASELINE_OP_ID, 'upsert');
      else enqueue('body', a.id, 'upsert');
    }
    // A linha de base nunca é excluída no servidor (o RLS também impede).
    for (const a of prev.assessments) if (!after.has(a.id) && !a.isBaseline) enqueue('body', a.id, 'delete');
  });

  useSettings.subscribe((s, prev) => {
    if (applyingRemote) return;
    if (s.athlete !== prev.athlete || s.program !== prev.program) enqueue('profile', PROFILE_ID, 'upsert');
  });
}

// ---------------------------------------------------------------------------- envio

/** Erros de dado (classes 22/23 do Postgres: tipo, faixa, unicidade, check) não adiantam reenviar. */
function isDataError(e: PostgrestError): boolean {
  return /^2[23]/.test(e.code ?? '');
}

/**
 * Executa um lote; se o servidor recusar algum dado, tenta um a um e descarta só os recusados.
 * Falhas de rede/sessão sobem como exceção e as operações ficam na fila.
 * Retorna as operações concluídas (a remover da fila).
 */
async function runBatch(ops: Op[], exec: (ops: Op[]) => Promise<PostgrestError | null>): Promise<Op[]> {
  if (!ops.length) return [];
  const error = await exec(ops);
  if (!error) return ops;
  if (!isDataError(error)) throw new Error(error.message);
  if (ops.length === 1) {
    console.warn('[sync] alteração recusada pelo servidor e descartada:', ops[0], error);
    return ops;
  }
  const done: Op[] = [];
  for (const op of ops) done.push(...(await runBatch([op], exec)));
  return done;
}

async function pushBaseline(uid: string): Promise<PostgrestError | null> {
  const row = bodyToRow(selectBaseline(useBody.getState().assessments));
  const { data, error } = await supabase!
    .from('body_compositions')
    .update(row)
    .eq('is_baseline', true)
    .select('id');
  if (error || data.length) return error;
  // Ainda não há linha de base no servidor (schema rodado depois do cadastro?): cria.
  return (await supabase!.from('body_compositions').insert({ ...row, is_baseline: true, user_id: uid })).error;
}

async function pushOps(uid: string, ops: Op[]): Promise<Op[]> {
  const sb = supabase!;
  const of = (table: OpTable, kind: Op['kind']) => ops.filter((o) => o.table === table && o.kind === kind);
  const done: Op[] = [];

  const workouts = new Map(useWorkouts.getState().workouts.map((w) => [w.id, w]));
  const wUp = of('workouts', 'upsert');
  done.push(...wUp.filter((o) => !workouts.has(o.id))); // já excluído localmente
  done.push(
    ...(await runBatch(
      wUp.filter((o) => workouts.has(o.id)),
      async (list) =>
        (await sb.from('workouts').upsert(list.map((o) => ({ ...workoutToRow(workouts.get(o.id)!), user_id: uid })))).error,
    )),
  );
  done.push(
    ...(await runBatch(of('workouts', 'delete'), async (list) =>
      (await sb.from('workouts').delete().in('id', list.map((o) => o.id))).error,
    )),
  );

  const assessments = new Map(useBody.getState().assessments.map((a) => [a.id, a]));
  const bUp = of('body', 'upsert');
  done.push(...bUp.filter((o) => !assessments.get(o.id) || assessments.get(o.id)!.isBaseline));
  done.push(
    ...(await runBatch(
      bUp.filter((o) => assessments.get(o.id) && !assessments.get(o.id)!.isBaseline),
      async (list) =>
        (
          await sb
            .from('body_compositions')
            .upsert(list.map((o) => ({ ...bodyToRow(assessments.get(o.id)!), id: o.id, user_id: uid })))
        ).error,
    )),
  );
  done.push(
    ...(await runBatch(of('body', 'delete'), async (list) =>
      (await sb.from('body_compositions').delete().in('id', list.map((o) => o.id))).error,
    )),
  );
  done.push(...(await runBatch(of('baseline', 'upsert'), () => pushBaseline(uid))));

  done.push(
    ...(await runBatch(of('profile', 'upsert'), async () => {
      const { athlete, program } = useSettings.getState();
      return (await sb.from('profiles').upsert({ user_id: uid, ...profileToRow(athlete, program) })).error;
    })),
  );
  return done;
}

/** Envia a fila. Seguro chamar a qualquer momento: sem sessão/rede, não faz nada. */
export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const uid = currentUser;
    if (!supabase || !uid || useSync.getState().ownerId !== uid) return;
    const ops = Object.values(useSync.getState().outbox);
    if (!ops.length) return;
    if (!navigator.onLine) return setStatus('offline');
    setStatus('syncing');
    try {
      const done = await pushOps(uid, ops);
      useSync.setState((s) => {
        const outbox = { ...s.outbox };
        for (const op of done) if (outbox[opKey(op)]?.seq === op.seq) delete outbox[opKey(op)];
        return { outbox, lastSyncAt: new Date().toISOString() };
      });
      setStatus('idle');
    } catch (e) {
      setFailure(e);
    }
  })().finally(() => {
    flushing = null;
    // Chegaram alterações durante o envio? Manda de novo (em caso de erro, setFailure já agendou).
    const s = useSync.getState();
    if (s.phase === 'idle' && Object.keys(s.outbox).length) scheduleFlush();
  });
  return flushing;
}

// ---------------------------------------------------------------------------- download

async function fetchAll<T>(table: string, order: string, ascending: boolean): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from(table)
      .select('*')
      .order(order, { ascending })
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data as T[]));
    if (data.length < PAGE) return out;
  }
}

interface Remote {
  profile: ProfileRow | null;
  workouts: Workout[];
  assessments: BodyComposition[];
  baselineRow: BodyRow | undefined;
}

async function fetchRemote(): Promise<Remote> {
  const [profile, workoutRows, bodyRows] = await Promise.all([
    supabase!.from('profiles').select('*').maybeSingle<ProfileRow>(),
    fetchAll<WorkoutRow>('workouts', 'date', false),
    fetchAll<BodyRow>('body_compositions', 'date', true),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  return {
    profile: profile.data,
    workouts: workoutRows.map(rowToWorkout),
    assessments: bodyRows.map(rowToBody),
    baselineRow: bodyRows.find((r) => r.is_baseline),
  };
}

/** Nunca editado desde que o cadastro criou a linha (created_at = updated_at). */
const untouched = (row: { created_at?: string; updated_at?: string } | null | undefined) =>
  !row || row.created_at === row.updated_at;

/** Coloca a linha de base local no lugar da do servidor, mantendo o id do servidor. */
function withLocalBaseline(list: BodyComposition[], local: BodyComposition): BodyComposition[] {
  const server = list.find((a) => a.isBaseline);
  const merged = { ...local, id: server?.id ?? local.id, isBaseline: true };
  return [merged, ...list.filter((a) => !a.isBaseline)];
}

/** Grava nos stores o que veio do servidor, sem gerar novas operações na fila. */
function applyState(workouts: Workout[], assessments: BodyComposition[], profile: ProfileRow | null, keepLocalProfile: boolean) {
  applyRemote(() => {
    useWorkouts.setState({ workouts: [...workouts].sort(byDateDesc) });
    useBody.setState({ assessments: [...assessments].sort(byDateAsc) });
    if (profile && !keepLocalProfile) useSettings.setState(rowToProfile(profile, DEFAULT_ATHLETE));
  });
}

/** Baixa o servidor e substitui o cache local, mantendo por cima o que ainda não foi enviado. */
async function pullReplace() {
  const remote = await fetchRemote();
  const pending = Object.values(useSync.getState().outbox);
  const localW = new Map(useWorkouts.getState().workouts.map((w) => [w.id, w]));
  const localB = useBody.getState().assessments;
  const localBMap = new Map(localB.map((a) => [a.id, a]));

  const workouts = new Map(remote.workouts.map((w) => [w.id, w]));
  const assessments = new Map(remote.assessments.map((a) => [a.id, a]));
  for (const op of pending) {
    if (op.table === 'workouts') {
      if (op.kind === 'delete') workouts.delete(op.id);
      else if (localW.has(op.id)) workouts.set(op.id, localW.get(op.id)!);
    } else if (op.table === 'body') {
      if (op.kind === 'delete') assessments.delete(op.id);
      else if (localBMap.has(op.id)) assessments.set(op.id, localBMap.get(op.id)!);
    }
  }
  let body = [...assessments.values()];
  const baselinePending = pending.some((o) => o.table === 'baseline');
  if (baselinePending || !remote.baselineRow) {
    body = withLocalBaseline(body, selectBaseline(localB));
    if (!remote.baselineRow) enqueue('baseline', BASELINE_OP_ID, 'upsert');
  }
  const keepProfile = !remote.profile || pending.some((o) => o.table === 'profile');
  if (!remote.profile) enqueue('profile', PROFILE_ID, 'upsert');

  applyState([...workouts.values()], body, remote.profile, keepProfile);
}

/** Primeiro login neste aparelho: junta o servidor com o que já existia localmente. */
async function pullAdopt(uid: string) {
  const remote = await fetchRemote();
  const ops: Omit<Op, 'seq'>[] = [];

  const ids = new Set(remote.workouts.map((w) => w.id));
  const external = new Set(remote.workouts.filter((w) => w.externalId).map((w) => `${w.source}:${w.externalId}`));
  const planned = new Set(remote.workouts.filter((w) => w.plannedDate).map((w) => w.plannedDate));
  const extraW = useWorkouts.getState().workouts.filter(
    (w) =>
      !ids.has(w.id) &&
      !(w.externalId && external.has(`${w.source}:${w.externalId}`)) &&
      !(w.source === 'plan' && w.plannedDate && planned.has(w.plannedDate)),
  );
  for (const w of extraW) ops.push({ table: 'workouts', id: w.id, kind: 'upsert' });

  const localB = useBody.getState().assessments;
  const bIds = new Set(remote.assessments.map((a) => a.id));
  const bKeys = new Set(remote.assessments.map((a) => `${a.date}:${a.weightKg}`));
  const extraB = localB.filter((a) => !a.isBaseline && !bIds.has(a.id) && !bKeys.has(`${a.date}:${a.weightKg}`));
  for (const a of extraB) ops.push({ table: 'body', id: a.id, kind: 'upsert' });

  // Linha de base e perfil: se o servidor ainda tem só o que o cadastro criou, vale o do aparelho.
  let body = [...remote.assessments, ...extraB];
  if (untouched(remote.baselineRow)) {
    body = withLocalBaseline(body, selectBaseline(localB));
    ops.push({ table: 'baseline', id: BASELINE_OP_ID, kind: 'upsert' });
  }
  const keepProfile = untouched(remote.profile);
  if (keepProfile) ops.push({ table: 'profile', id: PROFILE_ID, kind: 'upsert' });

  applyState([...remote.workouts, ...extraW], body, remote.profile, keepProfile);

  let seq = useSync.getState().seq;
  const outbox: Record<string, Op> = {};
  for (const op of ops) {
    const full = { ...op, seq: ++seq };
    outbox[opKey(full)] = full;
  }
  useSync.setState({ ownerId: uid, outbox, seq });
}

/** Baixa do servidor (respeitando a fila) — usado ao abrir o app, voltar a ele ou no botão. */
export async function syncNow(): Promise<void> {
  const uid = currentUser;
  if (!supabase || !uid || useSync.getState().ownerId !== uid) return;
  if (!navigator.onLine) return setStatus('offline');
  lastPullMs = Date.now();
  await flush();
  setStatus('syncing');
  try {
    await pullReplace();
    useSync.setState({ lastSyncAt: new Date().toISOString() });
    setStatus('idle');
  } catch (e) {
    setFailure(e);
    return;
  }
  await flush();
}

// ---------------------------------------------------------------------------- sessão

async function onSignedIn(session: Session) {
  const uid = session.user.id;
  useSync.setState({ email: session.user.email ?? null });
  if (currentUser === uid) {
    // Mesma sessão (renovação de token, aba voltando ao foco…).
    if (Date.now() - lastPullMs > PULL_INTERVAL_MS) await syncNow();
    return;
  }
  lastSession = session;
  if (!navigator.onLine) {
    // Sem rede: tenta de novo quando ela voltar (resume).
    setStatus('offline');
    return;
  }
  currentUser = uid;
  const owner = useSync.getState().ownerId;

  if (owner === uid) {
    await syncNow();
  } else {
    setStatus('syncing');
    lastPullMs = Date.now();
    try {
      if (owner === null) {
        await pullAdopt(uid);
      } else {
        // Dados locais de outra conta: não sobem; o aparelho passa a espelhar a conta nova.
        useSync.setState({ ownerId: uid, outbox: {} });
        applyRemote(() => useSettings.getState().reset());
        await pullReplace();
      }
      useSync.setState({ lastSyncAt: new Date().toISOString() });
      setStatus('idle');
    } catch (e) {
      // Sem dono definido, o próximo login (ou recarga) tenta a junção de novo.
      if (owner !== null) useSync.setState({ ownerId: owner });
      currentUser = null;
      setFailure(e);
      return;
    }
    await flush();
  }
  await linkStravaAccount();
}

function onSignedOut() {
  currentUser = null;
  lastSession = null;
  useSync.setState({ email: null });
  setStatus('off');
  forgetServerStrava();
}

let started = false;

/** Liga a sincronização (chamado uma vez no main.tsx). Sem Supabase configurado, não faz nada. */
export function initSync(): void {
  if (!supabase || started) return;
  started = true;
  watchStores();

  supabase.auth.onAuthStateChange((event, session) => {
    // O callback não pode chamar o Supabase direto (trava o lock da sessão): adia.
    setTimeout(() => {
      if (session) void onSignedIn(session);
      else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') onSignedOut();
    }, 0);
  });

  window.addEventListener('online', () => void resume(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void resume(false);
  });
}

/** Volta a sincronizar quando a rede volta ou o app volta ao primeiro plano. */
function resume(force: boolean): Promise<void> {
  if (!lastSession) return Promise.resolve();
  // Login ainda não concluído (estava offline ou falhou): refaz o fluxo de login.
  if (currentUser !== lastSession.user.id) return onSignedIn(lastSession);
  if (force || Date.now() - lastPullMs > PULL_INTERVAL_MS) return syncNow();
  return Promise.resolve();
}

// ---------------------------------------------------------------------------- login

export async function sendMagicLink(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/conectar` },
  });
  if (error) throw new Error(error.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente de novo.' : error.message);
}

/** Código de 6 dígitos do e-mail — útil no PWA do iPhone, onde o link abre no Safari. */
export async function verifyEmailCode(email: string, token: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error('Código inválido ou expirado.');
}

function authMessage(error: { message: string; status?: number }): string {
  if (error.status === 429) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (/invalid login credentials/i.test(error.message)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(error.message)) return 'Confirme o e-mail antes de entrar (veja a sua caixa de entrada).';
  if (/already registered/i.test(error.message)) return 'Este e-mail já tem conta. Entre com a senha ou com o código.';
  if (/password should be at least/i.test(error.message)) return 'A senha precisa ter pelo menos 6 caracteres.';
  return error.message;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(authMessage(error));
}

/** Cria a conta. Devolve `false` quando o Supabase exige confirmar o e-mail antes de entrar. */
export async function signUpWithPassword(email: string, password: string): Promise<boolean> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/conectar` },
  });
  if (error) throw new Error(authMessage(error));
  // Com a confirmação ativa, um e-mail já cadastrado volta sem erro e sem identidades.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('Este e-mail já tem conta. Entre com a senha ou com o código.');
  }
  return !!data.session;
}

/** Define ou troca a senha da conta logada (ex.: quem entrou pelo código). */
export async function setPassword(password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(authMessage(error));
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await flush();
  await supabase.auth.signOut({ scope: 'local' });
}

export function pendingCount(): number {
  return Object.keys(useSync.getState().outbox).length;
}
