import { useState, type FormEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CloudOff, KeyRound, LogOut, Mail, RefreshCw, UserPlus } from 'lucide-react';
import {
  sendMagicLink,
  setPassword,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  syncNow,
  verifyEmailCode,
} from '../../lib/sync';
import { supabase } from '../../lib/supabase';
import { useSync } from '../../store/sync';
import { Button } from '../ui/Button';
import { Card, CardTitle } from '../ui/Card';
import { Field, Input } from '../ui/Field';

type Msg = { kind: 'ok' | 'error'; text: string } | null;

const EMAIL_KEY = 'ta-login-email';

function rememberedEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function AccountCard() {
  const { email, phase, error, lastSyncAt, outbox } = useSync();
  const pending = Object.keys(outbox).length;

  if (!supabase) {
    return (
      <Card>
        <CardTitle>Conta</CardTitle>
        <p className="text-ta-muted">
          Configure <code className="text-ta-silver">VITE_SUPABASE_URL</code> e{' '}
          <code className="text-ta-silver">VITE_SUPABASE_ANON_KEY</code> para sincronizar os dados entre aparelhos. Veja o
          README.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <CardTitle className="mb-0">Conta</CardTitle>
        {email && <span className="text-xs font-semibold uppercase tracking-wider text-ta-yellow">Conectado</span>}
      </div>
      {email ? (
        <SignedIn email={email} phase={phase} error={error} lastSyncAt={lastSyncAt} pending={pending} />
      ) : (
        <SignInForm />
      )}
    </Card>
  );
}

function SignedIn(props: { email: string; phase: string; error: string | null; lastSyncAt: string | null; pending: number }) {
  const { email, phase, error, lastSyncAt, pending } = props;
  const syncing = phase === 'syncing';

  let status: string;
  if (syncing) status = 'Sincronizando…';
  else if (phase === 'offline') status = pending ? `Sem conexão · ${pending} alteração(ões) aguardando envio` : 'Sem conexão';
  else if (phase === 'error') status = `Erro ao sincronizar: ${error ?? 'tente de novo'}`;
  else if (pending) status = `${pending} alteração(ões) aguardando envio`;
  else if (lastSyncAt) status = `Sincronizado ${formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: ptBR })}`;
  else status = 'Aguardando a primeira sincronização';

  return (
    <>
      <p className="mb-1 text-ta-muted">
        <span className="font-semibold text-ta-text">{email}</span>
      </p>
      <p role="status" className={`mb-3 flex items-center gap-1.5 text-sm ${phase === 'error' ? 'text-red-400' : 'text-ta-muted'}`}>
        {phase === 'offline' && <CloudOff size={14} aria-hidden />}
        {status}
      </p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void syncNow()} disabled={syncing}>
          <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} aria-hidden />
          Sincronizar agora
        </Button>
        <Button
          variant="secondary"
          aria-label="Sair da conta"
          onClick={() => {
            const warn = pending ? ` Há ${pending} alteração(ões) ainda não enviadas; elas sobem no próximo login.` : '';
            if (window.confirm(`Sair da conta? Os dados continuam neste aparelho.${warn}`)) void signOut();
          }}
        >
          <LogOut size={18} aria-hidden />
        </Button>
      </div>
      <SetPasswordForm />
    </>
  );
}

function rememberEmail(addr: string) {
  try {
    localStorage.setItem(EMAIL_KEY, addr);
  } catch {
    // sem storage, só não lembra o e-mail
  }
}

const validEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);

function SignInForm() {
  const [mode, setMode] = useState<'password' | 'code'>('password');
  return (
    <>
      <p className="mb-3 text-ta-muted">
        Entre para guardar treinos, avaliações e configurações na nuvem e vê-los em qualquer aparelho. Sem login o app
        continua funcionando só neste aparelho.
      </p>
      <div role="tablist" aria-label="Forma de entrar" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ta-card2 p-1">
        {(
          [
            ['password', 'Senha'],
            ['code', 'Código por e-mail'],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-[40px] rounded-lg text-sm font-semibold uppercase tracking-wider transition-colors ${
              mode === m ? 'bg-ta-gold text-ta-bg' : 'text-ta-muted hover:text-ta-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'password' ? <PasswordForm /> : <CodeForm />}
    </>
  );
}

function PasswordForm() {
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPasswordValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!validEmail(addr)) return setMsg({ kind: 'error', text: 'Informe um e-mail válido.' });
    if (password.length < 6) return setMsg({ kind: 'error', text: 'A senha precisa ter pelo menos 6 caracteres.' });
    setBusy(true);
    setMsg(null);
    try {
      rememberEmail(addr);
      if (!creating) await signInWithPassword(addr, password);
      else if (!(await signUpWithPassword(addr, password))) {
        setMsg({ kind: 'ok', text: `Conta criada! Confirme pelo link enviado para ${addr} e depois entre com a senha.` });
        setCreating(false);
      }
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Falha ao entrar.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="E-mail">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
        />
      </Field>
      <Field label="Senha" hint={creating ? 'Pelo menos 6 caracteres.' : undefined}>
        <Input
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPasswordValue(e.target.value)}
        />
      </Field>
      <Button type="submit" block disabled={busy}>
        {creating ? <UserPlus size={18} aria-hidden /> : <KeyRound size={18} aria-hidden />}
        {creating ? 'Criar conta' : 'Entrar'}
      </Button>
      <Button
        variant="ghost"
        block
        onClick={() => {
          setCreating(!creating);
          setMsg(null);
        }}
      >
        {creating ? 'Já tenho conta' : 'Criar conta com senha'}
      </Button>
      {!creating && (
        <p className="text-sm text-ta-muted">
          Esqueceu a senha ou só entrou por código até agora? Use <b>Código por e-mail</b> e defina a senha depois de
          entrar.
        </p>
      )}
      {msg && (
        <p role="status" className={`text-sm ${msg.kind === 'ok' ? 'text-ta-yellow' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

function SetPasswordForm() {
  const [open, setOpen] = useState(false);
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setMsg({ kind: 'error', text: 'A senha precisa ter pelo menos 6 caracteres.' });
    if (password !== confirm) return setMsg({ kind: 'error', text: 'As senhas não conferem.' });
    setBusy(true);
    setMsg(null);
    try {
      await setPassword(password);
      setPasswordValue('');
      setConfirm('');
      setOpen(false);
      setMsg({ kind: 'ok', text: 'Senha salva. Da próxima vez, entre com e-mail e senha.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Falha ao salvar a senha.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {open ? (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Nova senha" hint="Pelo menos 6 caracteres.">
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPasswordValue(e.target.value)} />
          </Field>
          <Field label="Repita a senha">
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={busy}>
              Salvar senha
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="ghost" block onClick={() => setOpen(true)}>
          <KeyRound size={18} aria-hidden />
          Definir / trocar senha
        </Button>
      )}
      {msg && (
        <p role="status" className={`mt-2 text-sm ${msg.kind === 'ok' ? 'text-ta-yellow' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function CodeForm() {
  const [email, setEmail] = useState(rememberedEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!validEmail(addr)) return setMsg({ kind: 'error', text: 'Informe um e-mail válido.' });
    setBusy(true);
    setMsg(null);
    try {
      await sendMagicLink(addr);
      rememberEmail(addr);
      setSentTo(addr);
      setMsg({ kind: 'ok', text: `Enviamos um link para ${addr}. Abra o e-mail neste aparelho para entrar.` });
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Falha ao enviar o link.' });
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setMsg(null);
    try {
      await verifyEmailCode(sentTo, code.trim());
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Falha ao entrar.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={send} className="space-y-3" noValidate>
        <Field label="E-mail">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </Field>
        <Button type="submit" block disabled={busy}>
          <Mail size={18} aria-hidden />
          {sentTo ? 'Reenviar link' : 'Enviar link de acesso'}
        </Button>
      </form>

      {sentTo && (
        <form onSubmit={verify} className="mt-4 space-y-3" noValidate>
          <Field label="Ou digite o código do e-mail" hint="Útil no app instalado no iPhone, onde o link abre no Safari.">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Button type="submit" variant="secondary" block disabled={busy || code.length < 6}>
            Entrar com o código
          </Button>
        </form>
      )}

      {msg && (
        <p role="status" className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-ta-yellow' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}
    </>
  );
}
