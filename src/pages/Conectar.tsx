import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountCard } from '../components/connect/AccountCard';
import { GarminImportCard } from '../components/connect/GarminImportCard';
import { SettingsCard } from '../components/connect/SettingsCard';
import { StravaCard } from '../components/connect/StravaCard';
import { TelegramCard } from '../components/connect/TelegramCard';
import { PageHeader } from '../components/PageHeader';
import { checkState, completeStravaAuth } from '../lib/strava';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function Conectar() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<Status>(null);
  const handled = useRef(false);

  // Retorno do OAuth do Strava: /conectar?code=…&state=…&scope=… (ou ?error=access_denied)
  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');
    if (handled.current || (!code && !error)) return;
    handled.current = true;
    setParams({}, { replace: true });

    if (error) {
      setStatus({ kind: 'error', text: 'Autorização do Strava cancelada.' });
      return;
    }
    if (!checkState(params.get('state'))) {
      setStatus({ kind: 'error', text: 'Resposta do Strava inválida (state). Tente conectar novamente.' });
      return;
    }
    if (!params.get('scope')?.includes('activity:read')) {
      setStatus({ kind: 'error', text: 'Permita o acesso às atividades para sincronizar os treinos.' });
      return;
    }
    setStatus({ kind: 'ok', text: 'Conectando…' });
    completeStravaAuth(code!)
      .then(() => setStatus({ kind: 'ok', text: 'Strava conectado! Toque em Sincronizar para importar.' }))
      .catch((e: unknown) => setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'Falha ao conectar.' }));
  }, [params, setParams]);

  return (
    <>
      <PageHeader title="Conectar" subtitle="Conta, Strava, Garmin e configurações" />
      <div className="space-y-3">
        <AccountCard />
        <StravaCard status={status} />
        <TelegramCard />
        <GarminImportCard />
        <SettingsCard />
      </div>
    </>
  );
}
