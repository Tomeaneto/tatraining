import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch em segundos */
  expiresAt: number;
}

interface StravaState {
  tokens: StravaTokens | null;
  athleteName: string | null;
  lastSyncAt: string | null;
  setConnection: (tokens: StravaTokens, athleteName?: string | null) => void;
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
      setConnection: (tokens, athleteName = null) => set({ tokens, athleteName }),
      setTokens: (tokens) => set({ tokens }),
      setLastSync: (iso) => set({ lastSyncAt: iso }),
      disconnect: () => set({ tokens: null, athleteName: null, lastSyncAt: null }),
    }),
    { name: 'ta-strava', version: 1 },
  ),
);
