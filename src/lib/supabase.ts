import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Cliente do Supabase, ou `null` quando as variáveis não estão configuradas —
 * nesse caso o app funciona só com o localStorage, como antes.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Fluxo implícito: o link mágico funciona mesmo aberto em outro navegador/aparelho
          // e não usa ?code= (que a tela Conectar reserva ao retorno do Strava).
          flowType: 'implicit',
        },
      })
    : null;

/** Access token da sessão atual (para as Vercel Functions), ou null sem login. */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
