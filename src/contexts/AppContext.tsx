import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage, generateId, defaultSettings } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useNetworkStatus } from '../lib/useNetworkStatus';
import type {
  Workspace, Client, Task, Payment, AppSettings, ViewName, SalaryRate, Discount,
  WorkspaceRole, WorkspaceMember, WorkspaceInvite,
} from '../types';

interface AppContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  clients: Client[];
  tasks: Task[];
  payments: Payment[];
  salaryRates: SalaryRate[];
  discounts: Discount[];
  settings: AppSettings;
  loading: boolean;
  currentView: ViewName;
  isOnline: boolean;
  currentRole: WorkspaceRole;
  canEdit: boolean;
  workspaceMembers: WorkspaceMember[];
  pendingInvites: WorkspaceInvite[];
  setCurrentView: (v: ViewName) => void;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name: string, color: string) => Promise<void>;
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
  updateSettings: (data: Partial<AppSettings>) => Promise<void>;
  inviteCollaborator: (workspaceId: string, email: string, role: 'manager' | 'viewer') => Promise<{ error?: any }>;
  removeCollaborator: (workspaceId: string, userId: string) => Promise<{ error?: any }>;
  respondToInvite: (inviteId: string, accept: boolean) => Promise<{ error?: any }>;
  refetch: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isOnline = useNetworkStatus();
  const isCloudActive = isSupabaseConfigured() && Boolean(user);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salaryRates, setSalaryRates] = useState<SalaryRate[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvite[]>([]);
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

      // Initial auto-migration: if user logged in and cloud is empty, migrate local data
      if (activeWsList.length === 0) {
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

      const targetId = wsId ?? settings.active_workspace_id ?? activeWsList[0]?.id ?? null;
      const active = activeWsList.find(w => w.id === targetId) ?? activeWsList[0] ?? null;
      setActiveWorkspace(active);

      if (active) {
        // Fetch workspace members
        const { data: members } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', active.id);
        setWorkspaceMembers((members as WorkspaceMember[]) || []);

        // Fetch workspace data in parallel
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
      } else {
        setClients([]);
        setTasks([]);
        setPayments([]);
        setSalaryRates([]);
        setDiscounts([]);
        setWorkspaceMembers([]);
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
  const createWorkspace = useCallback(async (name: string, color: string) => {
    if (!isOnline) {
      alert('Cannot create workspace while offline.');
      return;
    }
    const now = new Date().toISOString();
    const newWs: Workspace = {
      id: generateId(),
      user_id: user?.id,
      name,
      color,
      created_at: now,
      updated_at: now,
    };

    if (isCloudActive) {
      const { data, error } = await supabase.from('workspaces').insert([newWs]).select().single();
      if (!error && data) {
        await switchWorkspace(data.id);
        return;
      }
    }

    const all = storage.getWorkspaces();
    const updated = [...all, newWs];
    storage.setWorkspaces(updated);
    setWorkspaces(updated);
    await switchWorkspace(newWs.id);
  }, [isOnline, isCloudActive, user, switchWorkspace]);

  // Update Workspace
  const updateWorkspace = useCallback(async (id: string, data: Partial<Workspace>) => {
    assertCanEdit();
    const now = new Date().toISOString();
    if (isCloudActive) {
      await supabase.from('workspaces').update({ ...data, updated_at: now }).eq('id', id);
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
      await supabase.from('settings').upsert({
        user_id: user.id,
        currency: updated.currency,
        theme_color: updated.theme_color,
        show_completed: updated.show_completed,
        active_workspace_id: updated.active_workspace_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }
  }, [isCloudActive, isOnline, user]);

  // Collaboration: Invite collaborator
  const inviteCollaborator = useCallback(async (
    workspaceId: string,
    email: string,
    role: 'manager' | 'viewer'
  ) => {
    if (!isOnline) return { error: new Error('Cannot invite collaborators while offline') };
    if (!user || !activeWorkspace) return { error: new Error('User not logged in') };

    const { error } = await supabase.from('workspace_invites').insert([{
      workspace_id: workspaceId,
      workspace_name: activeWorkspace.name,
      invited_by_user_id: user.id,
      invited_by_email: user.email || 'Workspace Owner',
      invitee_email: email.toLowerCase().trim(),
      role,
      status: 'pending',
    }]).select().single();

    return { error };
  }, [isOnline, user, activeWorkspace]);

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
        updateSettings,
        inviteCollaborator,
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
