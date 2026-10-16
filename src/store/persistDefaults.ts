import type { StoreApi } from 'zustand';

type PersistedStore = Pick<StoreApi<unknown>, 'setState'> & {
  persist: { getOptions: () => { name?: string }; hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => void };
};

/** Força a gravação do estado inicial quando ainda não há nada salvo no localStorage. */
export function persistDefaults(store: PersistedStore): void {
  const write = () => {
    const key = store.persist.getOptions().name;
    try {
      if (key && localStorage.getItem(key) === null) store.setState((s: unknown) => s);
    } catch {
      // localStorage indisponível (modo privado etc.) — segue só em memória.
    }
  };
  if (store.persist.hasHydrated()) write();
  else store.persist.onFinishHydration(write);
}
