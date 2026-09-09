import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage, generateId } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useNetworkStatus } from '../lib/useNetworkStatus';
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
  updateBatchflowVideoStatus: (id: string, status: BatchflowVideoStatus) => Promise<void>;
  deleteBatchflowVideo: (id: string) => Promise<void>;
  importBackupData: (data: any) => Promise<{ success: boolean; message: string }>;
  updateSettings: (data: Partial<AppSettings>) => Promise<void>;
  inviteCollaborator: (workspaceId: string, email: string, role: 'manager' | 'viewer') => Promise<{ error?: any }>;
  cancelInvite: (inviteId: string) => Promise<{ error?: any }>;
  removeCollaborator: (workspaceId: string, userId: string) => Promise<{ error?: any }>;
  respondToInvite: (inviteId: string, accept: boolean) => Promise<{ error?: any }>;
  refetch: () => Promise<void>;
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
    const s = storage.getSettings();
    return ws.find(w => w.id === s.active_workspace_id) ?? ws[0] ?? null;
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
  const [currentView, setCurrentView] = useState<ViewName>('dashboard');

  // Compute active role
  const currentRole: WorkspaceRole = (() => {
    if (!user || !activeWorkspace) return 'owner';
    if (activeWorkspace.user_id === user.id) return 'owner';
    const member = workspaceMembers.find(m => m.workspace_id === activeWorkspace.id && m.user_id === user.id);
    return member?.role ?? 'viewer';
  })();

  const canEdit = isOnline && (currentRole === 'owner' || currentRole === 'manager');

  // Load from local storage cache first
  const loadLocalCache = useCallback((wsId?: string) => {
    const wsList = storage.getWorkspaces();
    const appSettings = storage.getSettings();
    setWorkspaces(wsList);
    setSettings(appSettings);

    const targetId = wsId ?? appSettings.active_workspace_id ?? wsList[0]?.id ?? null;
    const active = wsList.find(w => w.id === targetId) ?? wsList[0] ?? null;
    setActiveWorkspace(active);

    if (active) {
      if (active.type === 'batchflow') {
        const bfClients = storage.getBatchflowClients().filter(c => c.workspace_id === active.id);
        const bfBatches = storage.getBatchflowBatches().filter(b => b.workspace_id === active.id);
        const bfVideos = storage.getBatchflowVideos().filter(v => v.workspace_id === active.id);
        setBatchflowClients(bfClients);
        setBatchflowBatches(bfBatches);
        setBatchflowVideos(bfVideos);
      } else {
        const allClients = storage.getClients().filter(c => c.workspace_id === active.id);
        const allTasks = storage.getTasks().filter(t => t.workspace_id === active.id).sort((a, b) => a.order_index - b.order_index);
        const allPayments = storage.getPayments().filter(p => p.workspace_id === active.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const allRates = storage.getSalaryRates().filter(sr => sr.workspace_id === active.id).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
        const allDiscounts = storage.getDiscounts().filter(d => d.workspace_id === active.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        setClients(allClients);
        setTasks(allTasks);
        setPayments(allPayments);
        setSalaryRates(allRates);
        setDiscounts(allDiscounts);
      }
    }
  }, []);

  // Fetch full data from Supabase (or fallback to local)
  const fetchAll = useCallback(async (wsId?: string) => {
    if (!isCloudActive || !isOnline) {
      loadLocalCache(wsId);
      return;
    }

    try {
      // 1. Fetch workspaces
      const { data: cloudWs, error: wsErr } = await supabase.from('workspaces').select('*');
      if (wsErr) {
        console.error('Error loading cloud workspaces:', wsErr);
        loadLocalCache(wsId);
        return;
      }

      let activeWsList = (cloudWs as Workspace[]) || [];

      // Preserve local workspace metadata (such as type) and local-only workspaces
      const localWorkspaces = storage.getWorkspaces();
      const localWsMap = new Map(localWorkspaces.map(w => [w.id, w]));
      const cloudIds = new Set(activeWsList.map(w => w.id));

      activeWsList = activeWsList.map(w => {
        const local = localWsMap.get(w.id);
        // If locally marked or created as batchflow, NEVER let cloud default overwrite it
        const resolvedType = (w.type === 'batchflow' || local?.type === 'batchflow')
          ? 'batchflow'
          : (w.type || local?.type || 'freelance');

        return {
          ...w,
          type: resolvedType,
        };
      });

      // Keep any locally created workspace not yet present in the cloud
      for (const loc of localWorkspaces) {
        if (!cloudIds.has(loc.id)) {
          activeWsList.push(loc);
        }
      }

      // Initial auto-migration: if user logged in and cloud is empty, migrate local data
      if ((cloudWs as Workspace[] || []).length === 0) {
        const localWs = storage.getWorkspaces();
        if (localWs.length > 0) {
          const wsToUpload = localWs.map(w => ({ ...w, user_id: user?.id }));
          const { data: createdWs } = await supabase.from('workspaces').insert(wsToUpload).select();
          if (createdWs && createdWs.length > 0) {
            activeWsList = createdWs as Workspace[];

            // Migrate other items
            const localClients = storage.getClients().map(c => ({ ...c, user_id: user?.id }));
            const localTasks = storage.getTasks().map(t => ({ ...t, user_id: user?.id }));
            const localPayments = storage.getPayments().map(p => ({ ...p, user_id: user?.id }));
            const localRates = storage.getSalaryRates().map(r => ({ ...r, user_id: user?.id }));
            const localDiscounts = storage.getDiscounts().map(d => ({ ...d, user_id: user?.id }));

            if (localClients.length) await supabase.from('clients').insert(localClients);
            if (localTasks.length) await supabase.from('tasks').insert(localTasks);
            if (localPayments.length) await supabase.from('payments').insert(localPayments);
            if (localRates.length) await supabase.from('salary_rates').insert(localRates);
            if (localDiscounts.length) await supabase.from('discounts').insert(localDiscounts);
          }
        }
      }

      setWorkspaces(activeWsList);
      storage.setWorkspaces(activeWsList);

      const savedSettings = storage.getSettings();
      const targetId = wsId ?? savedSettings.active_workspace_id ?? settings.active_workspace_id ?? activeWsList[0]?.id ?? null;
      const active = activeWsList.find(w => w.id === targetId) ?? activeWsList[0] ?? null;
      setActiveWorkspace(active);

      if (active) {
        // Fetch workspace members
        const { data: members } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', active.id);
        setWorkspaceMembers((members as WorkspaceMember[]) || []);

        // Fetch sent pending invites for active workspace
        const { data: wsInvites } = await supabase
          .from('workspace_invites')
          .select('*')
          .eq('workspace_id', active.id)
          .eq('status', 'pending');
        setWorkspaceInvites((wsInvites as WorkspaceInvite[]) || []);

        if (active.type === 'batchflow') {
          try {
            const [bfCRes, bfBRes, bfVRes] = await Promise.all([
              supabase.from('batchflow_clients').select('*').eq('workspace_id', active.id).order('name', { ascending: true }),
              supabase.from('batchflow_batches').select('*').eq('workspace_id', active.id).order('shoot_date', { ascending: false }),
              supabase.from('batchflow_videos').select('*').eq('workspace_id', active.id).order('script_number', { ascending: true }),
            ]);

            const bfC = (bfCRes.data as BatchflowClient[]) || [];
            const bfB = (bfBRes.data as BatchflowBatch[]) || [];
            const bfV = (bfVRes.data as BatchflowVideo[]) || [];

            setBatchflowClients(bfC);
            setBatchflowBatches(bfB);
            setBatchflowVideos(bfV);
            storage.setBatchflowClients(bfC);
            storage.setBatchflowBatches(bfB);
            storage.setBatchflowVideos(bfV);
          } catch {
            const bfC = storage.getBatchflowClients().filter(c => c.workspace_id === active.id);
            const bfB = storage.getBatchflowBatches().filter(b => b.workspace_id === active.id);
            const bfV = storage.getBatchflowVideos().filter(v => v.workspace_id === active.id);
            setBatchflowClients(bfC);
            setBatchflowBatches(bfB);
            setBatchflowVideos(bfV);
          }
        } else {
          // Fetch freelance workspace data in parallel
          const [cRes, tRes, pRes, rRes, dRes] = await Promise.all([
            supabase.from('clients').select('*').eq('workspace_id', active.id),
            supabase.from('tasks').select('*').eq('workspace_id', active.id).order('order_index', { ascending: true }),
            supabase.from('payments').select('*').eq('workspace_id', active.id).order('date', { ascending: false }),
            supabase.from('salary_rates').select('*').eq('workspace_id', active.id).order('effective_from', { ascending: true }),
            supabase.from('discounts').select('*').eq('workspace_id', active.id).order('date', { ascending: false }),
          ]);

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

          // Update local storage backup
          storage.setClients(cl);
          storage.setTasks(tk);
          storage.setPayments(pm);
          storage.setSalaryRates(sr);
          storage.setDiscounts(ds);
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
      loadLocalCache(wsId);
    }
  }, [isCloudActive, isOnline, user, settings.active_workspace_id, loadLocalCache]);

  // Initial load on mount or user/auth change
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        storage.initStorage();
        loadLocalCache();
        await fetchAll();
      } finally {
        setLoading(false);
      }
    })();
  }, [user, fetchAll, loadLocalCache]);

  // Workspace Switch
  const switchWorkspace = useCallback(async (id: string) => {
    const currSettings = storage.getSettings();
    const updated = { ...currSettings, active_workspace_id: id };
    storage.setSettings(updated);
    setSettings(updated);
    await fetchAll(id);
  }, [fetchAll]);

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
        setTasks(prev => [...prev, cloudTask as Task]);
        return cloudTask as Task;
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
        setClients(prev => [...prev, cloudClient as Client]);
        return cloudClient as Client;
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
        setPayments(prev => [cloudPayment as Payment, ...prev]);
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
        setSalaryRates(prev => [...prev, cloudRate as SalaryRate]);
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
        setDiscounts(prev => [...prev, cloudDiscount as Discount]);
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

    if (isCloudActive && isOnline && user) {
      try {
        const payload: any = {
          user_id: user.id,
          currency: updated.currency,
          theme_color: updated.theme_color,
          theme_style: updated.theme_style,
          show_completed: updated.show_completed,
          active_workspace_id: updated.active_workspace_id,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
        if (error) {
          // If theme_style column does not exist in legacy cloud table, retry without it
          if (error.message?.includes('theme_style') || error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column')) {
            const { theme_style: _ts, ...payloadNoThemeStyle } = payload;
            await supabase.from('settings').upsert(payloadNoThemeStyle, { onConflict: 'user_id' });
          } else {
            console.warn('Could not sync settings to cloud:', error);
          }
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
    };

    if (isCloudActive) {
      try {
        const { data: cloudC, error } = await supabase
          .from('batchflow_clients')
          .insert([newClient])
          .select()
          .single();
        if (!error && cloudC) {
          setBatchflowClients(prev => [...prev, cloudC as BatchflowClient]);
          return cloudC as BatchflowClient;
        }
      } catch (err) {
        console.warn('Could not insert into batchflow_clients in cloud:', err);
      }
    }

    const all = storage.getBatchflowClients();
    storage.setBatchflowClients([...all, newClient]);
    setBatchflowClients(prev => [...prev, newClient]);
    return newClient;
  }, [assertCanEdit, activeWorkspace, isCloudActive, user]);

  const updateBatchflowClient = useCallback(async (id: string, data: Partial<BatchflowClient>) => {
    assertCanEdit();
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_clients').update(data).eq('id', id);
      } catch (err) {
        console.warn('Could not update batchflow_clients in cloud:', err);
      }
    }
    const all = storage.getBatchflowClients();
    storage.setBatchflowClients(all.map(c => c.id === id ? { ...c, ...data } : c));
    setBatchflowClients(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, [assertCanEdit, isCloudActive]);

  const deleteBatchflowClient = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_clients').delete().eq('id', id);
      } catch (err) {
        console.warn('Could not delete batchflow_clients in cloud:', err);
      }
    }
    const all = storage.getBatchflowClients();
    storage.setBatchflowClients(all.filter(c => c.id !== id));
    setBatchflowClients(prev => prev.filter(c => c.id !== id));
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
      });
    }

    if (isCloudActive) {
      try {
        await supabase.from('batchflow_batches').insert([newBatch]);
        if (generatedVideos.length) {
          await supabase.from('batchflow_videos').insert(generatedVideos);
        }
      } catch (err) {
        console.warn('Could not insert batchflow cloud records:', err);
      }
    }

    const allB = storage.getBatchflowBatches();
    storage.setBatchflowBatches([...allB, newBatch]);
    setBatchflowBatches(prev => [newBatch, ...prev]);

    const allV = storage.getBatchflowVideos();
    storage.setBatchflowVideos([...allV, ...generatedVideos]);
    setBatchflowVideos(prev => [...prev, ...generatedVideos]);

    return newBatch;
  }, [assertCanEdit, activeWorkspace, user, batchflowClients, batchflowVideos, batchflowBatches, isCloudActive]);

  const updateBatchflowBatch = useCallback(async (id: string, data: Partial<BatchflowBatch>) => {
    assertCanEdit();
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_batches').update(data).eq('id', id);
      } catch (err) {
        console.warn('Could not update batchflow_batches:', err);
      }
    }
    const all = storage.getBatchflowBatches();
    storage.setBatchflowBatches(all.map(b => b.id === id ? { ...b, ...data } : b));
    setBatchflowBatches(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, [assertCanEdit, isCloudActive]);

  const deleteBatchflowBatch = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_batches').delete().eq('id', id);
        await supabase.from('batchflow_videos').delete().eq('batch_id', id);
      } catch (err) {
        console.warn('Could not delete batchflow_batches:', err);
      }
    }
    const allB = storage.getBatchflowBatches();
    storage.setBatchflowBatches(allB.filter(b => b.id !== id));
    setBatchflowBatches(prev => prev.filter(b => b.id !== id));

    const allV = storage.getBatchflowVideos();
    storage.setBatchflowVideos(allV.filter(v => v.batch_id !== id));
    setBatchflowVideos(prev => prev.filter(v => v.batch_id !== id));
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
      script_number: data.script_number || 1,
      status: data.status || 'Pending',
      waiting_date: now,
      created_at: now,
    };

    if (isCloudActive) {
      try {
        const { data: cloudV, error } = await supabase
          .from('batchflow_videos')
          .insert([newVideo])
          .select()
          .single();
        if (!error && cloudV) {
          setBatchflowVideos(prev => [...prev, cloudV as BatchflowVideo]);
          return cloudV as BatchflowVideo;
        }
      } catch (err) {
        console.warn('Could not insert batchflow_videos:', err);
      }
    }

    const all = storage.getBatchflowVideos();
    storage.setBatchflowVideos([...all, newVideo]);
    setBatchflowVideos(prev => [...prev, newVideo]);
    return newVideo;
  }, [assertCanEdit, activeWorkspace, user, isCloudActive]);

  const updateBatchflowVideo = useCallback(async (id: string, data: Partial<BatchflowVideo>) => {
    assertCanEdit();
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_videos').update(data).eq('id', id);
      } catch (err) {
        console.warn('Could not update batchflow_videos:', err);
      }
    }
    const all = storage.getBatchflowVideos();
    storage.setBatchflowVideos(all.map(v => v.id === id ? { ...v, ...data } : v));
    setBatchflowVideos(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
  }, [assertCanEdit, isCloudActive]);

  const updateBatchflowVideoStatus = useCallback(async (id: string, status: BatchflowVideoStatus) => {
    assertCanEdit();
    const now = new Date().toISOString();
    const updates: Partial<BatchflowVideo> = { status };
    if (status === 'Pending') updates.waiting_date = now;
    if (status === 'Edited') updates.edited_date = now;
    if (status === 'Posted') updates.posted_date = now;

    if (isCloudActive) {
      try {
        await supabase.from('batchflow_videos').update(updates).eq('id', id);
      } catch (err) {
        console.warn('Could not update status in batchflow_videos:', err);
      }
    }
    const all = storage.getBatchflowVideos();
    storage.setBatchflowVideos(all.map(v => v.id === id ? { ...v, ...updates } : v));
    setBatchflowVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  }, [assertCanEdit, isCloudActive]);

  const deleteBatchflowVideo = useCallback(async (id: string) => {
    assertCanEdit();
    if (isCloudActive) {
      try {
        await supabase.from('batchflow_videos').delete().eq('id', id);
      } catch (err) {
        console.warn('Could not delete batchflow_videos:', err);
      }
    }
    const all = storage.getBatchflowVideos();
    storage.setBatchflowVideos(all.filter(v => v.id !== id));
    setBatchflowVideos(prev => prev.filter(v => v.id !== id));
  }, [assertCanEdit, isCloudActive]);

  // Unified Backup Data Import
  const importBackupData = useCallback(async (data: any): Promise<{ success: boolean; message: string }> => {
    if (!activeWorkspace) return { success: false, message: 'No active workspace selected' };
    const wsId = activeWorkspace.id;
    const now = new Date().toISOString();
    let importedCount = 0;

    // 1. Check for Freelance Tracker backup structure
    if (data.tasks || data.clients || data.payments || data.discounts || data.salaryRates) {
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
    if (data.batches || data.videos) {
      const clientMap = new Map<string, string>();
      if (Array.isArray(data.clients) && data.clients.length) {
        const mappedBfClients: BatchflowClient[] = data.clients.map((c: any) => {
          const newId = generateId();
          clientMap.set(c.id, newId);
          return {
            id: newId,
            workspace_id: wsId,
            user_id: user?.id,
            name: c.name,
            color: c.color || '#818CF8',
            instagram_id: c.instagram_id || c.instagramId,
            archived: c.archived || 0,
            created_at: c.created_at || now,
          };
        });
        setBatchflowClients(prev => [...prev, ...mappedBfClients]);
        const allBfC = storage.getBatchflowClients();
        storage.setBatchflowClients([...allBfC, ...mappedBfClients]);
        if (isCloudActive) {
          try { await supabase.from('batchflow_clients').insert(mappedBfClients); } catch {}
        }
        importedCount += mappedBfClients.length;
      }

      const batchMap = new Map<string, string>();
      if (Array.isArray(data.batches) && data.batches.length) {
        const mappedBatches: BatchflowBatch[] = data.batches.map((b: any) => {
          const newId = generateId();
          batchMap.set(b.id, newId);
          return {
            id: newId,
            workspace_id: wsId,
            user_id: user?.id,
            client_id: clientMap.get(b.client_id) || b.client_id,
            name: b.name,
            shoot_date: b.shoot_date || b.shootDate || '',
            script: b.script || '',
            archived: b.archived || 0,
            created_at: b.created_at || now,
          };
        });
        setBatchflowBatches(prev => [...prev, ...mappedBatches]);
        const allBfB = storage.getBatchflowBatches();
        storage.setBatchflowBatches([...allBfB, ...mappedBatches]);
        if (isCloudActive) {
          try { await supabase.from('batchflow_batches').insert(mappedBatches); } catch {}
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
          script_number: v.script_number || v.scriptNumber || 1,
          status: v.status || 'Pending',
          waiting_date: v.waiting_date,
          edited_date: v.edited_date,
          posted_date: v.posted_date,
          created_at: v.created_at || now,
        }));
        setBatchflowVideos(prev => [...prev, ...mappedVideos]);
        const allBfV = storage.getBatchflowVideos();
        storage.setBatchflowVideos([...allBfV, ...mappedVideos]);
        if (isCloudActive) {
          try { await supabase.from('batchflow_videos').insert(mappedVideos); } catch {}
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
