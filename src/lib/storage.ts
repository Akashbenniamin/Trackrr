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

function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage:`, err);
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to localStorage:`, err);
  }
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
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_WS) || storage.getSettings().active_workspace_id || null;
    } catch {
      return storage.getSettings().active_workspace_id || null;
    }
  },
  setActiveWorkspaceId: (id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_WS, id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_WS);
      }
    } catch {}
    const s = storage.getSettings();
    if (s.active_workspace_id !== id) {
      storage.setSettings({ ...s, active_workspace_id: id });
    }
  },

  getWorkspaceTypeMap: (): Record<string, WorkspaceType> => {
    return getItem<Record<string, WorkspaceType>>(STORAGE_KEYS.WS_TYPES, {});
  },
  setWorkspaceType: (wsId: string, type: WorkspaceType) => {
    const map = storage.getWorkspaceTypeMap();
    map[wsId] = type;
    setItem(STORAGE_KEYS.WS_TYPES, map);
  },
  getWorkspaceType: (wsId: string): WorkspaceType | undefined => {
    const map = storage.getWorkspaceTypeMap();
    return map[wsId];
  },

  initStorage: () => {
    const existingWs = storage.getWorkspaces();
    if (existingWs.length === 0) {
      const defaultWsId = generateId();
      const now = new Date().toISOString();
      const defaultWs: Workspace = {
        id: defaultWsId,
        name: 'My Workspace',
        color: '#818CF8',
        type: 'freelance',
        created_at: now,
        updated_at: now,
      };

      const client1Id = generateId();
      const client2Id = generateId();

      const initialClients: Client[] = [
        {
          id: client1Id,
          workspace_id: defaultWsId,
          name: 'TechPulse Studio',
          company: 'TechPulse Media',
          email: 'contact@techpulse.io',
          phone: '+1 555-0199',
          color: '#818CF8',
          payment_type: 'monthly',
          monthly_salary: 1500,
          notes: 'Regular tech reviews & YouTube shorts',
          created_at: now,
          updated_at: now,
        },
        {
          id: client2Id,
          workspace_id: defaultWsId,
          name: 'Apex Gaming',
          company: 'Apex Media',
          email: 'editor@apexgaming.gg',
          phone: '+1 555-0144',
          color: '#34D399',
          payment_type: 'per_video',
          monthly_salary: 0,
          notes: 'High energy esports highlight edits',
          created_at: now,
          updated_at: now,
        },
      ];

      const currentYear = new Date().getFullYear();
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

      const initialRates: SalaryRate[] = [
        {
          id: generateId(),
          client_id: client1Id,
          workspace_id: defaultWsId,
          amount: 1500,
          effective_from: `${currentYear}-01-01`,
          created_at: now,
        },
      ];

      const initialTasks: Task[] = [
        {
          id: generateId(),
          workspace_id: defaultWsId,
          client_id: client1Id,
          title: 'YouTube Tech Review #45',
          description: 'Long-form 4K review with motion graphics and color grading',
          status: 'Completed',
          videos: 1,
          price: 0,
          pricing_type: 'total',
          received_date: `${currentYear}-${currentMonth}-02T10:00:00.000Z`,
          completed_date: `${currentYear}-${currentMonth}-04T15:30:00.000Z`,
          deadline: `${currentYear}-${currentMonth}-05T18:00:00.000Z`,
          tags: ['YouTube', 'Longform'],
          order_index: 0,
          created_at: now,
          updated_at: now,
        },
        {
          id: generateId(),
          workspace_id: defaultWsId,
          client_id: client2Id,
          title: 'Esports Tournament Highlights',
          description: 'Fast paced cut with beat sync SFX and subtitles',
          status: 'Completed',
          videos: 2,
          price: 150,
          pricing_type: 'per_video',
          received_date: `${currentYear}-${currentMonth}-05T09:00:00.000Z`,
          completed_date: `${currentYear}-${currentMonth}-07T12:00:00.000Z`,
          deadline: `${currentYear}-${currentMonth}-08T18:00:00.000Z`,
          tags: ['Gaming', 'Highlights'],
          order_index: 1,
          created_at: now,
          updated_at: now,
        },
        {
          id: generateId(),
          workspace_id: defaultWsId,
          client_id: client1Id,
          title: 'Batch Shorts (Tech Tips 1-3)',
          description: 'Vertical 9:16 reels with viral captions and sound design',
          status: 'Completed',
          videos: 3,
          price: 0,
          pricing_type: 'total',
          received_date: `${currentYear}-${currentMonth}-08T11:00:00.000Z`,
          completed_date: `${currentYear}-${currentMonth}-09T16:00:00.000Z`,
          deadline: `${currentYear}-${currentMonth}-15T18:00:00.000Z`,
          tags: ['Shorts', 'Reels'],
          order_index: 2,
          created_at: now,
          updated_at: now,
        },
      ];

      const initialPayments: Payment[] = [
        {
          id: generateId(),
          client_id: client2Id,
          workspace_id: defaultWsId,
          amount: 300,
          method: 'Bank Transfer',
          note: 'Payment for tournament highlights',
          date: `${currentYear}-${currentMonth}-08T14:00:00.000Z`,
          payment_for_months: [`${currentYear}-${currentMonth}`],
          created_at: now,
        },
      ];

      const initialSettings: AppSettings = {
        id: 1,
        active_workspace_id: defaultWsId,
        currency: 'INR',
        theme_color: '#818CF8',
        theme_style: 'default',
        show_completed: true,
      };

      storage.setWorkspaces([defaultWs]);
      storage.setClients(initialClients);
      storage.setSalaryRates(initialRates);
      storage.setTasks(initialTasks);
      storage.setPayments(initialPayments);
      storage.setDiscounts([]);
      storage.setSettings(initialSettings);
    }
  },
};
