import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send, Unlink } from 'lucide-react';
import { accessToken, supabase } from '../../lib/supabase';
import { useSync } from '../../store/sync';
import { Button } from '../ui/Button';
import { Card, CardTitle } from '../ui/Card';

type Status = { linked: boolean; username: string | null };
type Msg = { kind: 'ok' | 'error'; text: string } | null;

async function call<T>(method: 'GET' | 'POST' | 'DELETE'): Promise<T> {
  const jwt = await accessToken();
  const res = await fetch('/api/telegram/link', {
    method,
    headers: jwt ? { authorization: `Bearer ${jwt}` } : {},
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) throw new Error(data?.error ?? 'Funções /api indisponíveis (rode com `vercel dev` ou no deploy).');
  return data;
}

export function TelegramCard() {
  const email = useSync((s) => s.email);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await call<Status>('GET');
      setStatus(s);
      if (s.linked) {
        setLinkUrl(null);
        setMsg(null);
      }
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao consultar o Telegram.' });
    }
  }, []);

  useEffect(() => {
    if (email) void refresh();
    else setStatus(null);
  }, [email, refresh]);

  async function connect() {
    setBusy(true);
    setMsg(null);
    try {
      const { url } = await call<{ url: string }>('POST');
      // Link tocado pelo usuário: o iOS bloqueia window.open depois de um await.
      setLinkUrl(url);
      setMsg({ kind: 'ok', text: 'Abra o Telegram, toque em "Iniciar" e depois volte aqui e toque em Verificar. O link vale 15 min.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao gerar o link.' });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Desvincular o Telegram? As refeições já registradas continuam salvas.')) return;
    setBusy(true);
    try {
      await call('DELETE');
      setStatus({ linked: false, username: null });
      setMsg(null);
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao desvincular.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <CardTitle className="mb-0">Telegram · Dieta</CardTitle>
        {status?.linked && <span className="text-xs font-semibold uppercase tracking-wider text-ta-yellow">Conectado</span>}
      </div>

      {!supabase || !email ? (
        <p className="text-ta-muted">
          Entre na conta (acima) para conectar o bot do Telegram. Você manda fotos ou descrições das refeições e o Gemini
          calcula calorias e macros e salva tudo na sua conta.
        </p>
      ) : status?.linked ? (
        <>
          <p className="mb-3 text-ta-muted">
            Vinculado{status.username ? <> a <span className="font-semibold text-ta-text">@{status.username}</span></> : null}.
            Mande uma foto ou descreva a refeição no chat do bot. Use <code className="text-ta-silver">/hoje</code> para ver o
            total do dia.
          </p>
          <Button variant="danger" block onClick={() => void disconnect()} disabled={busy}>
            <Unlink size={18} aria-hidden />
            Desvincular
          </Button>
        </>
      ) : (
        <>
          <p className="mb-3 text-ta-muted">
            Mande fotos ou descrições das refeições para o bot. O Gemini estima calorias e macros, comenta considerando os
            treinos do dia e salva na sua conta.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void connect()} disabled={busy}>
              <Send size={18} aria-hidden />
              Conectar Telegram
            </Button>
            <Button variant="secondary" aria-label="Verificar vínculo" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw size={18} aria-hidden />
            </Button>
          </div>
          {linkUrl && (
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-ta-gold/60 px-4 text-base font-semibold uppercase tracking-wider text-ta-gold hover:bg-ta-gold/10"
            >
              <Send size={18} aria-hidden />
              Abrir no Telegram
            </a>
          )}
        </>
      )}

      {msg && (
        <p role="status" className={`mt-3 text-sm ${msg.kind === 'ok' ? 'text-ta-yellow' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}
    </Card>
  );
}
