import { useState } from 'react';
import { RefreshCw, Unlink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { disconnectStrava, fetchStravaWorkouts, markStravaSynced, startStravaAuth, STRAVA_CLIENT_ID } from '../../lib/strava';
import { useStrava } from '../../store/strava';
import { useWorkouts } from '../../store/workouts';
import { Button } from '../ui/Button';
import { Card, CardTitle } from '../ui/Card';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function StravaCard({ status: externalStatus }: { status: Status }) {
  const { tokens, athleteName, lastSyncAt } = useStrava();
  const importMany = useWorkouts((s) => s.importMany);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const shown = status ?? externalStatus;

  async function sync() {
    setBusy(true);
    setStatus(null);
    try {
      const list = await fetchStravaWorkouts();
      const added = importMany(list);
      markStravaSynced(new Date().toISOString());
      setStatus({
        kind: 'ok',
        text: added
          ? `${added} ${added === 1 ? 'treino importado' : 'treinos importados'}.`
          : 'Tudo em dia — nenhuma atividade nova.',
      });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao sincronizar.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <CardTitle className="mb-0">Strava</CardTitle>
        {tokens && <span className="text-xs font-semibold uppercase tracking-wider text-ta-yellow">Conectado</span>}
      </div>

      {!STRAVA_CLIENT_ID ? (
        <p className="text-ta-muted">
          Configure <code className="text-ta-silver">VITE_STRAVA_CLIENT_ID</code> (e as variáveis do servidor) para ativar a
          conexão. Veja o README.
        </p>
      ) : tokens ? (
        <>
          <p className="mb-3 text-ta-muted">
            {athleteName ? <span className="font-semibold text-ta-text">{athleteName}</span> : 'Conta conectada'}
            {' · '}
            {lastSyncAt
              ? `última sincronização ${formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: ptBR })}`
              : 'ainda não sincronizado'}
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={sync} disabled={busy}>
              <RefreshCw size={18} className={busy ? 'animate-spin' : ''} aria-hidden />
              {busy ? 'Sincronizando…' : 'Sincronizar'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!window.confirm('Desconectar o Strava? Os treinos já importados continuam salvos.')) return;
                disconnectStrava().catch((e: unknown) =>
                  setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao desconectar.' }),
                );
              }}
              aria-label="Desconectar Strava"
            >
              <Unlink size={18} aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-ta-muted">
            Importe suas atividades de natação, bike, corrida e força. Na primeira sincronização vêm os últimos 90 dias.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                startStravaAuth();
              } catch (e) {
                setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao iniciar.' });
              }
            }}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#FC4C02] px-4 text-base font-semibold uppercase tracking-wider text-white hover:bg-[#e34402]"
          >
            Conectar com Strava
          </button>
        </>
      )}

      {shown && (
        <p role="status" className={`mt-3 text-sm ${shown.kind === 'ok' ? 'text-ta-yellow' : 'text-red-400'}`}>
          {shown.text}
        </p>
      )}
      <p className="mt-3 text-xs text-ta-muted">Dados fornecidos pelo Strava.</p>
    </Card>
  );
}
