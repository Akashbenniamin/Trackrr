import type { Workspace, Client, Task, Payment, SalaryRate, Discount, AppSettings, BatchflowClient, BatchflowBatch, BatchflowVideo, WorkspaceType } from '../types';

export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_KEYS = {
  WORKSPACES: 'ft_workspaces',
  CLIENTS: 'ft_clients',
  TASKS: 'ft_tasks',
  PAYMENTS: 'ft_payments',
  SALARY_RATES: 'ft_salary_rates',
  DISCOUNTS: 'ft_discounts',
  SETTINGS: 'ft_settings',
  BF_CLIENTS: 'ft_bf_clients',
  BF_BATCHES: 'ft_bf_batches',
  BF_VIDEOS: 'ft_bf_videos',
  ACTIVE_WS: 'ft_active_workspace_id',
  WS_TYPES: 'ft_workspace_types',
};

export const defaultSettings: AppSettings = {
  id: 1,
  active_workspace_id: null,
  currency: 'INR',
  theme_color: 'auto',
  theme_style: 'default',
  show_completed: true,
};

export interface LegacyLocalSnapshot {
  workspaces: Workspace[];
  workspaceTypes: Record<string, WorkspaceType>;
  bfClients: BatchflowClient[];
  bfBatches: BatchflowBatch[];
  bfVideos: BatchflowVideo[];
  activeWorkspaceId: string | null;
}

// Ephemeral in-memory stores (RAM only - ZERO browser localStorage persistence for app data)
const inMemoryDataStore = new Map<string, any>();
const inMemoryKvStore = new Map<string, string>();
let legacySnapshot: LegacyLocalSnapshot | null = null;

function isSupabaseAuthKey(key: string): boolean {
  return key.startsWith('sb-') && key.endsWith('-auth-token');
}

// On startup: capture one-time snapshot of any unsynced BatchFlow items, then completely wipe
// all app data/thumbnails from browser localStorage and block any future non-auth localStorage writes.
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const rawLs = window.localStorage;
    const nativeGetItem = Storage.prototype.getItem.bind(rawLs);
    const nativeSetItem = Storage.prototype.setItem.bind(rawLs);
    const nativeRemoveItem = Storage.prototype.removeItem.bind(rawLs);
    const nativeKey = Storage.prototype.key.bind(rawLs);

    const parseRaw = <T>(key: string, fallback: T): T => {
      try {
        const raw = nativeGetItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        return fallback;
      }
    };

    const legacyWs = parseRaw<Workspace[]>(STORAGE_KEYS.WORKSPACES, []);
    const legacyTypes = parseRaw<Record<string, WorkspaceType>>(STORAGE_KEYS.WS_TYPES, {});
    const legacyBfC = parseRaw<BatchflowClient[]>(STORAGE_KEYS.BF_CLIENTS, []);
    const legacyBfB = parseRaw<BatchflowBatch[]>(STORAGE_KEYS.BF_BATCHES, []);
    const legacyBfV = parseRaw<BatchflowVideo[]>(STORAGE_KEYS.BF_VIDEOS, []);
    const legacyActiveWs = nativeGetItem(STORAGE_KEYS.ACTIVE_WS) || null;

    if (
      legacyWs.length > 0 ||
      Object.keys(legacyTypes).length > 0 ||
      legacyBfC.length > 0 ||
      legacyBfB.length > 0 ||
      legacyBfV.length > 0
    ) {
      legacySnapshot = {
        workspaces: legacyWs,
        workspaceTypes: legacyTypes,
        bfClients: legacyBfC,
        bfBatches: legacyBfB,
        bfVideos: legacyBfV,
        activeWorkspaceId: legacyActiveWs,
      };
    }

    // Wipe EVERY key in browser localStorage except the Supabase auth session token
    const keysToWipe: string[] = [];
    for (let i = 0; i < rawLs.length; i++) {
      const k = nativeKey(i);
      if (k && !isSupabaseAuthKey(k)) {
        keysToWipe.push(k);
      }
    }
    for (const k of keysToWipe) {
      try {
        nativeRemoveItem(k);
      } catch {}
    }

    // Intercept localStorage methods so ONLY Supabase auth token ever touches browser localStorage;
    // all other keys (e.g. runtime session caches) stay strictly in RAM.
    rawLs.getItem = (key: string): string | null => {
      if (isSupabaseAuthKey(key)) {
        return nativeGetItem(key);
      }
      return inMemoryKvStore.get(key) ?? null;
    };

    rawLs.setItem = (key: string, value: string): void => {
      if (isSupabaseAuthKey(key)) {
        nativeSetItem(key, String(value));
        return;
      }
      inMemoryKvStore.set(key, String(value));
    };

    rawLs.removeItem = (key: string): void => {
      if (isSupabaseAuthKey(key)) {
        nativeRemoveItem(key);
        return;
      }
      inMemoryKvStore.delete(key);
    };
  } catch (err) {
    console.warn('Could not initialize cloud-only localStorage cleanup:', err);
  }
}

export function consumeLegacyLocalSnapshot(): LegacyLocalSnapshot | null {
  const snap = legacySnapshot;
  legacySnapshot = null;
  return snap;
}

export function getMemoryStorageKeys(): string[] {
  return Array.from(inMemoryKvStore.keys());
}

export function evictThumbnailCacheIfNeeded(_forceAll = false): void {
  // No-op in cloud-only mode (no thumbnails are ever stored in localStorage)
}

function getItem<T>(key: string, fallback: T): T {
  if (!inMemoryDataStore.has(key)) return fallback;
  return inMemoryDataStore.get(key) as T;
}

function setItem<T>(key: string, value: T): void {
  inMemoryDataStore.set(key, value);
}

export const storage = {
  getWorkspaces: (): Workspace[] => getItem(STORAGE_KEYS.WORKSPACES, []),
  setWorkspaces: (data: Workspace[]) => setItem(STORAGE_KEYS.WORKSPACES, data),

  getClients: (): Client[] => getItem(STORAGE_KEYS.CLIENTS, []),
  setClients: (data: Client[]) => setItem(STORAGE_KEYS.CLIENTS, data),

  getTasks: (): Task[] => getItem(STORAGE_KEYS.TASKS, []),
  setTasks: (data: Task[]) => setItem(STORAGE_KEYS.TASKS, data),

  getPayments: (): Payment[] => getItem(STORAGE_KEYS.PAYMENTS, []),
  setPayments: (data: Payment[]) => setItem(STORAGE_KEYS.PAYMENTS, data),

  getSalaryRates: (): SalaryRate[] => getItem(STORAGE_KEYS.SALARY_RATES, []),
  setSalaryRates: (data: SalaryRate[]) => setItem(STORAGE_KEYS.SALARY_RATES, data),

  getDiscounts: (): Discount[] => getItem(STORAGE_KEYS.DISCOUNTS, []),
  setDiscounts: (data: Discount[]) => setItem(STORAGE_KEYS.DISCOUNTS, data),

  getBatchflowClients: (): BatchflowClient[] => getItem(STORAGE_KEYS.BF_CLIENTS, []),
  setBatchflowClients: (data: BatchflowClient[]) => setItem(STORAGE_KEYS.BF_CLIENTS, data),

  getBatchflowBatches: (): BatchflowBatch[] => getItem(STORAGE_KEYS.BF_BATCHES, []),
  setBatchflowBatches: (data: BatchflowBatch[]) => setItem(STORAGE_KEYS.BF_BATCHES, data),

  getBatchflowVideos: (): BatchflowVideo[] => getItem(STORAGE_KEYS.BF_VIDEOS, []),
  setBatchflowVideos: (data: BatchflowVideo[]) => setItem(STORAGE_KEYS.BF_VIDEOS, data),

  getSettings: (): AppSettings => getItem(STORAGE_KEYS.SETTINGS, defaultSettings),
  setSettings: (data: AppSettings) => setItem(STORAGE_KEYS.SETTINGS, data),

  getActiveWorkspaceId: (): string | null => {
    return (inMemoryDataStore.get(STORAGE_KEYS.ACTIVE_WS) as string | null) || storage.getSettings().active_workspace_id || null;
  },
  setActiveWorkspaceId: (id: string | null) => {
    if (id) {
      inMemoryDataStore.set(STORAGE_KEYS.ACTIVE_WS, id);
    } else {
      inMemoryDataStore.delete(STORAGE_KEYS.ACTIVE_WS);
    }
    const s = storage.getSettings();
    if (s.active_workspace_id !== id) {
      storage.setSettings({ ...s, active_workspace_id: id });
    }
  },

  getWorkspaceTypeMap: (): Record<string, WorkspaceType> => {
    return getItem<Record<string, WorkspaceType>>(STORAGE_KEYS.WS_TYPES, {});
  },
  setWorkspaceType: (wsId: string, type: WorkspaceType) => {
    const map = { ...storage.getWorkspaceTypeMap(), [wsId]: type };
    setItem(STORAGE_KEYS.WS_TYPES, map);
  },
  getWorkspaceType: (wsId: string): WorkspaceType | undefined => {
    const map = storage.getWorkspaceTypeMap();
    return map[wsId];
  },

  clearAllUserData: () => {
    inMemoryDataStore.clear();
    inMemoryKvStore.clear();
  },

  initStorage: (_isUserLoggedIn = false) => {
    // Cloud-only mode: never seed fake local demo data
  },
};
