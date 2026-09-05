import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage, generateId, defaultSettings } from '../lib/storage';
import type { Workspace, Client, Task, Payment, AppSettings, ViewName, SalaryRate, Discount } from '../types';

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
  refetch: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salaryRates, setSalaryRates] = useState<SalaryRate[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewName>('dashboard');

  const fetchAll = useCallback(async (wsId?: string) => {
    const wsList = storage.getWorkspaces();
    const appSettings = storage.getSettings();

    setWorkspaces(wsList);
    setSettings(appSettings);

    const targetId = wsId ?? appSettings.active_workspace_id ?? wsList[0]?.id ?? null;
    const active = wsList.find(w => w.id === targetId) ?? wsList[0] ?? null;
    setActiveWorkspace(active);

    if (active) {
      const allClients = storage.getClients();
      const allTasks = storage.getTasks();
      const allPayments = storage.getPayments();
      const allRates = storage.getSalaryRates();
      const allDiscounts = storage.getDiscounts();

      setClients(allClients.filter(c => c.workspace_id === active.id));
      setTasks(allTasks.filter(t => t.workspace_id === active.id).sort((a, b) => a.order_index - b.order_index));
      setPayments(allPayments.filter(p => p.workspace_id === active.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
      setSalaryRates(allRates.filter(sr => sr.workspace_id === active.id).sort((a, b) => a.effective_from.localeCompare(b.effective_from)));
      setDiscounts(allDiscounts.filter(d => d.workspace_id === active.id).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    } else {
      setClients([]);
      setTasks([]);
      setPayments([]);
      setSalaryRates([]);
      setDiscounts([]);
    }
  }, []);

  // Bootstrap initial storage on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        storage.initStorage();
        await fetchAll();
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchAll]);

  const switchWorkspace = useCallback(async (id: string) => {
    const currSettings = storage.getSettings();
    const updated = { ...currSettings, active_workspace_id: id };
    storage.setSettings(updated);
    setSettings(updated);
    await fetchAll(id);
  }, [fetchAll]);

  const createWorkspace = useCallback(async (name: string, color: string) => {
    const now = new Date().toISOString();
    const newWs: Workspace = {
      id: generateId(),
      name,
      color,
      created_at: now,
      updated_at: now,
    };
    const all = storage.getWorkspaces();
    const updated = [...all, newWs];
    storage.setWorkspaces(updated);
    setWorkspaces(updated);
    await switchWorkspace(newWs.id);
  }, [switchWorkspace]);

  const updateWorkspace = useCallback(async (id: string, data: Partial<Workspace>) => {
    const all = storage.getWorkspaces();
    const now = new Date().toISOString();
    const updated = all.map(w => w.id === id ? { ...w, ...data, updated_at: now } : w);
    storage.setWorkspaces(updated);
    setWorkspaces(updated);
    if (activeWorkspace?.id === id) {
      setActiveWorkspace(prev => (prev ? { ...prev, ...data, updated_at: now } : null));
    }
  }, [activeWorkspace]);

  const deleteWorkspace = useCallback(async (id: string) => {
    const all = storage.getWorkspaces();
    const updated = all.filter(w => w.id !== id);
    storage.setWorkspaces(updated);
    setWorkspaces(updated);

    // Also clean up items for this workspace
    storage.setClients(storage.getClients().filter(c => c.workspace_id !== id));
    storage.setTasks(storage.getTasks().filter(t => t.workspace_id !== id));
    storage.setPayments(storage.getPayments().filter(p => p.workspace_id !== id));
    storage.setSalaryRates(storage.getSalaryRates().filter(sr => sr.workspace_id !== id));
    storage.setDiscounts(storage.getDiscounts().filter(d => d.workspace_id !== id));

    if (updated.length > 0) {
      await switchWorkspace(updated[0].id);
    } else {
      await fetchAll();
    }
  }, [switchWorkspace, fetchAll]);

  const addTask = useCallback(async (data: Partial<Task>): Promise<Task | null> => {
    if (!activeWorkspace) return null;
    const now = new Date().toISOString();
    const all = storage.getTasks();
    const wsTasks = all.filter(t => t.workspace_id === activeWorkspace.id);

    const newTask: Task = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      client_id: data.client_id ?? null,
      title: data.title ?? 'Untitled',
      description: data.description ?? '',
      status: 'Completed',
      videos: data.videos ?? 1,
      price: data.price ?? 0,
      pricing_type: data.pricing_type ?? 'total',
      received_date: data.received_date ?? now,
      completed_date: data.completed_date ?? data.received_date ?? now,
      deadline: data.deadline ?? null,
      tags: data.tags ?? [],
      order_index: wsTasks.length,
      created_at: now,
      updated_at: now,
      ...data,
    };

    const updated = [newTask, ...all];
    storage.setTasks(updated);
    setTasks(prev => [newTask, ...prev]);
    return newTask;
  }, [activeWorkspace]);

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
    const all = storage.getTasks();
    const now = new Date().toISOString();
    const updated = all.map(t => (t.id === id ? { ...t, ...data, updated_at: now } : t));
    storage.setTasks(updated);
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...data, updated_at: now } : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const all = storage.getTasks();
    const updated = all.filter(t => t.id !== id);
    storage.setTasks(updated);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const addClient = useCallback(async (data: Partial<Client>): Promise<Client | null> => {
    if (!activeWorkspace) return null;
    const now = new Date().toISOString();
    const newClient: Client = {
      id: generateId(),
      workspace_id: activeWorkspace.id,
      name: data.name ?? 'New Client',
      company: data.company ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      color: data.color ?? '#818CF8',
      payment_type: data.payment_type ?? 'per_video',
      monthly_salary: data.monthly_salary ?? 0,
      notes: data.notes ?? '',
      created_at: now,
      updated_at: now,
      ...data,
    };

    const all = storage.getClients();
    const updated = [...all, newClient];
    storage.setClients(updated);
    setClients(prev => [...prev, newClient]);
    return newClient;
  }, [activeWorkspace]);

  const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
    const all = storage.getClients();
    const now = new Date().toISOString();
    const updated = all.map(c => (c.id === id ? { ...c, ...data, updated_at: now } : c));
    storage.setClients(updated);
    setClients(prev => prev.map(c => (c.id === id ? { ...c, ...data, updated_at: now } : c)));
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    const all = storage.getClients();
    const updated = all.filter(c => c.id !== id);
    storage.setClients(updated);
    setClients(prev => prev.filter(c => c.id !== id));

    // Update tasks client_id to null
    const allTasks = storage.getTasks();
    const updatedTasks = allTasks.map(t => (t.client_id === id ? { ...t, client_id: null } : t));
    storage.setTasks(updatedTasks);
    setTasks(prev => prev.map(t => (t.client_id === id ? { ...t, client_id: null } : t)));

    // Clean up associated payments and rates
    const updatedPayments = storage.getPayments().filter(p => p.client_id !== id);
    storage.setPayments(updatedPayments);
    setPayments(prev => prev.filter(p => p.client_id !== id));

    const updatedRates = storage.getSalaryRates().filter(r => r.client_id !== id);
    storage.setSalaryRates(updatedRates);
    setSalaryRates(prev => prev.filter(r => r.client_id !== id));

    const updatedDiscounts = storage.getDiscounts().filter(d => d.client_id !== id);
    storage.setDiscounts(updatedDiscounts);
    setDiscounts(prev => prev.filter(d => d.client_id !== id));
  }, []);

  const addPayment = useCallback(async (data: Partial<Payment>) => {
    if (!activeWorkspace || !data.client_id) return;
    const now = new Date().toISOString();
    const newPayment: Payment = {
      id: generateId(),
      client_id: data.client_id,
      workspace_id: activeWorkspace.id,
      amount: data.amount ?? 0,
      method: data.method ?? 'Cash',
      note: data.note ?? '',
      date: data.date ?? now,
      payment_for_months: data.payment_for_months ?? [],
      created_at: now,
      ...data,
    };

    const all = storage.getPayments();
    const updated = [newPayment, ...all];
    storage.setPayments(updated);
    setPayments(prev => [newPayment, ...prev]);
  }, [activeWorkspace]);

  const updatePayment = useCallback(async (id: string, data: Partial<Payment>) => {
    const all = storage.getPayments();
    const updated = all.map(p => (p.id === id ? { ...p, ...data } : p));
    storage.setPayments(updated);
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, ...data } : p)));
  }, []);

  const deletePayment = useCallback(async (id: string) => {
    const all = storage.getPayments();
    const updated = all.filter(p => p.id !== id);
    storage.setPayments(updated);
    setPayments(prev => prev.filter(p => p.id !== id));
  }, []);

  const addSalaryRate = useCallback(async (data: Partial<SalaryRate>) => {
    if (!activeWorkspace || !data.client_id) return;
    const now = new Date().toISOString();
    const newRate: SalaryRate = {
      id: generateId(),
      client_id: data.client_id,
      workspace_id: activeWorkspace.id,
      amount: data.amount ?? 0,
      effective_from: data.effective_from ?? now.slice(0, 10),
      created_at: now,
      ...data,
    };

    const all = storage.getSalaryRates();
    const updated = [...all, newRate].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    storage.setSalaryRates(updated);
    setSalaryRates(prev => [...prev, newRate].sort((a, b) => a.effective_from.localeCompare(b.effective_from)));
  }, [activeWorkspace]);

  const updateSalaryRate = useCallback(async (id: string, data: Partial<SalaryRate>) => {
    const all = storage.getSalaryRates();
    const updated = all.map(r => (r.id === id ? { ...r, ...data } : r)).sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    storage.setSalaryRates(updated);
    setSalaryRates(prev => prev.map(r => (r.id === id ? { ...r, ...data } : r)).sort((a, b) => a.effective_from.localeCompare(b.effective_from)));
  }, []);

  const deleteSalaryRate = useCallback(async (id: string) => {
    const all = storage.getSalaryRates();
    const updated = all.filter(r => r.id !== id);
    storage.setSalaryRates(updated);
    setSalaryRates(prev => prev.filter(r => r.id !== id));
  }, []);

  const addDiscount = useCallback(async (data: Partial<Discount>) => {
    if (!activeWorkspace || !data.client_id) return;
    const now = new Date().toISOString();
    const newDiscount: Discount = {
      id: generateId(),
      client_id: data.client_id,
      workspace_id: activeWorkspace.id,
      amount: data.amount ?? 0,
      note: data.note ?? '',
      date: data.date ?? now,
      payment_for_months: data.payment_for_months ?? [],
      created_at: now,
      ...data,
    };

    const all = storage.getDiscounts();
    const updated = [newDiscount, ...all];
    storage.setDiscounts(updated);
    setDiscounts(prev => [newDiscount, ...prev]);
  }, [activeWorkspace]);

  const updateDiscount = useCallback(async (id: string, data: Partial<Discount>) => {
    const all = storage.getDiscounts();
    const updated = all.map(d => (d.id === id ? { ...d, ...data } : d));
    storage.setDiscounts(updated);
    setDiscounts(prev => prev.map(d => (d.id === id ? { ...d, ...data } : d)));
  }, []);

  const deleteDiscount = useCallback(async (id: string) => {
    const all = storage.getDiscounts();
    const updated = all.filter(d => d.id !== id);
    storage.setDiscounts(updated);
    setDiscounts(prev => prev.filter(d => d.id !== id));
  }, []);

  const updateSettings = useCallback(async (data: Partial<AppSettings>) => {
    const current = storage.getSettings();
    const updated = { ...current, ...data };
    storage.setSettings(updated);
    setSettings(updated);
  }, []);

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
        refetch: fetchAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
