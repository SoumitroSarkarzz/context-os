import { create } from 'zustand';
import { api } from '../services/api';
import type { AppData, Page } from '../types';
export const emptyData: AppData = {
  contexts: [],
  sessions: [],
  events: [],
  notes: [],
  checkpoints: [],
  settings: { theme: 'system', compact: false, reopen_last: true },
  event_count: 0,
  database_bytes: 0,
};
interface Store {
  data: AppData;
  loaded: boolean;
  pending: boolean;
  error: string | null;
  loadError: string | null;
  trackingError: string | null;
  toast: string | null;
  page: Page;
  selectedId: string | null;
  sidebarCollapsed: boolean;
  createOpen: boolean;
  paletteOpen: boolean;
  captureOpen: boolean;
  refresh: () => Promise<void>;
  navigate: (page: Page, id?: string) => void;
  action: <T>(work: () => Promise<T>, message?: string) => Promise<T | undefined>;
  notify: (message: string) => void;
}
export const useApp = create<Store>((set, get) => ({
  data: emptyData,
  loaded: false,
  pending: false,
  error: null,
  loadError: null,
  trackingError: null,
  toast: null,
  page: 'home',
  selectedId: null,
  sidebarCollapsed: false,
  createOpen: false,
  paletteOpen: false,
  captureOpen: false,
  refresh: async () => {
    try {
      const data = await api.state();
      const trackingError = await api.trackingError();
      set({ data, trackingError, loaded: true, loadError: null });
    } catch (error) {
      set({ loadError: error instanceof Error ? error.message : String(error), loaded: true });
    }
  },
  navigate: (page, id) => set({ page, selectedId: id ?? get().selectedId, paletteOpen: false }),
  action: async (work, message) => {
    if (get().pending) return undefined;
    set({ pending: true, error: null });
    try {
      const value = await work();
      await get().refresh();
      if (message) get().notify(message);
      return value;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) });
      return undefined;
    } finally {
      set({ pending: false });
    }
  },
  notify: (toast) => set({ toast }),
}));
