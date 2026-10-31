import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StravaTokens {
  accessToken: string;
  /** Vazio quando o refresh token fica só no servidor (`serverManaged`). */
  refreshToken: string;
  /** epoch em segundos */
  expiresAt: number;
}

interface StravaState {
  tokens: StravaTokens | null;
  athleteName: string | null;
  lastSyncAt: string | null;
  /** Com login no Supabase os tokens ficam em `strava_connections`; aqui só o access token de curta duração. */
  serverManaged: boolean;
  setConnection: (tokens: StravaTokens, athleteName?: string | null, serverManaged?: boolean) => void;
  setTokens: (tokens: StravaTokens) => void;
  setLastSync: (iso: string) => void;
  disconnect: () => void;
}

export const useStrava = create<StravaState>()(
  persist(
    (set) => ({
      tokens: null,
      athleteName: null,
      lastSyncAt: null,
      serverManaged: false,
      setConnection: (tokens, athleteName = null, serverManaged = false) => set({ tokens, athleteName, serverManaged }),
      setTokens: (tokens) => set({ tokens }),
      setLastSync: (iso) => set({ lastSyncAt: iso }),
      disconnect: () => set({ tokens: null, athleteName: null, lastSyncAt: null, serverManaged: false }),
    }),
    { name: 'ta-strava', version: 1 },
  ),
);
