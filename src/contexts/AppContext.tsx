import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { storage, generateId } from '../lib/storage';
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

  // Load from local storage cache first
  const loadLocalCache = useCallback((wsId?: string) => {
    const wsList = storage.getWorkspaces();
    const appSettings = storage.getSettings();
    setWorkspaces(wsList);
    setSettings(appSettings);

    const targetId = wsId ?? storage.getActiveWorkspaceId() ?? appSettings.active_workspace_id ?? wsList[0]?.id ?? null;
    const active = wsList.find(w => w.id === targetId) ?? wsList[0] ?? null;
    setActiveWorkspace(active);
    if (active) {
      storage.setActiveWorkspaceId(active.id);
    }

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
        const explicitType = storage.getWorkspaceType(w.id);
        const isNamedBatchflow = Boolean(
          w.name?.toLowerCase().includes('batchflow') ||
          w.name?.toLowerCase().includes('batch flow')
        );
        const hasBfData = storage.getBatchflowBatches().some(b => b.workspace_id === w.id) ||
                          storage.getBatchflowVideos().some(v => v.workspace_id === w.id);

        const resolvedType: WorkspaceType =
          explicitType
          || (w.type === 'batchflow' ? 'batchflow' : undefined)
          || (local?.type === 'batchflow' ? 'batchflow' : undefined)
          || (isNamedBatchflow ? 'batchflow' : undefined)
          || (hasBfData ? 'batchflow' : undefined)
          || w.type
          || local?.type
          || 'freelance';

        storage.setWorkspaceType(w.id, resolvedType);

        return {
          ...w,
          type: resolvedType,
        };
      });

      // Keep any locally created workspace not yet present in the cloud
      for (const loc of localWorkspaces) {
        if (!cloudIds.has(loc.id)) {
          const explicitType = storage.getWorkspaceType(loc.id);
          const resolvedType = explicitType || loc.type || 'freelance';
          storage.setWorkspaceType(loc.id, resolvedType);
          activeWsList.push({ ...loc, type: resolvedType });
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

      const targetId = wsId ?? storage.getActiveWorkspaceId() ?? settings.active_workspace_id ?? activeWsList[0]?.id ?? null;
      const active = activeWsList.find(w => w.id === targetId) ?? activeWsList[0] ?? null;
      setActiveWorkspace(active);
      if (active) {
        storage.setActiveWorkspaceId(active.id);
      }

      // Sync cloud settings including Meta API tokens
      try {
        if (user?.id) {
          const { data: cloudSettings } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          if (cloudSettings) {
            const currSettings = storage.getSettings();
            const mergedSettings: AppSettings = {
              ...currSettings,
              currency: cloudSettings.currency || currSettings.currency,
              theme_color: cloudSettings.theme_color || currSettings.theme_color,
              theme_style: cloudSettings.theme_style || currSettings.theme_style,
              show_completed: cloudSettings.show_completed !== undefined ? cloudSettings.show_completed : currSettings.show_completed,
              active_workspace_id: cloudSettings.active_workspace_id || currSettings.active_workspace_id,
              meta_app_id: cloudSettings.meta_app_id || currSettings.meta_app_id,
              meta_client_token: cloudSettings.meta_client_token || currSettings.meta_client_token,
              meta_user_token: cloudSettings.meta_user_token || currSettings.meta_user_token,
              meta_ig_user_id: cloudSettings.meta_ig_user_id || currSettings.meta_ig_user_id,
            };
            storage.setSettings(mergedSettings);
            setSettings(mergedSettings);
            if (mergedSettings.meta_app_id && mergedSettings.meta_client_token) {
              localStorage.setItem('trackrr_meta_access_token', `${mergedSettings.meta_app_id.trim()}|${mergedSettings.meta_client_token.trim()}`);
            }
            if (mergedSettings.meta_user_token) {
              localStorage.setItem('trackrr_meta_user_token', mergedSettings.meta_user_token.trim());
            }
            if (mergedSettings.meta_ig_user_id) {
              localStorage.setItem('trackrr_meta_ig_user_id', mergedSettings.meta_ig_user_id.trim());
            }
          }
        }
      } catch (err) {
        console.warn('Could not sync cloud settings on startup:', err);
      }

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

            const hasTableError = Boolean(bfCRes.error || bfBRes.error || bfVRes.error);
            if (hasTableError) {
              // Tables do not exist in cloud yet or network error - DO NOT overwrite with empty array!
              // Fall back to offline localStorage cache
              const bfC = storage.getBatchflowClients().filter(c => c.workspace_id === active.id);
              const bfB = storage.getBatchflowBatches().filter(b => b.workspace_id === active.id);
              const bfV = storage.getBatchflowVideos().filter(v => v.workspace_id === active.id);
              setBatchflowClients(bfC);
              setBatchflowBatches(bfB);
              setBatchflowVideos(bfV);
            } else {
              const bfC = (bfCRes.data as BatchflowClient[]) || [];
              const bfB = (bfBRes.data as BatchflowBatch[]) || [];
              const bfV = (bfVRes.data as BatchflowVideo[]) || [];

              // Merge local items that are not in cloud yet
              const localC = storage.getBatchflowClients().filter(c => c.workspace_id === active.id);
              const localB = storage.getBatchflowBatches().filter(b => b.workspace_id === active.id);
              const localV = storage.getBatchflowVideos().filter(v => v.workspace_id === active.id);

              const cloudCIds = new Set(bfC.map(c => c.id));
              const cloudBIds = new Set(bfB.map(b => b.id));
              const cloudVIds = new Set(bfV.map(v => v.id));

              // Deep merge items to preserve local attributes (video_url, views, description)
              // if cloud returned rows without those columns or if schema has not migrated yet
              const mergedC = [
                ...bfC.map(cc => {
                  const lc = localC.find(l => l.id === cc.id);
                  if (!lc) return cc;
                  return {
                    ...lc,
                    ...cc,
                    name: lc.name || cc.name,
                    color: lc.color || cc.color || '#818CF8',
                    instagram_id: (lc.instagram_id !== undefined && lc.instagram_id !== null && lc.instagram_id !== '')
                      ? lc.instagram_id
                      : (cc.instagram_id || ''),
                  };
                }),
                ...localC.filter(c => !cloudCIds.has(c.id)),
              ];

              const mergedB = [
                ...bfB.map(cb => {
                  const lb = localB.find(l => l.id === cb.id);
                  if (!lb) return cb;
                  return {
                    ...lb,
                    ...cb,
                    name: lb.name || cb.name,
                    script: (lb.script !== undefined && lb.script !== null && lb.script !== '')
                      ? lb.script
                      : (cb.script || ''),
                  };
                }),
                ...localB.filter(b => !cloudBIds.has(b.id)),
              ];

              const mergedV = [
                ...bfV.map(cv => {
                  const lv = localV.find(l => l.id === cv.id);
                  if (!lv) return cv;
                  return {
                    ...lv,
                    ...cv,
                    name: lv.name || cv.name || 'New Video',
                    script_number: (lv.script_number !== undefined && lv.script_number !== null)
                      ? lv.script_number
                      : ((cv.script_number !== undefined && cv.script_number !== null) ? cv.script_number : 1),
                    video_url: (lv.video_url !== undefined && lv.video_url !== null && lv.video_url !== '')
                      ? lv.video_url
                      : (cv.video_url || null),
                    views: (lv.views !== undefined && lv.views !== null && String(lv.views).trim() !== '')
                      ? lv.views
                      : (cv.views || null),
                    likes: (lv.likes !== undefined && lv.likes !== null && String(lv.likes).trim() !== '')
                      ? lv.likes
                      : (cv.likes || null),
                    description: (lv.description !== undefined && lv.description !== null && lv.description !== '')
                      ? lv.description
                      : (cv.description || null),
                    posted_date: cv.posted_date || lv.posted_date || null,
                    edited_date: cv.edited_date || lv.edited_date || null,
                    waiting_date: cv.waiting_date || lv.waiting_date || null,
                  };
                }),
                ...localV.filter(v => !cloudVIds.has(v.id)),
              ];

              setBatchflowClients(mergedC);
              setBatchflowBatches(mergedB);
              setBatchflowVideos(mergedV);

              // Update storage keeping other workspaces' data intact
              const otherC = storage.getBatchflowClients().filter(c => c.workspace_id !== active.id);
              const otherB = storage.getBatchflowBatches().filter(b => b.workspace_id !== active.id);
              const otherV = storage.getBatchflowVideos().filter(v => v.workspace_id !== active.id);

              storage.setBatchflowClients([...otherC, ...mergedC]);
              storage.setBatchflowBatches([...otherB, ...mergedB]);
              storage.setBatchflowVideos([...otherV, ...mergedV]);

              // If any video in cloud was out of sync (e.g. script_number mismatch due to prior schema errors), sync back to cloud in background
              const outOfSyncVideos = mergedV.filter(v => {
                const cv = bfV.find(c => c.id === v.id);
                return cv && v.script_number !== cv.script_number;
              });
              if (outOfSyncVideos.length > 0) {
                (async () => {
                  for (const ov of outOfSyncVideos) {
                    try {
                      await supabase.from('batchflow_videos').update({ script_number: ov.script_number }).eq('id', ov.id);
                    } catch {
                      // ignore background sync errors
                    }
                  }
                })();
              }
            }
          } catch (err) {
            console.warn('BatchFlow sync failed, loading from local cache:', err);
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

          const hasTableError = Boolean(cRes.error || tRes.error || pRes.error || rRes.error || dRes.error);
          if (hasTableError) {
            console.warn('Freelance sync had table/network errors, falling back to local cache');
            const localC = storage.getClients().filter(c => c.workspace_id === active.id);
            const localT = storage.getTasks().filter(t => t.workspace_id === active.id);
            const localP = storage.getPayments().filter(p => p.workspace_id === active.id);
            const localR = storage.getSalaryRates().filter(r => r.workspace_id === active.id);
            const localD = storage.getDiscounts().filter(d => d.workspace_id === active.id);
            setClients(localC);
            setTasks(localT);
            setPayments(localP);
            setSalaryRates(localR);
            setDiscounts(localD);
          } else {
            const cl = (cRes.data as Client[]) || [];
            const tk = (tRes.data as Task[]) || [];
            const pm = (pRes.data as Payment[]) || [];
            const sr = (rRes.data as SalaryRate[]) || [];
            const ds = (dRes.data as Discount[]) || [];

            // Merge local items not in cloud yet
            const localC = storage.getClients().filter(c => c.workspace_id === active.id);
            const localT = storage.getTasks().filter(t => t.workspace_id === active.id);
            const localP = storage.getPayments().filter(p => p.workspace_id === active.id);
            const localR = storage.getSalaryRates().filter(r => r.workspace_id === active.id);
            const localD = storage.getDiscounts().filter(d => d.workspace_id === active.id);

            const cloudCIds = new Set(cl.map(c => c.id));
            const cloudTIds = new Set(tk.map(t => t.id));
            const cloudPIds = new Set(pm.map(p => p.id));
            const cloudRIds = new Set(sr.map(r => r.id));
            const cloudDIds = new Set(ds.map(d => d.id));

            const mergedC = [...cl, ...localC.filter(c => !cloudCIds.has(c.id))];
            const mergedT = [...tk, ...localT.filter(t => !cloudTIds.has(t.id))];
            const mergedP = [...pm, ...localP.filter(p => !cloudPIds.has(p.id))];
            const mergedR = [...sr, ...localR.filter(r => !cloudRIds.has(r.id))];
            const mergedD = [...ds, ...localD.filter(d => !cloudDIds.has(d.id))];

            setClients(mergedC);
            setTasks(mergedT);
            setPayments(mergedP);
            setSalaryRates(mergedR);
            setDiscounts(mergedD);

            // Update storage keeping other workspaces' data intact
            const otherC = storage.getClients().filter(c => c.workspace_id !== active.id);
            const otherT = storage.getTasks().filter(t => t.workspace_id !== active.id);
            const otherP = storage.getPayments().filter(p => p.workspace_id !== active.id);
            const otherR = storage.getSalaryRates().filter(r => r.workspace_id !== active.id);
            const otherD = storage.getDiscounts().filter(d => d.workspace_id !== active.id);

            storage.setClients([...otherC, ...mergedC]);
            storage.setTasks([...otherT, ...mergedT]);
            storage.setPayments([...otherP, ...mergedP]);
            storage.setSalaryRates([...otherR, ...mergedR]);
            storage.setDiscounts([...otherD, ...mergedD]);
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
      loadLocalCache(wsId);
    }
  }, [isCloudActive, isOnline, user, settings.active_workspace_id, loadLocalCache]);

  const hasInitializedRef = useRef(false);

  // Initial load on mount or user/auth change
  useEffect(() => {
    (async () => {
      if (!hasInitializedRef.current) {
        setLoading(true);
      }
      try {
        storage.initStorage();
        loadLocalCache();
        await fetchAll();
      } finally {
        hasInitializedRef.current = true;
        setLoading(false);
      }
    })();
  }, [user?.id, fetchAll, loadLocalCache]);

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

    if (isCloudActive && isOnline && user) {
      try {
        const payload: any = {
          user_id: user.id,
          currency: updated.currency,
          theme_color: updated.theme_color,
          theme_style: updated.theme_style,
          show_completed: updated.show_completed,
          active_workspace_id: updated.active_workspace_id,
          meta_app_id: updated.meta_app_id || null,
          meta_client_token: updated.meta_client_token || null,
          meta_user_token: updated.meta_user_token || null,
          meta_ig_user_id: updated.meta_ig_user_id || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
        if (error) {
          // If theme_style or other column does not exist in legacy cloud table, retry without it
          if (isSchemaColumnError(error)) {
            const { theme_style: _ts, meta_app_id: _ma, meta_client_token: _mc, meta_user_token: _mu, meta_ig_user_id: _mi, ...payloadBase } = payload;
            await supabase.from('settings').upsert(payloadBase, { onConflict: 'user_id' });
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
          const syncedC = cloudC as BatchflowClient;
          setBatchflowClients(prev => [...prev, syncedC]);
          const all = storage.getBatchflowClients();
          storage.setBatchflowClients([...all.filter(c => c.id !== syncedC.id), syncedC]);
          return syncedC;
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
          const { error: vErr } = await supabase.from('batchflow_videos').insert(generatedVideos);
          if (vErr && isSchemaColumnError(vErr)) {
            const baseGenerated = generatedVideos.map(({ video_url, views, description, ...rest }: any) => rest);
            await supabase.from('batchflow_videos').insert(baseGenerated);
          }
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
      script_number: data.script_number !== undefined ? data.script_number : 1,
      description: data.description !== undefined ? data.description : null,
      status: data.status || 'Pending',
      video_url: data.video_url !== undefined ? data.video_url : null,
      views: data.views !== undefined ? data.views : null,
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
          const completeVideo: BatchflowVideo = {
            ...newVideo,
            ...(cloudV as BatchflowVideo),
            video_url: (cloudV as any).video_url ?? newVideo.video_url,
            views: (cloudV as any).views ?? newVideo.views,
            description: (cloudV as any).description ?? newVideo.description,
          };
          const all = storage.getBatchflowVideos();
          storage.setBatchflowVideos([...all, completeVideo]);
          setBatchflowVideos(prev => [...prev, completeVideo]);
          return completeVideo;
        } else if (error && isSchemaColumnError(error)) {
          // Schema column missing in remote DB, retry insert with base columns
          const { video_url, views, likes, description, ...baseVideo } = newVideo;
          const { data: cloudVBase } = await supabase
            .from('batchflow_videos')
            .insert([baseVideo])
            .select()
            .single();
          const savedVideo: BatchflowVideo = {
            ...newVideo,
            ...((cloudVBase as any) || {}),
            video_url: newVideo.video_url,
            views: newVideo.views,
            likes: newVideo.likes,
            description: newVideo.description,
          };
          const all = storage.getBatchflowVideos();
          storage.setBatchflowVideos([...all, savedVideo]);
          setBatchflowVideos(prev => [...prev, savedVideo]);
          return savedVideo;
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
        const { error } = await supabase.from('batchflow_videos').update(data).eq('id', id);
        if (error) {
          console.warn('Could not update batchflow_videos with full fields, retrying with base fields:', error);
          if (isSchemaColumnError(error)) {
            const { video_url, views, likes, description, ...baseData } = data;
            if (Object.keys(baseData).length > 0) {
              const { error: retryErr } = await supabase.from('batchflow_videos').update(baseData).eq('id', id);
              if (retryErr) {
                console.warn('Could not update batchflow_videos with base fields:', retryErr);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not update batchflow_videos:', err);
      }
    }
    const all = storage.getBatchflowVideos();
    storage.setBatchflowVideos(all.map(v => v.id === id ? { ...v, ...data } : v));
    setBatchflowVideos(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
  }, [assertCanEdit, isCloudActive]);

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
    const updates: Partial<BatchflowVideo> = { status };
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

    if (isCloudActive) {
      try {
        const { error } = await supabase.from('batchflow_videos').update(updates).eq('id', id);
        if (error) {
          console.warn('Could not update status in batchflow_videos with full fields, retrying with base fields:', error);
          if (isSchemaColumnError(error)) {
            const { video_url, views, likes, description, ...baseUpdates } = updates;
            if (Object.keys(baseUpdates).length > 0) {
              const { error: retryErr } = await supabase.from('batchflow_videos').update(baseUpdates).eq('id', id);
              if (retryErr) {
                console.warn('Could not update status with base fields:', retryErr);
              }
            }
          }
        }
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
          try { await supabase.from('batchflow_clients').insert(mappedBfClients); } catch {}
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
          script_number: v.script_number ?? v.scriptNumber ?? 1,
          description: v.description || null,
          video_url: v.video_url || null,
          views: v.views || null,
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
          try {
            const { error } = await supabase.from('batchflow_videos').insert(mappedVideos);
            if (error && isSchemaColumnError(error)) {
              const baseVideos = mappedVideos.map(({ video_url, views, description, ...rest }: any) => rest);
              await supabase.from('batchflow_videos').insert(baseVideos);
            }
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
