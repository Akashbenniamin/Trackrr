export type WorkspaceRole = 'owner' | 'manager' | 'viewer';

export type WorkspaceType = 'freelance' | 'batchflow';

export interface Workspace {
  id: string;
  user_id?: string;
  name: string;
  color: string;
  type?: WorkspaceType;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  user_email: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  invited_by_user_id: string;
  invited_by_email: string;
  invitee_email: string;
  role: 'manager' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  color: string;
  payment_type: 'per_video' | 'monthly';
  monthly_salary: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  client_id: string | null;
  title: string;
  description: string;
  status?: 'Completed' | string;
  videos: number;
  price: number;
  pricing_type: 'total' | 'per_video';
  received_date: string;
  completed_date: string | null;
  deadline: string | null;
  tags: string[];
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface SalaryRate {
  id: string;
  client_id: string;
  workspace_id: string;
  amount: number;
  effective_from: string;
  created_at: string;
}

export interface Discount {
  id: string;
  client_id: string;
  workspace_id: string;
  amount: number;
  note: string;
  date: string;
  payment_for_months: string[];
  created_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  workspace_id: string;
  amount: number;
  method: string;
  note: string;
  date: string;
  payment_for_months: string[];
  created_at: string;
}

// BatchFlow Types
export interface BatchflowClient {
  id: string;
  workspace_id: string;
  user_id?: string;
  name: string;
  color: string;
  instagram_id?: string;
  archived: number;
  created_at: string;
}

export interface BatchflowBatch {
  id: string;
  workspace_id: string;
  user_id?: string;
  client_id: string;
  name: string;
  shoot_date: string;
  script?: string;
  archived: number;
  created_at: string;
}

export type BatchflowVideoStatus = 'Pending' | 'Edited' | 'Posted';

export interface BatchflowVideo {
  id: string;
  workspace_id: string;
  user_id?: string;
  batch_id: string;
  name: string;
  script_number: number;
  description?: string | null;
  status: BatchflowVideoStatus;
  waiting_date?: string | null;
  edited_date?: string | null;
  posted_date?: string | null;
  video_url?: string | null;
  views?: string | number | null;
  likes?: string | number | null;
  created_at: string;
}

export type ThemeStyle = 'default' | 'soft' | 'dark' | 'smooth' | 'light' | 'warm-light' | 'cool-light';

export interface AppSettings {
  id: number;
  active_workspace_id: string | null;
  currency: 'INR' | 'USD';
  theme_color: string;
  theme_style?: ThemeStyle;
  show_completed: boolean;
  meta_app_id?: string;
  meta_client_token?: string;
  meta_user_token?: string;
  meta_ig_user_id?: string;
}

export type ViewName =
  | 'dashboard'
  | 'tasks'
  | 'analytics'
  | 'clients'
  | 'bills'
  | 'settings'
  | 'batches'
  | 'search'
  | 'archive';

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card', 'PayPal', 'Other'] as const;

export const CLIENT_COLORS = [
  '#818CF8', '#34D399', '#F59E0B', '#F87171',
  '#A78BFA', '#60A5FA', '#FB7185', '#4ADE80',
  '#06B6D4', '#EC4899', '#F97316', '#84CC16',
];

export interface ClientGradient {
  name: string;
  value: string;
  primary: string;
}

export const CLIENT_GRADIENTS: ClientGradient[] = [
  { name: 'Sunset Glow', value: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)', primary: '#FF6B6B' },
  { name: 'Neon Violet', value: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)', primary: '#8B5CF6' },
  { name: 'Ocean Breeze', value: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)', primary: '#06B6D4' },
  { name: 'Cyber Emerald', value: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)', primary: '#10B981' },
  { name: 'Royal Indigo', value: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)', primary: '#6366F1' },
  { name: 'Cosmic Fire', value: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)', primary: '#F97316' },
  { name: 'Northern Lights', value: 'linear-gradient(135deg, #34D399 0%, #60A5FA 100%)', primary: '#34D399' },
  { name: 'Deep Amethyst', value: 'linear-gradient(135deg, #7C3AED 0%, #C084FC 100%)', primary: '#7C3AED' },
];

export function isGradient(color?: string | null): boolean {
  return typeof color === 'string' && color.includes('gradient');
}

export function getClientPrimaryColor(color?: string | null): string {
  if (!color) return '#818CF8';
  if (!color.includes('gradient')) {
    const match = color.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    return match ? match[0] : (color.startsWith('#') ? color : '#818CF8');
  }
  const foundGrad = CLIENT_GRADIENTS.find(g => g.value === color);
  if (foundGrad) return foundGrad.primary;
  const match = color.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
  return match ? match[0] : '#818CF8';
}


export function calcTaskRevenue(task: Task, client?: Client | null): number {
  if (client?.payment_type === 'monthly') return 0;
  return task.pricing_type === 'per_video'
    ? (task.videos ?? 0) * (task.price ?? 0)
    : (task.price ?? 0);
}

/**
 * Per-task revenue for monthly clients: splits the monthly salary evenly
 * across all videos completed in that task's month. Falls back to 0 for
 * per-video clients (use calcTaskRevenue for those).
 *
 * For monthly clients with at least 1 completed task in a month, each task's
 * per-video share = salaryForMonth / totalVideosInMonth.
 */
export function calcTaskRevenueFull(
  task: Task,
  client: Client | undefined | null,
  rates: SalaryRate[],
  allTasks: Task[],
): number {
  if (!client || client.payment_type !== 'monthly') return calcTaskRevenue(task, client);
  const taskDate = task.completed_date ?? task.received_date;
  if (!taskDate) return 0;

  const monthStr = taskDate.slice(0, 7);
  const [yr, mo] = monthStr.split('-').map(Number);
  const salary = getSalaryForMonth(rates, client.id, new Date(yr, mo - 1, 1), client);
  if (salary <= 0) return 0;

  const totalVideosInMonth = allTasks
    .filter(t => t.client_id === client.id && (t.completed_date ?? t.received_date)?.slice(0, 7) === monthStr)
    .reduce((s, t) => s + (t.videos ?? 0), 0);

  if (totalVideosInMonth === 0) return 0;
  const perVideo = salary / totalVideosInMonth;
  return perVideo * (task.videos ?? 0);
}

export function getSalaryForMonth(
  rates: SalaryRate[],
  clientId: string,
  monthDate: Date,
  client?: Client | null,
): number {
  const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

  // 1. Check if an exact rate is set for this specific month
  const exact = rates.find(r => r.client_id === clientId && r.effective_from.slice(0, 7) === monthStr);
  if (exact) return exact.amount;

  // 2. Otherwise look for latest rate effective on or before this month
  const clientRates = rates
    .filter(r => r.client_id === clientId)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  let salary = 0;
  for (const r of clientRates) {
    if (r.effective_from.slice(0, 7) <= monthStr) salary = r.amount;
  }

  // 3. Fallback to client.monthly_salary if rates are empty or zero
  if (salary <= 0 && client && (client.monthly_salary ?? 0) > 0) {
    salary = client.monthly_salary;
  }

  return salary;
}

export function calcMonthlyRevenue(
  clientId: string,
  rates: SalaryRate[],
  completedDates: string[],
  client?: Client | null,
): number {
  const months = new Set(completedDates.map(d => d.slice(0, 7)));
  let total = 0;
  months.forEach(m => {
    const [yr, mo] = m.split('-').map(Number);
    total += getSalaryForMonth(rates, clientId, new Date(yr, mo - 1, 1), client);
  });
  return total;
}

export function calcClientPaid(payments: Payment[], clientId: string): number {
  return payments
    .filter(p => p.client_id === clientId)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
}

export function formatCurrency(amount: number, currency: 'USD' | 'INR'): string {
  return currency === 'INR' ? `₹${amount.toFixed(0)}` : `$${amount.toFixed(0)}`;
}

export function formatDate(ts: string | null | undefined): string {
  if (!ts) return 'N/A';
  // Parse YYYY-MM-DD explicitly to prevent UTC midnight rollover
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) {
    const [y, m, d] = ts.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Extracts a local YYYY-MM-DD string suitable for HTML <input type="date">
 * without UTC shifts.
 */
export function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface MonthlyRetainerScheduleItem {
  monthIndex: number;
  monthStr: string;   // 'YYYY-MM'
  label: string;      // 'Month 1 (Jul 2026)'
  monthName: string;  // 'Jul 2026'
  amount: number;
  rateId?: string;
  isExistingRate: boolean;
}

/**
 * Generates month-by-month retainer schedule for a client starting with Month 1
 * defined as the client's oldest task month (or creation month if no tasks yet).
 */
export function getClientMonthlyRetainerSchedule(
  client: Client,
  tasks: Task[],
  salaryRates: SalaryRate[],
  extraMonths: number = 0,
): MonthlyRetainerScheduleItem[] {
  // 1. Oldest task month is Month 1
  const clientTasks = tasks.filter(t => t.client_id === client.id);
  const taskDates = clientTasks
    .map(t => t.completed_date ?? t.received_date)
    .filter(Boolean) as string[];

  let startMonthStr: string;
  if (taskDates.length > 0) {
    const sorted = [...taskDates].sort();
    startMonthStr = sorted[0].slice(0, 7);
  } else if (client.created_at) {
    startMonthStr = client.created_at.slice(0, 7);
  } else {
    startMonthStr = new Date().toISOString().slice(0, 7);
  }

  // End month: latest task month or current month, whichever is later
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let endMonthStr = currentMonthStr;
  if (taskDates.length > 0) {
    const sorted = [...taskDates].sort();
    const latestTaskMonth = sorted[sorted.length - 1].slice(0, 7);
    if (latestTaskMonth > endMonthStr) {
      endMonthStr = latestTaskMonth;
    }
  }

  // Also include any months that already have a SalaryRate
  const clientRates = salaryRates.filter(r => r.client_id === client.id);
  for (const r of clientRates) {
    const rMonth = r.effective_from.slice(0, 7);
    if (rMonth > endMonthStr) {
      endMonthStr = rMonth;
    }
  }

  const items: MonthlyRetainerScheduleItem[] = [];
  const [startY, startM] = startMonthStr.split('-').map(Number);
  const [endY, endM] = endMonthStr.split('-').map(Number);

  let curDate = new Date(startY, startM - 1, 1);
  const targetEndDate = new Date(endY, endM - 1 + Math.max(0, extraMonths), 1);

  let idx = 1;
  while (curDate <= targetEndDate) {
    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, '0');
    const ym = `${y}-${m}`;
    const monthName = curDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Exact matching rate row
    const exact = clientRates.find(r => r.effective_from.slice(0, 7) === ym);
    const effectiveSalary = getSalaryForMonth(salaryRates, client.id, curDate, client);

    items.push({
      monthIndex: idx,
      monthStr: ym,
      label: `Month ${idx} (${monthName})`,
      monthName,
      amount: exact ? exact.amount : effectiveSalary,
      rateId: exact?.id,
      isExistingRate: Boolean(exact),
    });

    idx++;
    curDate = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 1);
  }

  return items;
}

