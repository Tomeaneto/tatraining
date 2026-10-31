import { useState, type FormEvent } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CloudOff, LogOut, Mail, RefreshCw } from 'lucide-react';
import { sendMagicLink, signOut, syncNow, verifyEmailCode } from '../../lib/sync';
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
    </>
  );
}

function SignInForm() {
  const [email, setEmail] = useState(rememberedEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setMsg({ kind: 'error', text: 'Informe um e-mail válido.' });
    setBusy(true);
    setMsg(null);
    try {
      await sendMagicLink(addr);
      try {
        localStorage.setItem(EMAIL_KEY, addr);
      } catch {
        // sem storage, só não lembra o e-mail
      }
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
      <p className="mb-3 text-ta-muted">
        Entre com o seu e-mail para guardar treinos, avaliações e configurações na nuvem e vê-los em qualquer aparelho. Sem
        login o app continua funcionando só neste aparelho.
      </p>
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
