import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { storage, generateId, consumeLegacyLocalSnapshot } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useNetworkStatus } from '../lib/useNetworkStatus';
import { usePersistedState } from '../lib/usePersistedState';
import type {
  Workspace, Client, Task, Payment, AppSettings, ViewName, SalaryRate, Discount,
  WorkspaceRole, WorkspaceMember, WorkspaceInvite, WorkspaceType,
  BatchflowClient, BatchflowBatch, BatchflowVideo, BatchflowVideoStatus,
} from '../types';

interface AppContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  clients: Client[];
  tasks: Task[];
  payments: Payment[];
  salaryRates: SalaryRate[];
  discounts: Discount[];
  batchflowClients: BatchflowClient[];
  batchflowBatches: BatchflowBatch[];
  batchflowVideos: BatchflowVideo[];
  settings: AppSettings;
  loading: boolean;
  currentView: ViewName;
  isOnline: boolean;
  currentRole: WorkspaceRole;
  canEdit: boolean;
  workspaceMembers: WorkspaceMember[];
  pendingInvites: WorkspaceInvite[];
  workspaceInvites: WorkspaceInvite[];
  setCurrentView: (v: ViewName) => void;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name: string, color: string, type?: WorkspaceType) => Promise<void>;
  updateWorkspace: (id: string, data: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  addTask: (data: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addClient: (data: Partial<Client>) => Promise<Client | null>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addPayment: (data: Partial<Payment>) => Promise<void>;
  updatePayment: (id: string, data: Partial<Payment>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  addSalaryRate: (data: Partial<SalaryRate>) => Promise<void>;
  updateSalaryRate: (id: string, data: Partial<SalaryRate>) => Promise<void>;
  deleteSalaryRate: (id: string) => Promise<void>;
  setClientMonthlyRate: (clientId: string, monthStr: string, amount: number) => Promise<void>;
  addDiscount: (data: Partial<Discount>) => Promise<void>;
  updateDiscount: (id: string, data: Partial<Discount>) => Promise<void>;
  deleteDiscount: (id: string) => Promise<void>;
  addBatchflowClient: (data: Partial<BatchflowClient>) => Promise<BatchflowClient | null>;
  updateBatchflowClient: (id: string, data: Partial<BatchflowClient>) => Promise<void>;
  deleteBatchflowClient: (id: string) => Promise<void>;
  addBatchflowBatch: (data: { client_id: string; name: string; shoot_date: string; script?: string; videoCount?: number; namingMethod?: string }) => Promise<BatchflowBatch | null>;
  updateBatchflowBatch: (id: string, data: Partial<BatchflowBatch>) => Promise<void>;
  deleteBatchflowBatch: (id: string) => Promise<void>;
  addBatchflowVideo: (data: Partial<BatchflowVideo>) => Promise<BatchflowVideo | null>;
  updateBatchflowVideo: (id: string, data: Partial<BatchflowVideo>) => Promise<void>;
  updateBatchflowVideoStatus: (id: string, status: BatchflowVideoStatus, videoUrl?: string | null, postedDate?: string | null, views?: string | number | null, likes?: string | number | null) => Promise<void>;
  deleteBatchflowVideo: (id: string) => Promise<void>;
  importBackupData: (data: any) => Promise<{ success: boolean; message: string }>;
  updateSettings: (data: Partial<AppSettings>) => Promise<void>;
  inviteCollaborator: (workspaceId: string, email: string, role: 'manager' | 'viewer') => Promise<{ error?: any }>;
  cancelInvite: (inviteId: string) => Promise<{ error?: any }>;
  removeCollaborator: (workspaceId: string, userId: string) => Promise<{ error?: any }>;
  respondToInvite: (inviteId: string, accept: boolean) => Promise<{ error?: any }>;
  refetch: () => Promise<void>;
}

function isSchemaColumnError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  const details = String(error.details || '').toLowerCase();
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes('column') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the') ||
    details.includes('column')
  );
}

function packSettingsForSupabase(s: AppSettings, userId: string) {
  const baseColor = (s.theme_color || 'auto').split('||META:')[0];
  const extra = {
    theme_style: s.theme_style || 'default',
    meta_app_id: s.meta_app_id || undefined,
    meta_client_token: s.meta_client_token || undefined,
    meta_user_token: s.meta_user_token || undefined,
    meta_ig_user_id: s.meta_ig_user_id || undefined,
  };
  return {
    user_id: userId,
    currency: s.currency === 'USD' ? 'USD' : 'INR',
    theme_color: `${baseColor}||META:${JSON.stringify(extra)}`,
    show_completed: s.show_completed ?? true,
    active_workspace_id: s.active_workspace_id || null,
    updated_at: new Date().toISOString(),
  };
}

function unpackSettingsFromSupabase(row: any, current: AppSettings): AppSettings {
  const rawColor = typeof row?.theme_color === 'string' ? row.theme_color : (current.theme_color || 'auto');
  const metaIdx = rawColor.indexOf('||META:');
  let cleanColor = rawColor;
  let extra: Record<string, any> = {};
  if (metaIdx !== -1) {
    cleanColor = rawColor.slice(0, metaIdx) || 'auto';
    try {
      extra = JSON.parse(rawColor.slice(metaIdx + 7)) || {};
    } catch {}
  }
  return {
    ...current,
    currency: row?.currency || current.currency,
    theme_color: cleanColor || current.theme_color,
    theme_style: row?.theme_style || extra.theme_style || current.theme_style,
    show_completed: row?.show_completed !== undefined ? row.show_completed : current.show_completed,
    active_workspace_id: row?.active_workspace_id || current.active_workspace_id,
    meta_app_id: row?.meta_app_id || extra.meta_app_id || current.meta_app_id,
    meta_client_token: row?.meta_client_token || extra.meta_client_token || current.meta_client_token,
    meta_user_token: row?.meta_user_token || extra.meta_user_token || current.meta_user_token,
    meta_ig_user_id: row?.meta_ig_user_id || extra.meta_ig_user_id || current.meta_ig_user_id,
  };
}

function packWaitingDateWithMeta(v: Partial<BatchflowVideo>): string {
  const rawWaiting =
    typeof v.waiting_date === 'string' && v.waiting_date
      ? v.waiting_date
      : v.created_at || new Date().toISOString();
  const cleanWaitingDate = rawWaiting.split('||META:')[0];
  const meta = {
    video_url: v.video_url ?? null,
    views: v.views ?? null,
    likes: v.likes ?? null,
    description: v.description ?? null,
    updated_at: v.updated_at ?? new Date().toISOString(),
  };
  return `${cleanWaitingDate}||META:${JSON.stringify(meta)}`;
}

function unpackVideoFromSupabase(row: any): BatchflowVideo {
  const rawWaiting = typeof row.waiting_date === 'string' ? row.waiting_date : '';
  const metaIdx = rawWaiting.indexOf('||META:');
  let cleanWaitingDate: string | null = rawWaiting || null;
  let meta: Record<string, any> = {};
  if (metaIdx !== -1) {
    cleanWaitingDate = rawWaiting.slice(0, metaIdx) || null;
    try {
      meta = JSON.parse(rawWaiting.slice(metaIdx + 7)) || {};
    } catch {}
  }
  return {
    ...row,
    waiting_date: cleanWaitingDate,
    video_url: row.video_url ?? meta.video_url ?? null,
    views: row.views ?? meta.views ?? null,
    likes: row.likes ?? meta.likes ?? null,
    description: row.description ?? meta.description ?? null,
    updated_at: row.updated_at ?? meta.updated_at ?? undefined,
  };
}

function packVideoForSupabase(v: BatchflowVideo, fallbackUserId?: string) {
  return {
    id: v.id,
    workspace_id: v.workspace_id,
    user_id: fallbackUserId || v.user_id,
    batch_id: v.batch_id,
    name: v.name,
    script_number: v.script_number ?? 1,
    status: v.status || 'Pending',
    waiting_date: packWaitingDateWithMeta(v),
    edited_date: v.edited_date ?? null,
    posted_date: v.posted_date ?? null,
    created_at: v.created_at || new Date().toISOString(),
  };
}

function packBatchForSupabase(b: BatchflowBatch, fallbackUserId?: string) {
  return {
    id: b.id,
    workspace_id: b.workspace_id,
    user_id: fallbackUserId || b.user_id,
    client_id: b.client_id,
    name: b.name,
    shoot_date: b.shoot_date || '',
    script: b.script || '',
    archived: b.archived ?? 0,
    created_at: b.created_at || new Date().toISOString(),
  };
}

function packClientForSupabase(c: BatchflowClient, fallbackUserId?: string) {
  return {
    id: c.id,
    workspace_id: c.workspace_id,
    user_id: fallbackUserId || c.user_id,
    name: c.name,
    color: c.color || '#818CF8',
    instagram_id: c.instagram_id || '',
    archived: c.archived ?? 0,
    created_at: c.created_at || new Date().toISOString(),
  };
}

async function upsertWorkspaceToCloud(ws: Workspace, fallbackUserId?: string) {
  const now = new Date().toISOString();
  const payload: any = {
    id: ws.id,
    user_id: fallbackUserId || ws.user_id,
    name: ws.name || 'Workspace',
    color: ws.color || '#818CF8',
    type: ws.type || 'freelance',
    created_at: ws.created_at || now,
    updated_at: ws.updated_at || now,
  };
  const { error } = await supabase.from('workspaces').upsert(payload, { onConflict: 'id' });
  if (error && (error.message?.includes('type') || isSchemaColumnError(error))) {
    const { type: _t, ...noType } = payload;
    await supabase.from('workspaces').upsert(noType, { onConflict: 'id' });
  }
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isOnline = useNetworkStatus();
  const isCloudActive = isSupabaseConfigured() && Boolean(user);

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => storage.getWorkspaces());
  const [settings, setSettings] = useState<AppSettings>(() => storage.getSettings());
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(() => {
    const ws = storage.getWorkspaces();
    const activeId = storage.getActiveWorkspaceId();
    return ws.find(w => w.id === activeId) ?? ws[0] ?? null;
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salaryRates, setSalaryRates] = useState<SalaryRate[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [batchflowClients, setBatchflowClients] = useState<BatchflowClient[]>([]);
  const [batchflowBatches, setBatchflowBatches] = useState<BatchflowBatch[]>([]);
  const [batchflowVideos, setBatchflowVideos] = useState<BatchflowVideo[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = usePersistedState<ViewName>('trackrr_current_view', 'dashboard');

  // Compute active role
  const currentRole: WorkspaceRole = (() => {
    if (!user || !activeWorkspace) return 'owner';
    if (activeWorkspace.user_id === user.id) return 'owner';
    const member = workspaceMembers.find(m => m.workspace_id === activeWorkspace.id && m.user_id === user.id);
    return member?.role ?? 'viewer';
  })();

  const canEdit = isOnline && (currentRole === 'owner' || currentRole === 'manager');

  // Fetch all data strictly from Supabase Cloud (zero localStorage data caching)
  const fetchAll = useCallback(async (wsId?: string) => {
    if (!isCloudActive || !isOnline || !user) {
      return;
    }

    try {
      // One-time safety migration of any legacy BatchFlow items captured right before localStorage was cleaned
      const legacy = consumeLegacyLocalSnapshot();
      if (legacy) {
        try {
          const [cWsRes, cBfCRes, cBfBRes, cBfVRes] = await Promise.all([
            supabase.from('workspaces').select('id,type'),
            supabase.from('batchflow_clients').select('id'),
            supabase.from('batchflow_batches').select('id'),
            supabase.from('batchflow_videos').select('id'),
          ]);
          const existingWsMap = new Map((cWsRes.data || []).map((w: any) => [w.id, w.type]));
          const existingBfCIds = new Set((cBfCRes.data || []).map((c: any) => c.id));
          const existingBfBIds = new Set((cBfBRes.data || []).map((b: any) => b.id));
          const existingBfVIds = new Set((cBfVRes.data || []).map((v: any) => v.id));

          for (const lw of legacy.workspaces) {
            const isBf =
              legacy.workspaceTypes[lw.id] === 'batchflow' ||
              lw.type === 'batchflow' ||
              legacy.bfClients.some(c => c.workspace_id === lw.id) ||
              legacy.bfBatches.some(b => b.workspace_id === lw.id);
            const targetType: WorkspaceType = isBf ? 'batchflow' : (lw.type || 'freelance');
            if (!existingWsMap.has(lw.id)) {
              await upsertWorkspaceToCloud({ ...lw, type: targetType }, user.id);
            } else if (targetType === 'batchflow' && existingWsMap.get(lw.id) !== 'batchflow') {
              await supabase.from('workspaces').update({ type: 'batchflow' }).eq('id', lw.id);
            }
          }

          for (const lc of legacy.bfClients) {
            if (!existingBfCIds.has(lc.id)) {
              await supabase.from('batchflow_clients').upsert(packClientForSupabase(lc, user.id), { onConflict: 'id' });
            }
          }
          for (const lb of legacy.bfBatches) {
            if (!existingBfBIds.has(lb.id)) {
              await supabase.from('batchflow_batches').upsert(packBatchForSupabase(lb, user.id), { onConflict: 'id' });
            }
          }
          for (const lv of legacy.bfVideos) {
            if (!existingBfVIds.has(lv.id)) {
              await supabase.from('batchflow_videos').upsert(packVideoForSupabase(lv, user.id), { onConflict: 'id' });
            }
          }
        } catch (err) {
          console.warn('Legacy BatchFlow check warning:', err);
        }
      }

      // 1. Fetch workspaces from Supabase Cloud
      let { data: cloudWs, error: wsErr } = await supabase.from('workspaces').select('*');
      if (wsErr) {
        const msg = String(wsErr.message || '').toLowerCase();
        if (wsErr.code === 'PGRST301' || msg.includes('jwt') || msg.includes('expired') || msg.includes('unauthorized')) {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          if (!refreshErr && refreshed.session) {
            const retryWs = await supabase.from('workspaces').select('*');
            cloudWs = retryWs.data;
            wsErr = retryWs.error;
          } else {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            return;
          }
        }
      }
      if (wsErr) {
        console.error('Error loading cloud workspaces:', wsErr);
        return;
      }

      // 2. Fetch cloud settings & BatchFlow workspace indicators in parallel
      const [settingsRes, bfWsCRes, bfWsBRes] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('batchflow_clients').select('workspace_id'),
        supabase.from('batchflow_batches').select('workspace_id'),
      ]);

      const bfWorkspaceIds = new Set<string>([
        ...((bfWsCRes.data as any[]) || []).map(r => r.workspace_id),
        ...((bfWsBRes.data as any[]) || []).map(r => r.workspace_id),
      ]);

      let activeWsList = ((cloudWs as Workspace[]) || []).map(w => {
        const memType = storage.getWorkspaceType(w.id);
        const isNamedBatchflow = Boolean(
          w.name?.toLowerCase().includes('batchflow') ||
          w.name?.toLowerCase().includes('batch flow')
        );
        const resolvedType: WorkspaceType =
          memType ||
          (w.type === 'batchflow' ? 'batchflow' : undefined) ||
          (bfWorkspaceIds.has(w.id) ? 'batchflow' : undefined) ||
          (isNamedBatchflow ? 'batchflow' : undefined) ||
          w.type ||
          'freelance';

        storage.setWorkspaceType(w.id, resolvedType);
        if (resolvedType === 'batchflow' && w.type !== 'batchflow') {
          supabase.from('workspaces').update({ type: 'batchflow' }).eq('id', w.id).then(() => {});
        }
        return {
          ...w,
          type: resolvedType,
        };
      });

      setWorkspaces(activeWsList);
      storage.setWorkspaces(activeWsList);

      // 3. Apply cloud settings
      let resolvedSettings = storage.getSettings();
      if (settingsRes.data) {
        resolvedSettings = unpackSettingsFromSupabase(settingsRes.data, resolvedSettings);
        storage.setSettings(resolvedSettings);
        setSettings(resolvedSettings);
        if (resolvedSettings.meta_app_id && resolvedSettings.meta_client_token) {
          localStorage.setItem('trackrr_meta_access_token', `${resolvedSettings.meta_app_id.trim()}|${resolvedSettings.meta_client_token.trim()}`);
        }
        if (resolvedSettings.meta_user_token) {
          localStorage.setItem('trackrr_meta_user_token', resolvedSettings.meta_user_token.trim());
        }
        if (resolvedSettings.meta_ig_user_id) {
          localStorage.setItem('trackrr_meta_ig_user_id', resolvedSettings.meta_ig_user_id.trim());
        }
      }

      const targetId = wsId ?? storage.getActiveWorkspaceId() ?? resolvedSettings.active_workspace_id ?? activeWsList[0]?.id ?? null;
      const active = activeWsList.find(w => w.id === targetId) ?? activeWsList[0] ?? null;
      setActiveWorkspace(active);
      if (active) {
        storage.setActiveWorkspaceId(active.id);
      }

      if (active) {
        // Fetch workspace members & invites
        const [membersRes, wsInvitesRes] = await Promise.all([
          supabase.from('workspace_members').select('*').eq('workspace_id', active.id),
          supabase.from('workspace_invites').select('*').eq('workspace_id', active.id).eq('status', 'pending'),
        ]);
        setWorkspaceMembers((membersRes.data as WorkspaceMember[]) || []);
        setWorkspaceInvites((wsInvitesRes.data as WorkspaceInvite[]) || []);

        if (active.type === 'batchflow') {
          const [bfCRes, bfBRes, bfVRes] = await Promise.all([
            supabase.from('batchflow_clients').select('*').eq('workspace_id', active.id).order('name', { ascending: true }),
            supabase.from('batchflow_batches').select('*').eq('workspace_id', active.id).order('shoot_date', { ascending: false }),
            supabase.from('batchflow_videos').select('*').eq('workspace_id', active.id).order('script_number', { ascending: true }),
          ]);

          if (!bfCRes.error && !bfBRes.error && !bfVRes.error) {
            const bfC = (bfCRes.data as BatchflowClient[]) || [];
            const bfB = (bfBRes.data as BatchflowBatch[]) || [];
            const rawBfV = (bfVRes.data as any[]) || [];
            const bfV = rawBfV.map(unpackVideoFromSupabase);

            setBatchflowClients(bfC);
            setBatchflowBatches(bfB);
            setBatchflowVideos(bfV);

            storage.setBatchflowClients(bfC);
            storage.setBatchflowBatches(bfB);
            storage.setBatchflowVideos(bfV);
          } else {
            console.error('Error loading BatchFlow data from Supabase:', bfCRes.error || bfBRes.error || bfVRes.error);
          }
        } else {
          const [cRes, tRes, pRes, rRes, dRes] = await Promise.all([
            supabase.from('clients').select('*').eq('workspace_id', active.id),
            supabase.from('tasks').select('*').eq('workspace_id', active.id).order('order_index', { ascending: true }),
            supabase.from('payments').select('*').eq('workspace_id', active.id).order('date', { ascending: false }),
            supabase.from('salary_rates').select('*').eq('workspace_id', active.id).order('effective_from', { ascending: true }),
            supabase.from('discounts').select('*').eq('workspace_id', active.id).order('date', { ascending: false }),
          ]);

          if (!cRes.error && !tRes.error && !pRes.error && !rRes.error && !dRes.error) {
            const cl = (cRes.data as Client[]) || [];
            const tk = (tRes.data as Task[]) || [];
            const pm = (pRes.data as Payment[]) || [];
            const sr = (rRes.data as SalaryRate[]) || [];
            const ds = (dRes.data as Discount[]) || [];

            setClients(cl);
            setTasks(tk);
            setPayments(pm);
            setSalaryRates(sr);
            setDiscounts(ds);

            storage.setClients(cl);
            storage.setTasks(tk);
            storage.setPayments(pm);
            storage.setSalaryRates(sr);
            storage.setDiscounts(ds);
          } else {
            console.error('Error loading Freelance data from Supabase:', cRes.error || tRes.error || pRes.error || rRes.error || dRes.error);
          }
        }
      } else {
        setClients([]);
        setTasks([]);
        setPayments([]);
        setSalaryRates([]);
        setDiscounts([]);
        setBatchflowClients([]);
        setBatchflowBatches([]);
        setBatchflowVideos([]);
        setWorkspaceMembers([]);
        setWorkspaceInvites([]);
      }

      // Fetch pending invites for user's email
      if (user?.email) {
        const { data: invites } = await supabase
          .from('workspace_invites')
          .select('*')
          .ilike('invitee_email', user.email.trim())
          .eq('status', 'pending');
        setPendingInvites((invites as WorkspaceInvite[]) || []);
      }
    } catch (err) {
      console.error('Failed to sync with Supabase:', err);
    }
  }, [isCloudActive, isOnline, user]);

  const hasInitializedRef = useRef(false);

  // Initial load on mount or user/auth change (100% Cloud-Only)
  useEffect(() => {
    (async () => {
      if (!hasInitializedRef.current) {
        setLoading(true);
      }
      try {
        if (!user) {
          storage.clearAllUserData();
          setWorkspaces([]);
          setActiveWorkspace(null);
          setClients([]);
          setTasks([]);
          setPayments([]);
          setSalaryRates([]);
          setDiscounts([]);
          setBatchflowClients([]);
          setBatchflowBatches([]);
          setBatchflowVideos([]);
          setWorkspaceMembers([]);
          setPendingInvites([]);
          setWorkspaceInvites([]);
          return;
        }

        await fetchAll();
      } finally {
        hasInitializedRef.current = true;
        setLoading(false);
      }
    })();
  }, [user?.id, fetchAll]);

  // Workspace Switch
  const switchWorkspace = useCallback(async (id: string) => {
    storage.setActiveWorkspaceId(id);
    const currSettings = storage.getSettings();
    const updated = { ...currSettings, active_workspace_id: id };
    storage.setSettings(updated);
    setSettings(updated);

    if (isCloudActive && isOnline && user) {
      try {
        await supabase.from('settings').upsert({
          user_id: user.id,
          active_workspace_id: id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch {}
    }

    await fetchAll(id);
  }, [fetchAll, isCloudActive, isOnline, user]);

  // Check mutation allowed
  const assertCanEdit = () => {
    if (!isOnline) throw new Error('You are offline. Editing is disabled until connection is restored.');
    if (currentRole === 'viewer') throw new Error('You have read-only access to this workspace.');
  };

  // Create Workspace
  const createWorkspace = useCallback(async (name: string, color: string, type: WorkspaceType = 'freelance') => {
    const now = new Date().toISOString();
    const wsId = generateId();
    const newWs: Workspace = {
      id: wsId,
      user_id: user?.id,
      name,
      color,
      type,
      created_at: now,
      updated_at: now,
    };

    // Store type explicitly in dedicated map
    storage.setWorkspaceType(wsId, type);

    // 1. Immediately update local storage and state so workspace appears everywhere instantly
    const all = storage.getWorkspaces();
    const updated = [...all.filter(w => w.id !== wsId), newWs];
    storage.setWorkspaces(updated);
    setWorkspaces(updated);

    // 2. If cloud is connected, attempt sync (with graceful fallback if table lacks type column)
    if (isCloudActive) {
      try {
        let { data, error } = await supabase.from('workspaces').insert([newWs]).select().single();

        // If error is about unknown column 'type', retry without the type field for legacy cloud tables
        if (error && (error.message?.includes('type') || error.code === 'PGRST204' || error.code === '42703')) {
          const { type: _t, ...wsNoType } = newWs;
          const retry = await supabase.from('workspaces').insert([wsNoType]).select().single();
          data = retry.data;
          error = retry.error;
        }

        if (!error && data) {
          const syncedWs: Workspace = { ...newWs, ...data, type: newWs.type };
          storage.setWorkspaceType(syncedWs.id, (newWs.type || 'freelance') as WorkspaceType);
          const refreshed = storage.getWorkspaces().map(w => w.id === wsId ? syncedWs : w);
          storage.setWorkspaces(refreshed);
          setWorkspaces(refreshed);
        } else if (error) {
          console.warn('Workspace saved locally; cloud sync failed:', error);
        }
      } catch (err) {
        console.warn('Network error syncing workspace to cloud:', err);
      }
    }

    // 3. Switch to new workspace
    await switchWorkspace(wsId);
  }, [isCloudActive, user, switchWorkspace]);

  // Update Workspace
  const updateWorkspace = useCallback(async (id: string, data: Partial<Workspace>) => {
    assertCanEdit();
    const now = new Date().toISOString();
    if (data.type) {
      storage.setWorkspaceType(id, data.type as WorkspaceType);
    }
    if (isCloudActive) {
      try {
        let { error } = await supabase.from('workspaces').update({ ...data, updated_at: now }).eq('id', id);
        if (error && (error.message?.includes('type') || error.code === 'PGRST204' || error.code === '42703')) {
          const { type: _t, ...dataNoType } = data;
          await supabase.from('workspaces').update({ ...dataNoType, updated_at: now }).eq('id', id);
        }
      } catch (err) {
        console.warn('Could not update workspace on cloud:', err);
      }
    }

    const all = storage.getWorkspaces();
    const updated = all.map(w => w.id === id ? { ...w, ...data, updated_at: now } : w);
    storage.setWorkspaces(updated);
    setWorkspaces(updated);
    if (activeWorkspace?.id === id) {
      setActiveWorkspace(prev => (prev ? { ...prev, ...data, updated_at: now } : null));
    }
  }, [assertCanEdit, isCloudActive, activeWorkspace]);

  // Delete Workspace
  const deleteWorkspace = useCallback(async (id: string) => {
    if (currentRole !== 'owner') {
      alert('Only the workspace owner can delete this workspace.');
      return;
    }
    if (!isOnline) {
      alert('Cannot delete workspace while offline.');
      return;
    }

    if (isCloudActive) {
      await supabase.from('workspaces').delete().eq('id', id);
    }

    const all = storage.getWorkspaces();
    const updated = all.filter(w => w.id !== id);
    storage.setWorkspaces(updated);
    setWorkspaces(updated);

    const remaining = updated[0]?.id;
    if (remaining) {
      await switchWorkspace(remaining);
    } else {
      setActiveWorkspace(null);
    }
  }, [currentRole, isOnline, isCloudActive, switchWorkspace]);

  // Task Mutations
  const addTask = useCallback(async (data: Partial<Task>): Promise<Task | null> => {
    assertCanEdit();
    if (!activeWorkspace) return null;
    const now = new Date().toISOString();
    const newTask: Task = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      client_id: data.client_id ?? null,
      title: data.title ?? '',
      description: data.description ?? '',
      status: 'Completed',
      videos: data.videos ?? 1,
      price: data.price ?? 0,
      pricing_type: data.pricing_type ?? 'per_video',
      received_date: data.received_date ?? now.slice(0, 10),
      completed_date: data.completed_date ?? now.slice(0, 10),
      deadline: data.deadline ?? null,
      tags: data.tags ?? [],
      order_index: tasks.length,
      created_at: now,
      updated_at: now,
    };

    if (isCloudActive) {
      const { data: cloudTask, error } = await supabase
        .from('tasks')
        .insert([{ ...newTask, user_id: user?.id }])
        .select()
        .single();
      if (!error && cloudTask) {
        const synced = cloudTask as Task;
        const all = storage.getTasks();
        storage.setTasks([...all.filter(t => t.id !== synced.id), synced]);
        setTasks(prev => [...prev, synced]);
        return synced;
      }
    }

    const all = storage.getTasks();
    storage.setTasks([...all, newTask]);
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, [assertCanEdit, activeWorkspace, tasks.length, isCloudActive, user]);

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
    assertCanEdit();
    const now = new Date().toISOString();
    if (isCloudActive) {
      await supabase.from('tasks').update({ ...data, updated_at: now }).eq('id', id);
    }
    const all = storage.getTasks();
    storage.setTasks(all.map(t => t.id === id ? { ...t, ...data, updated_at: now } : t));
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data, updated_at: now } : t));
  }, [assertCanEdit, isCloudActive]);

  const deleteTask = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('tasks').delete().eq('id', id);
    }
    const all = storage.getTasks();
    storage.setTasks(all.filter(t => t.id !== id));
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [assertCanEdit, isCloudActive]);

  // Client Mutations
  const addClient = useCallback(async (data: Partial<Client>): Promise<Client | null> => {
    assertCanEdit();
    if (!activeWorkspace) return null;
    const now = new Date().toISOString();
    const newClient: Client = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      name: data.name ?? '',
      company: data.company ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      color: data.color ?? '#818CF8',
      payment_type: data.payment_type ?? 'per_video',
      monthly_salary: data.monthly_salary ?? 0,
      notes: data.notes ?? '',
      created_at: now,
      updated_at: now,
    };

    if (isCloudActive) {
      const { data: cloudClient, error } = await supabase
        .from('clients')
        .insert([{ ...newClient, user_id: user?.id }])
        .select()
        .single();
      if (!error && cloudClient) {
        const synced = cloudClient as Client;
        const all = storage.getClients();
        storage.setClients([...all.filter(c => c.id !== synced.id), synced]);
        setClients(prev => [...prev, synced]);
        return synced;
      }
    }

    const all = storage.getClients();
    storage.setClients([...all, newClient]);
    setClients(prev => [...prev, newClient]);
    return newClient;
  }, [assertCanEdit, activeWorkspace, isCloudActive, user]);

  const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
    assertCanEdit();
    const now = new Date().toISOString();
    if (isCloudActive) {
      await supabase.from('clients').update({ ...data, updated_at: now }).eq('id', id);
    }
    const all = storage.getClients();
    storage.setClients(all.map(c => c.id === id ? { ...c, ...data, updated_at: now } : c));
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...data, updated_at: now } : c));
  }, [assertCanEdit, isCloudActive]);

  const deleteClient = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('clients').delete().eq('id', id);
    }
    const all = storage.getClients();
    storage.setClients(all.filter(c => c.id !== id));
    setClients(prev => prev.filter(c => c.id !== id));
  }, [assertCanEdit, isCloudActive]);

  // Payment Mutations
  const addPayment = useCallback(async (data: Partial<Payment>) => {
    assertCanEdit();
    if (!activeWorkspace) return;
    const now = new Date().toISOString();
    const newPayment: Payment = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      client_id: data.client_id ?? '',
      amount: data.amount ?? 0,
      method: data.method ?? 'Cash',
      note: data.note ?? '',
      date: data.date ?? now.slice(0, 10),
      payment_for_months: data.payment_for_months ?? [],
      created_at: now,
    };

    if (isCloudActive) {
      const { data: cloudPayment, error } = await supabase
        .from('payments')
        .insert([{ ...newPayment, user_id: user?.id }])
        .select()
        .single();
      if (!error && cloudPayment) {
        const synced = cloudPayment as Payment;
        const all = storage.getPayments();
        storage.setPayments([synced, ...all.filter(p => p.id !== synced.id)]);
        setPayments(prev => [synced, ...prev]);
        return;
      }
    }

    const all = storage.getPayments();
    storage.setPayments([newPayment, ...all]);
    setPayments(prev => [newPayment, ...prev]);
  }, [assertCanEdit, activeWorkspace, isCloudActive, user]);

  const updatePayment = useCallback(async (id: string, data: Partial<Payment>) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('payments').update(data).eq('id', id);
    }
    const all = storage.getPayments();
    storage.setPayments(all.map(p => p.id === id ? { ...p, ...data } : p));
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, [assertCanEdit, isCloudActive]);

  const deletePayment = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('payments').delete().eq('id', id);
    }
    const all = storage.getPayments();
    storage.setPayments(all.filter(p => p.id !== id));
    setPayments(prev => prev.filter(p => p.id !== id));
  }, [assertCanEdit, isCloudActive]);

  // Salary Rate Mutations
  const addSalaryRate = useCallback(async (data: Partial<SalaryRate>) => {
    assertCanEdit();
    if (!activeWorkspace) return;
    const now = new Date().toISOString();
    const newRate: SalaryRate = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      client_id: data.client_id ?? '',
      amount: data.amount ?? 0,
      effective_from: data.effective_from ?? now.slice(0, 7),
      created_at: now,
    };

    if (isCloudActive) {
      const { data: cloudRate, error } = await supabase
        .from('salary_rates')
        .insert([{ ...newRate, user_id: user?.id }])
        .select()
        .single();
      if (!error && cloudRate) {
        const synced = cloudRate as SalaryRate;
        const all = storage.getSalaryRates();
        storage.setSalaryRates([...all.filter(r => r.id !== synced.id), synced]);
        setSalaryRates(prev => [...prev, synced]);
        return;
      }
    }

    const all = storage.getSalaryRates();
    storage.setSalaryRates([...all, newRate]);
    setSalaryRates(prev => [...prev, newRate]);
  }, [assertCanEdit, activeWorkspace, isCloudActive, user]);

  const updateSalaryRate = useCallback(async (id: string, data: Partial<SalaryRate>) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('salary_rates').update(data).eq('id', id);
    }
    const all = storage.getSalaryRates();
    storage.setSalaryRates(all.map(r => r.id === id ? { ...r, ...data } : r));
    setSalaryRates(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  }, [assertCanEdit, isCloudActive]);

  const deleteSalaryRate = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('salary_rates').delete().eq('id', id);
    }
    const all = storage.getSalaryRates();
    storage.setSalaryRates(all.filter(r => r.id !== id));
    setSalaryRates(prev => prev.filter(r => r.id !== id));
  }, [assertCanEdit, isCloudActive]);

  const setClientMonthlyRate = useCallback(async (clientId: string, monthStr: string, amount: number) => {
    assertCanEdit();
    if (!activeWorkspace) return;
    const effectiveFrom = `${monthStr}-01`;
    const existing = salaryRates.find(r => r.client_id === clientId && r.effective_from.slice(0, 7) === monthStr);
    if (existing) {
      await updateSalaryRate(existing.id, { amount });
    } else {
      await addSalaryRate({
        client_id: clientId,
        amount,
        effective_from: effectiveFrom,
      });
    }

    // Also update client.monthly_salary to the latest or current month's rate
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const nowMonth = new Date().toISOString().slice(0, 7);
      if (monthStr >= nowMonth || (client.monthly_salary ?? 0) <= 0) {
        await updateClient(clientId, { monthly_salary: amount });
      }
    }
  }, [assertCanEdit, activeWorkspace, salaryRates, updateSalaryRate, addSalaryRate, clients, updateClient]);

  // Discount Mutations
  const addDiscount = useCallback(async (data: Partial<Discount>) => {
    assertCanEdit();
    if (!activeWorkspace) return;
    const now = new Date().toISOString();
    const newDiscount: Discount = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      client_id: data.client_id ?? '',
      amount: data.amount ?? 0,
      note: data.note ?? '',
      date: data.date ?? now.slice(0, 10),
      payment_for_months: data.payment_for_months ?? [],
      created_at: now,
    };

    if (isCloudActive) {
      const { data: cloudDiscount, error } = await supabase
        .from('discounts')
        .insert([{ ...newDiscount, user_id: user?.id }])
        .select()
        .single();
      if (!error && cloudDiscount) {
        const synced = cloudDiscount as Discount;
        const all = storage.getDiscounts();
        storage.setDiscounts([...all.filter(d => d.id !== synced.id), synced]);
        setDiscounts(prev => [...prev, synced]);
        return;
      }
    }

    const all = storage.getDiscounts();
    storage.setDiscounts([...all, newDiscount]);
    setDiscounts(prev => [...prev, newDiscount]);
  }, [assertCanEdit, activeWorkspace, isCloudActive, user]);

  const updateDiscount = useCallback(async (id: string, data: Partial<Discount>) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('discounts').update(data).eq('id', id);
    }
    const all = storage.getDiscounts();
    storage.setDiscounts(all.map(d => d.id === id ? { ...d, ...data } : d));
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...data } : d));
  }, [assertCanEdit, isCloudActive]);

  const deleteDiscount = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      await supabase.from('discounts').delete().eq('id', id);
    }
    const all = storage.getDiscounts();
    storage.setDiscounts(all.filter(d => d.id !== id));
    setDiscounts(prev => prev.filter(d => d.id !== id));
  }, [assertCanEdit, isCloudActive]);

  // Update Settings
  const updateSettings = useCallback(async (data: Partial<AppSettings>) => {
    const curr = storage.getSettings();
    const updated = { ...curr, ...data };
    storage.setSettings(updated);
    setSettings(updated);

    // Keep in-memory Meta credentials in sync immediately for videoMetadata utilities
    if (updated.meta_app_id && updated.meta_client_token) {
      try { localStorage.setItem('trackrr_meta_access_token', `${updated.meta_app_id.trim()}|${updated.meta_client_token.trim()}`); } catch {}
    } else if (data.meta_app_id === '' || data.meta_client_token === '') {
      try { localStorage.removeItem('trackrr_meta_access_token'); } catch {}
    }

    if (updated.meta_user_token) {
      try { localStorage.setItem('trackrr_meta_user_token', updated.meta_user_token.trim()); } catch {}
    } else if (data.meta_user_token === '') {
      try { localStorage.removeItem('trackrr_meta_user_token'); } catch {}
    }

    if (updated.meta_ig_user_id) {
      try { localStorage.setItem('trackrr_meta_ig_user_id', updated.meta_ig_user_id.trim()); } catch {}
    } else if (data.meta_ig_user_id === '') {
      try { localStorage.removeItem('trackrr_meta_ig_user_id'); } catch {}
    }

    if (isCloudActive && isOnline && user) {
      try {
        const packed = packSettingsForSupabase(updated, user.id);
        const { error } = await supabase.from('settings').upsert(packed, { onConflict: 'user_id' });
        if (error) {
          console.warn('Could not sync settings to cloud:', error);
        }
      } catch (err) {
        console.warn('Network error syncing settings:', err);
      }
    }
  }, [isCloudActive, isOnline, user]);

  // BatchFlow: Add Client
  const addBatchflowClient = useCallback(async (data: Partial<BatchflowClient>) => {
    assertCanEdit();
    if (!activeWorkspace) return null;
    const now = new Date().toISOString();
    const newClient: BatchflowClient = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      user_id: user?.id,
      name: data.name || 'New Client',
      color: data.color || '#818CF8',
      instagram_id: data.instagram_id,
      archived: 0,
      created_at: now,
      updated_at: now,
    };

    // 1. Immediately save locally & update UI first
    const all = storage.getBatchflowClients();
    storage.setBatchflowClients([...all, newClient]);
    setBatchflowClients(prev => [...prev, newClient]);

    // 2. Sync to Supabase
    if (isCloudActive) {
      try {
        const { error } = await supabase
          .from('batchflow_clients')
          .upsert(packClientForSupabase(newClient, user?.id), { onConflict: 'id' });
        if (error) console.warn('Could not upsert into batchflow_clients in cloud:', error);
      } catch (err) {
        console.warn('Could not insert into batchflow_clients in cloud:', err);
      }
    }

    return newClient;
  }, [assertCanEdit, activeWorkspace, isCloudActive, user]);

  const updateBatchflowClient = useCallback(async (id: string, data: Partial<BatchflowClient>) => {
    assertCanEdit();
    const now = new Date().toISOString();
    const updates: Partial<BatchflowClient> = { ...data, updated_at: now };

    // 1. Immediately save locally & update UI first
    const all = storage.getBatchflowClients();
    const existing = all.find(c => c.id === id);
    const mergedClient: BatchflowClient | undefined = existing ? { ...existing, ...updates } : undefined;
    storage.setBatchflowClients(all.map(c => c.id === id ? { ...c, ...updates } : c));
    setBatchflowClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    // 2. Sync to Supabase
    if (isCloudActive && mergedClient) {
      try {
        const { error } = await supabase
          .from('batchflow_clients')
          .upsert(packClientForSupabase(mergedClient, user?.id), { onConflict: 'id' });
        if (error) console.warn('Could not update batchflow_clients in cloud:', error);
      } catch (err) {
        console.warn('Could not update batchflow_clients in cloud:', err);
      }
    }
  }, [assertCanEdit, isCloudActive, user]);

  const deleteBatchflowClient = useCallback(async (id: string) => {
    assertCanEdit();
    // 1. Immediately remove locally
    const all = storage.getBatchflowClients();
    storage.setBatchflowClients(all.filter(c => c.id !== id));
    setBatchflowClients(prev => prev.filter(c => c.id !== id));

    // 2. Sync to Supabase in background
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_clients').delete().eq('id', id);
      } catch (err) {
        console.warn('Could not delete batchflow_clients in cloud:', err);
      }
    }
  }, [assertCanEdit, isCloudActive]);

  // BatchFlow: Batches
  const addBatchflowBatch = useCallback(async (data: {
    client_id: string;
    name: string;
    shoot_date: string;
    script?: string;
    videoCount?: number;
    namingMethod?: string;
  }) => {
    assertCanEdit();
    if (!activeWorkspace) return null;
    const now = new Date().toISOString();
    const batchId = generateId();

    const newBatch: BatchflowBatch = {
      id: batchId,
      workspace_id: activeWorkspace.id,
      user_id: user?.id,
      client_id: data.client_id,
      name: data.name,
      shoot_date: data.shoot_date,
      script: data.script || '',
      archived: 0,
      created_at: now,
      updated_at: now,
    };

    // Auto-generate videos
    const client = batchflowClients.find(c => c.id === data.client_id);
    const count = data.videoCount || 10;
    const generatedVideos: BatchflowVideo[] = [];

    // Find starting video number for this client
    const existingClientVideos = batchflowVideos.filter(v => {
      const b = batchflowBatches.find(batch => batch.id === v.batch_id);
      return b && b.client_id === data.client_id;
    });
    let startNum = 1;
    existingClientVideos.forEach(v => {
      const match = v.name.match(/(\d+)(?!.*\d)/);
      if (match) {
        const num = parseInt(match[0]);
        if (num >= startNum) startNum = num + 1;
      }
    });

    for (let i = 0; i < count; i++) {
      const currentNum = startNum + i;
      const scriptNum = i + 1;
      const videoName = data.namingMethod === 'ClientName'
        ? `${client?.name || 'Video'} ${currentNum}`
        : `Video ${currentNum}`;

      generatedVideos.push({
        id: generateId(),
        workspace_id: activeWorkspace.id,
        user_id: user?.id,
        batch_id: batchId,
        name: videoName,
        script_number: scriptNum,
        status: 'Pending',
        waiting_date: now,
        created_at: now,
        updated_at: now,
      });
    }

    // 1. Immediately save locally & update UI first (guarantees zero data loss)
    const allB = storage.getBatchflowBatches();
    storage.setBatchflowBatches([...allB, newBatch]);
    setBatchflowBatches(prev => [newBatch, ...prev]);

    const allV = storage.getBatchflowVideos();
    storage.setBatchflowVideos([...allV, ...generatedVideos]);
    setBatchflowVideos(prev => [...prev, ...generatedVideos]);

    // 2. Sync to Supabase
    if (isCloudActive) {
      try {
        await upsertWorkspaceToCloud(activeWorkspace, user?.id);
        if (client) {
          await supabase.from('batchflow_clients').upsert(packClientForSupabase(client, user?.id), { onConflict: 'id' });
        }
        await supabase.from('batchflow_batches').upsert(packBatchForSupabase(newBatch, user?.id), { onConflict: 'id' });
        if (generatedVideos.length) {
          const packedVideos = generatedVideos.map(v => packVideoForSupabase(v, user?.id));
          await supabase.from('batchflow_videos').upsert(packedVideos, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Could not insert batchflow cloud records:', err);
      }
    }

    return newBatch;
  }, [assertCanEdit, activeWorkspace, user, batchflowClients, batchflowVideos, batchflowBatches, isCloudActive]);

  const updateBatchflowBatch = useCallback(async (id: string, data: Partial<BatchflowBatch>) => {
    assertCanEdit();
    const now = new Date().toISOString();
    const updates: Partial<BatchflowBatch> = { ...data, updated_at: now };

    // 1. Immediately save locally & update UI first
    const all = storage.getBatchflowBatches();
    const existing = all.find(b => b.id === id) || batchflowBatches.find(b => b.id === id);
    const mergedBatch: BatchflowBatch | undefined = existing ? { ...existing, ...updates } : undefined;
    const nextStorage = all.some(b => b.id === id)
      ? all.map(b => b.id === id ? { ...b, ...updates } : b)
      : (mergedBatch ? [...all, mergedBatch] : all);
    storage.setBatchflowBatches(nextStorage);
    setBatchflowBatches(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));

    // 2. Sync to Supabase
    if (isCloudActive && mergedBatch) {
      try {
        let { error } = await supabase
          .from('batchflow_batches')
          .upsert(packBatchForSupabase(mergedBatch, user?.id), { onConflict: 'id' });
        if (error) {
          await supabase.auth.refreshSession().catch(() => {});
          if (activeWorkspace) {
            await upsertWorkspaceToCloud(activeWorkspace, user?.id);
          }
          const parentClient = storage.getBatchflowClients().find(c => c.id === mergedBatch.client_id) ||
                               batchflowClients.find(c => c.id === mergedBatch.client_id);
          if (parentClient) {
            await supabase.from('batchflow_clients').upsert(packClientForSupabase(parentClient, user?.id), { onConflict: 'id' });
          }
          const retry = await supabase
            .from('batchflow_batches')
            .upsert(packBatchForSupabase(mergedBatch, user?.id), { onConflict: 'id' });
          error = retry.error;
        }
        if (error) {
          console.warn('Could not update batchflow_batches:', error);
        }
      } catch (err) {
        console.warn('Could not update batchflow_batches:', err);
      }
    }
  }, [assertCanEdit, isCloudActive, user, activeWorkspace, batchflowBatches, batchflowClients]);

  const deleteBatchflowBatch = useCallback(async (id: string) => {
    assertCanEdit();
    // 1. Immediately remove locally
    const allB = storage.getBatchflowBatches();
    storage.setBatchflowBatches(allB.filter(b => b.id !== id));
    setBatchflowBatches(prev => prev.filter(b => b.id !== id));

    const allV = storage.getBatchflowVideos();
    storage.setBatchflowVideos(allV.filter(v => v.batch_id !== id));
    setBatchflowVideos(prev => prev.filter(v => v.batch_id !== id));

    // 2. Sync to Supabase in background
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_batches').delete().eq('id', id);
        await supabase.from('batchflow_videos').delete().eq('batch_id', id);
      } catch (err) {
        console.warn('Could not delete batchflow_batches:', err);
      }
    }
  }, [assertCanEdit, isCloudActive]);

  // BatchFlow: Videos
  const addBatchflowVideo = useCallback(async (data: Partial<BatchflowVideo>) => {
    assertCanEdit();
    if (!activeWorkspace || !data.batch_id) return null;
    const now = new Date().toISOString();
    const newVideo: BatchflowVideo = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      user_id: user?.id,
      batch_id: data.batch_id,
      name: data.name || 'New Video',
      script_number: data.script_number !== undefined ? data.script_number : 1,
      description: data.description !== undefined ? data.description : null,
      status: data.status || 'Pending',
      video_url: data.video_url !== undefined ? data.video_url : null,
      views: data.views !== undefined ? data.views : null,
      likes: data.likes !== undefined ? data.likes : null,
      waiting_date: now,
      created_at: now,
      updated_at: now,
    };

    // 1. Immediately save locally & update UI first (guarantees zero data loss)
    const all = storage.getBatchflowVideos();
    storage.setBatchflowVideos([...all, newVideo]);
    setBatchflowVideos(prev => [...prev, newVideo]);

    // 2. Sync to Supabase
    if (isCloudActive) {
      try {
        const packed = packVideoForSupabase(newVideo, user?.id);
        let { error } = await supabase.from('batchflow_videos').upsert(packed, { onConflict: 'id' });
        if (error) {
          await supabase.auth.refreshSession().catch(() => {});
          await upsertWorkspaceToCloud(activeWorkspace, user?.id);
          const parentBatch = storage.getBatchflowBatches().find(b => b.id === newVideo.batch_id) ||
                              batchflowBatches.find(b => b.id === newVideo.batch_id);
          if (parentBatch) {
            const parentClient = storage.getBatchflowClients().find(c => c.id === parentBatch.client_id) ||
                                 batchflowClients.find(c => c.id === parentBatch.client_id);
            if (parentClient) {
              await supabase.from('batchflow_clients').upsert(packClientForSupabase(parentClient, user?.id), { onConflict: 'id' });
            }
            await supabase.from('batchflow_batches').upsert(packBatchForSupabase(parentBatch, user?.id), { onConflict: 'id' });
            await supabase.from('batchflow_videos').upsert(packed, { onConflict: 'id' });
          }
        }
      } catch (err) {
        console.warn('Could not insert batchflow_videos to cloud:', err);
      }
    }

    return newVideo;
  }, [assertCanEdit, activeWorkspace, user, isCloudActive, batchflowBatches, batchflowClients]);

  const updateBatchflowVideo = useCallback(async (id: string, data: Partial<BatchflowVideo>) => {
    assertCanEdit();
    const now = new Date().toISOString();
    const updates: Partial<BatchflowVideo> = {
      ...data,
      updated_at: now,
    };

    // 1. Immediately save locally & update UI first (guarantees zero data loss on immediate refresh)
    const all = storage.getBatchflowVideos();
    const existing = all.find(v => v.id === id) || batchflowVideos.find(v => v.id === id);
    const mergedVideo: BatchflowVideo | undefined = existing ? { ...existing, ...updates } : undefined;
    const nextStorage = all.some(v => v.id === id)
      ? all.map(v => v.id === id ? { ...v, ...updates } : v)
      : (mergedVideo ? [...all, mergedVideo] : all);
    storage.setBatchflowVideos(nextStorage);
    setBatchflowVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));

    // 2. Sync to Supabase & verify save
    if (isCloudActive && mergedVideo) {
      const packed = packVideoForSupabase(mergedVideo, user?.id);
      let { error } = await supabase.from('batchflow_videos').upsert(packed, { onConflict: 'id' });
      if (error) {
        await supabase.auth.refreshSession().catch(() => {});
        if (activeWorkspace) {
          await upsertWorkspaceToCloud(activeWorkspace, user?.id);
        }
        const parentBatch = storage.getBatchflowBatches().find(b => b.id === mergedVideo.batch_id) ||
                            batchflowBatches.find(b => b.id === mergedVideo.batch_id);
        if (parentBatch) {
          const parentClient = storage.getBatchflowClients().find(c => c.id === parentBatch.client_id) ||
                               batchflowClients.find(c => c.id === parentBatch.client_id);
          if (parentClient) {
            await supabase.from('batchflow_clients').upsert(packClientForSupabase(parentClient, user?.id), { onConflict: 'id' });
          }
          await supabase.from('batchflow_batches').upsert(packBatchForSupabase(parentBatch, user?.id), { onConflict: 'id' });
        }
        const retry = await supabase.from('batchflow_videos').upsert(packed, { onConflict: 'id' });
        error = retry.error;
        if (error) {
          const updateFallback = await supabase
            .from('batchflow_videos')
            .update({
              name: packed.name,
              script_number: packed.script_number,
              status: packed.status,
              waiting_date: packed.waiting_date,
              edited_date: packed.edited_date,
              posted_date: packed.posted_date,
            })
            .eq('id', id);
          error = updateFallback.error;
        }
      }
      if (error) {
        console.error('Could not update batchflow_videos in cloud:', error);
        throw new Error(error.message || 'Failed to save to database');
      }
    }
  }, [assertCanEdit, isCloudActive, user, activeWorkspace, batchflowVideos, batchflowBatches, batchflowClients]);

  const updateBatchflowVideoStatus = useCallback(async (
    id: string,
    status: BatchflowVideoStatus,
    videoUrl?: string | null,
    postedDate?: string | null,
    views?: string | number | null,
    likes?: string | number | null
  ) => {
    assertCanEdit();
    const now = new Date().toISOString();
    const updates: Partial<BatchflowVideo> = {
      status,
      updated_at: now,
    };
    if (status === 'Pending') updates.waiting_date = now;
    if (status === 'Edited') updates.edited_date = now;
    if (status === 'Posted') {
      updates.posted_date = postedDate ? (postedDate.includes('T') ? postedDate : `${postedDate}T12:00:00.000Z`) : now;
      if (videoUrl !== undefined) {
        updates.video_url = videoUrl;
      }
      if (views !== undefined) {
        updates.views = views;
      }
      if (likes !== undefined) {
        updates.likes = likes;
      }
    } else {
      if (videoUrl !== undefined) {
        updates.video_url = videoUrl;
      }
      if (views !== undefined) {
        updates.views = views;
      }
      if (likes !== undefined) {
        updates.likes = likes;
      }
    }

    // 1. Update in-memory state
    const all = storage.getBatchflowVideos();
    const existing = all.find(v => v.id === id) || batchflowVideos.find(v => v.id === id);
    const mergedVideo: BatchflowVideo | undefined = existing ? { ...existing, ...updates } : undefined;
    const nextStorage = all.some(v => v.id === id)
      ? all.map(v => v.id === id ? { ...v, ...updates } : v)
      : (mergedVideo ? [...all, mergedVideo] : all);
    storage.setBatchflowVideos(nextStorage);
    setBatchflowVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));

    // 2. Sync to Supabase & verify save
    if (isCloudActive && mergedVideo) {
      const packed = packVideoForSupabase(mergedVideo, user?.id);
      let { error } = await supabase.from('batchflow_videos').upsert(packed, { onConflict: 'id' });
      if (error) {
        await supabase.auth.refreshSession().catch(() => {});
        if (activeWorkspace) {
          await upsertWorkspaceToCloud(activeWorkspace, user?.id);
        }
        const parentBatch = storage.getBatchflowBatches().find(b => b.id === mergedVideo.batch_id) ||
                            batchflowBatches.find(b => b.id === mergedVideo.batch_id);
        if (parentBatch) {
          const parentClient = storage.getBatchflowClients().find(c => c.id === parentBatch.client_id) ||
                               batchflowClients.find(c => c.id === parentBatch.client_id);
          if (parentClient) {
            await supabase.from('batchflow_clients').upsert(packClientForSupabase(parentClient, user?.id), { onConflict: 'id' });
          }
          await supabase.from('batchflow_batches').upsert(packBatchForSupabase(parentBatch, user?.id), { onConflict: 'id' });
        }
        const retry = await supabase.from('batchflow_videos').upsert(packed, { onConflict: 'id' });
        error = retry.error;
        if (error) {
          const updateFallback = await supabase
            .from('batchflow_videos')
            .update({
              name: packed.name,
              script_number: packed.script_number,
              status: packed.status,
              waiting_date: packed.waiting_date,
              edited_date: packed.edited_date,
              posted_date: packed.posted_date,
            })
            .eq('id', id);
          error = updateFallback.error;
        }
      }
      if (error) {
        console.error('Could not update status in batchflow_videos:', error);
        throw new Error(error.message || 'Failed to save to database');
      }
    }
  }, [assertCanEdit, isCloudActive, user, activeWorkspace, batchflowVideos, batchflowBatches, batchflowClients]);

  const deleteBatchflowVideo = useCallback(async (id: string) => {
    assertCanEdit();
    // 1. Immediately remove locally & update UI first
    const all = storage.getBatchflowVideos();
    storage.setBatchflowVideos(all.filter(v => v.id !== id));
    setBatchflowVideos(prev => prev.filter(v => v.id !== id));

    // 2. Sync to Supabase in background
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_videos').delete().eq('id', id);
      } catch (err) {
        console.warn('Could not delete batchflow_videos:', err);
      }
    }
  }, [assertCanEdit, isCloudActive]);

  // Unified Backup Data Import
  const importBackupData = useCallback(async (data: any): Promise<{ success: boolean; message: string }> => {
    if (!activeWorkspace) return { success: false, message: 'No active workspace selected' };
    const wsId = activeWorkspace.id;
    const now = new Date().toISOString();
    let importedCount = 0;

    const hasBatchflowData = Boolean(
      (Array.isArray(data.batches) && data.batches.length) ||
      (Array.isArray(data.videos) && data.videos.length)
    );
    const hasFreelanceData = Boolean(
      (Array.isArray(data.tasks) && data.tasks.length) ||
      (Array.isArray(data.payments) && data.payments.length) ||
      (Array.isArray(data.discounts) && data.discounts.length) ||
      (Array.isArray(data.salaryRates) && data.salaryRates.length)
    );

    // If active workspace is batchflow, prioritize batchflow import; otherwise if hasBatchflowData
    const isBatchflowImport = hasBatchflowData || (!hasFreelanceData && activeWorkspace.type === 'batchflow');
    const isFreelanceImport = hasFreelanceData || (!hasBatchflowData && activeWorkspace.type !== 'batchflow' && Array.isArray(data.clients));

    // 1. Check for Freelance Tracker backup structure
    if (isFreelanceImport) {
      const clientMap = new Map<string, string>();
      if (Array.isArray(data.clients) && data.clients.length) {
        const mappedClients: Client[] = data.clients.map((c: any) => {
          const newId = generateId();
          clientMap.set(c.id, newId);
          return {
            ...c,
            id: newId,
            workspace_id: wsId,
            user_id: user?.id,
            created_at: c.created_at || now,
            updated_at: now,
          };
        });
        setClients(prev => [...prev, ...mappedClients]);
        const allC = storage.getClients();
        storage.setClients([...allC, ...mappedClients]);
        if (isCloudActive) {
          try { await supabase.from('clients').insert(mappedClients); } catch {}
        }
        importedCount += mappedClients.length;

        if (Array.isArray(data.tasks) && data.tasks.length) {
          const mappedTasks: Task[] = data.tasks.map((t: any) => ({
            ...t,
            id: generateId(),
            workspace_id: wsId,
            client_id: clientMap.get(t.client_id) || t.client_id || null,
            user_id: user?.id,
            created_at: t.created_at || now,
            updated_at: now,
          }));
          setTasks(prev => [...prev, ...mappedTasks]);
          const allT = storage.getTasks();
          storage.setTasks([...allT, ...mappedTasks]);
          if (isCloudActive) {
            try { await supabase.from('tasks').insert(mappedTasks); } catch {}
          }
          importedCount += mappedTasks.length;
        }

        if (Array.isArray(data.payments) && data.payments.length) {
          const mappedPayments: Payment[] = data.payments.map((p: any) => ({
            ...p,
            id: generateId(),
            workspace_id: wsId,
            client_id: clientMap.get(p.client_id) || p.client_id,
            user_id: user?.id,
            created_at: p.created_at || now,
          }));
          setPayments(prev => [...prev, ...mappedPayments]);
          const allP = storage.getPayments();
          storage.setPayments([...allP, ...mappedPayments]);
          if (isCloudActive) {
            try { await supabase.from('payments').insert(mappedPayments); } catch {}
          }
          importedCount += mappedPayments.length;
        }
      }
    }

    // 2. Check for BatchFlow backup structure
    if (isBatchflowImport) {
      const clientMap = new Map<string, string>();
      const mappedBfClients: BatchflowClient[] = [];
      if (Array.isArray(data.clients) && data.clients.length) {
        data.clients.forEach((c: any) => {
          const newId = generateId();
          clientMap.set(c.id, newId);
          mappedBfClients.push({
            id: newId,
            workspace_id: wsId,
            user_id: user?.id,
            name: c.name,
            color: c.color || '#818CF8',
            instagram_id: c.instagram_id || c.instagramId || '',
            archived: c.archived || 0,
            created_at: c.created_at || now,
          });
        });
        setBatchflowClients(prev => [...prev, ...mappedBfClients]);
        const allBfC = storage.getBatchflowClients();
        storage.setBatchflowClients([...allBfC, ...mappedBfClients]);
        if (isCloudActive) {
          try {
            const packedC = mappedBfClients.map(c => packClientForSupabase(c, user?.id));
            await supabase.from('batchflow_clients').upsert(packedC, { onConflict: 'id' });
          } catch {}
        }
        importedCount += mappedBfClients.length;
      }

      const batchMap = new Map<string, string>();
      const mappedBatches: BatchflowBatch[] = [];
      if (Array.isArray(data.batches) && data.batches.length) {
        data.batches.forEach((b: any) => {
          const newId = generateId();
          batchMap.set(b.id, newId);
          mappedBatches.push({
            id: newId,
            workspace_id: wsId,
            user_id: user?.id,
            client_id: clientMap.get(b.client_id) || b.client_id,
            name: b.name,
            shoot_date: b.shoot_date || b.shootDate || '',
            script: b.script || '',
            archived: b.archived || 0,
            created_at: b.created_at || now,
          });
        });
      }

      // Check for orphaned videos that reference a batch not in data.batches (e.g. Fonify batch)
      if (Array.isArray(data.videos) && data.videos.length) {
        data.videos.forEach((v: any) => {
          if (v.batch_id && !batchMap.has(v.batch_id)) {
            const newBatchId = generateId();
            batchMap.set(v.batch_id, newBatchId);
            const matchedClient = Array.isArray(data.clients)
              ? data.clients.find((c: any) => v.name?.toLowerCase().startsWith(c.name?.toLowerCase()))
              : null;
            mappedBatches.push({
              id: newBatchId,
              workspace_id: wsId,
              user_id: user?.id,
              client_id: (matchedClient && clientMap.get(matchedClient.id)) || (mappedBfClients[0]?.id || ''),
              name: matchedClient ? `${matchedClient.name} Batch` : 'Imported Batch',
              shoot_date: v.created_at ? String(v.created_at).slice(0, 10) : '',
              script: '',
              archived: 0,
              created_at: v.created_at || now,
            });
          }
        });
      }

      if (mappedBatches.length > 0) {
        setBatchflowBatches(prev => [...prev, ...mappedBatches]);
        const allBfB = storage.getBatchflowBatches();
        storage.setBatchflowBatches([...allBfB, ...mappedBatches]);
        if (isCloudActive) {
          try {
            const packedB = mappedBatches.map(b => packBatchForSupabase(b, user?.id));
            await supabase.from('batchflow_batches').upsert(packedB, { onConflict: 'id' });
          } catch {}
        }
        importedCount += mappedBatches.length;
      }

      if (Array.isArray(data.videos) && data.videos.length) {
        const mappedVideos: BatchflowVideo[] = data.videos.map((v: any) => ({
          id: generateId(),
          workspace_id: wsId,
          user_id: user?.id,
          batch_id: batchMap.get(v.batch_id) || v.batch_id,
          name: v.name,
          script_number: v.script_number ?? v.scriptNumber ?? 1,
          description: v.description || null,
          video_url: v.video_url || null,
          views: v.views || null,
          likes: v.likes || null,
          status: v.status || 'Pending',
          waiting_date: v.waiting_date || now,
          edited_date: v.edited_date || null,
          posted_date: v.posted_date || null,
          created_at: v.created_at || now,
          updated_at: now,
        }));
        setBatchflowVideos(prev => [...prev, ...mappedVideos]);
        const allBfV = storage.getBatchflowVideos();
        storage.setBatchflowVideos([...allBfV, ...mappedVideos]);
        if (isCloudActive) {
          try {
            const packedV = mappedVideos.map(v => packVideoForSupabase(v, user?.id));
            await supabase.from('batchflow_videos').upsert(packedV, { onConflict: 'id' });
          } catch {}
        }
        importedCount += mappedVideos.length;
      }
    }

    return { success: true, message: `Successfully imported ${importedCount} items into current workspace.` };
  }, [activeWorkspace, user, isCloudActive]);

  // Collaboration: Invite collaborator
  const inviteCollaborator = useCallback(async (
    workspaceId: string,
    email: string,
    role: 'manager' | 'viewer'
  ) => {
    if (!isOnline) return { error: new Error('Cannot invite collaborators while offline') };
    if (!user || !activeWorkspace) return { error: new Error('User not logged in') };

    const { data: newInvite, error } = await supabase.from('workspace_invites').insert([{
      workspace_id: workspaceId,
      workspace_name: activeWorkspace.name,
      invited_by_user_id: user.id,
      invited_by_email: user.email || 'Workspace Owner',
      invitee_email: email.toLowerCase().trim(),
      role,
      status: 'pending',
    }]).select().single();

    if (!error && newInvite) {
      setWorkspaceInvites(prev => [...prev, newInvite as WorkspaceInvite]);
    }

    return { error };
  }, [isOnline, user, activeWorkspace]);

  // Collaboration: Cancel / Revoke invite
  const cancelInvite = useCallback(async (inviteId: string) => {
    if (!isOnline) return { error: new Error('Cannot cancel invite while offline') };
    const { error } = await supabase
      .from('workspace_invites')
      .delete()
      .eq('id', inviteId);

    if (!error) {
      setWorkspaceInvites(prev => prev.filter(i => i.id !== inviteId));
    }
    return { error };
  }, [isOnline]);

  // Collaboration: Remove collaborator
  const removeCollaborator = useCallback(async (workspaceId: string, userId: string) => {
    if (!isOnline) throw new Error('Cannot remove collaborator while offline');
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (!error) {
      setWorkspaceMembers(prev => prev.filter(m => m.user_id !== userId));
    }
    return { error };
  }, [isOnline]);

  // Collaboration: Respond to invite (Accept or Decline)
  const respondToInvite = useCallback(async (inviteId: string, accept: boolean) => {
    if (!isOnline) return { error: new Error('Cannot respond to invite while offline') };
    if (!user) return { error: new Error('Not logged in') };

    const invite = pendingInvites.find(i => i.id === inviteId);
    if (!invite) return { error: new Error('Invite not found') };

    const status = accept ? 'accepted' : 'declined';
    await supabase.from('workspace_invites').update({ status }).eq('id', inviteId);

    if (accept) {
      // Add as workspace member
      await supabase.from('workspace_members').insert([{
        workspace_id: invite.workspace_id,
        user_id: user.id,
        user_email: user.email || '',
        role: invite.role,
      }]);

      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
      await fetchAll(invite.workspace_id);
    } else {
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    }

    return {};
  }, [isOnline, user, pendingInvites, fetchAll]);

  return (
    <AppContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        clients,
        tasks,
        payments,
        salaryRates,
        discounts,
        settings,
        loading,
        currentView,
        isOnline,
        currentRole,
        canEdit,
        workspaceMembers,
        pendingInvites,
        workspaceInvites,
        setCurrentView,
        switchWorkspace,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        addTask,
        updateTask,
        deleteTask,
        addClient,
        updateClient,
        deleteClient,
        addPayment,
        updatePayment,
        deletePayment,
        addSalaryRate,
        updateSalaryRate,
        deleteSalaryRate,
        setClientMonthlyRate,
        addDiscount,
        updateDiscount,
        deleteDiscount,
        batchflowClients,
        batchflowBatches,
        batchflowVideos,
        addBatchflowClient,
        updateBatchflowClient,
        deleteBatchflowClient,
        addBatchflowBatch,
        updateBatchflowBatch,
        deleteBatchflowBatch,
        addBatchflowVideo,
        updateBatchflowVideo,
        updateBatchflowVideoStatus,
        deleteBatchflowVideo,
        importBackupData,
        updateSettings,
        inviteCollaborator,
        cancelInvite,
        removeCollaborator,
        respondToInvite,
        refetch: fetchAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
