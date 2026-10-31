import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** `baseline` e `profile` são linhas únicas por usuário: o id da operação é fixo. */
export type OpTable = 'workouts' | 'body' | 'baseline' | 'profile';

export interface Op {
  table: OpTable;
  id: string;
  kind: 'upsert' | 'delete';
  /** Ordem de criação; só removemos da fila a versão que foi de fato enviada. */
  seq: number;
}

export const opKey = (op: Pick<Op, 'table' | 'id'>) => `${op.table}:${op.id}`;

interface SyncState {
  /** Usuário dono dos dados locais (último que sincronizou neste aparelho). Persistido. */
  ownerId: string | null;
  /** Alterações locais ainda não enviadas ao Supabase. Persistido. */
  outbox: Record<string, Op>;
  seq: number;
  lastSyncAt: string | null;

  /** Sessão atual (não persistido — o Supabase guarda a sessão por conta própria). */
  email: string | null;
  phase: 'off' | 'idle' | 'syncing' | 'offline' | 'error';
  error: string | null;
}

export const useSync = create<SyncState>()(
  persist(
    (): SyncState => ({
      ownerId: null,
      outbox: {},
      seq: 0,
      lastSyncAt: null,
      email: null,
      phase: 'off',
      error: null,
    }),
    {
      name: 'ta-sync',
      version: 1,
      partialize: (s) => ({ ownerId: s.ownerId, outbox: s.outbox, seq: s.seq, lastSyncAt: s.lastSyncAt }),
    },
  ),
);
