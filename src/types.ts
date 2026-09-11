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
  status: BatchflowVideoStatus;
  waiting_date?: string | null;
  edited_date?: string | null;
  posted_date?: string | null;
  video_url?: string | null;
  views?: string | number | null;
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
];

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
  const salary = getSalaryForMonth(rates, client.id, new Date(yr, mo - 1));
  if (salary <= 0) return 0;

  const totalVideosInMonth = allTasks
    .filter(t => t.client_id === client.id && (t.completed_date ?? t.received_date)?.slice(0, 7) === monthStr)
    .reduce((s, t) => s + (t.videos ?? 0), 0);

  if (totalVideosInMonth === 0) return 0;
  const perVideo = salary / totalVideosInMonth;
  return perVideo * (task.videos ?? 0);
}

export function getSalaryForMonth(rates: SalaryRate[], clientId: string, monthDate: Date): number {
  const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const clientRates = rates
    .filter(r => r.client_id === clientId)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  let salary = 0;
  for (const r of clientRates) {
    if (r.effective_from.slice(0, 7) <= monthStr) salary = r.amount;
  }
  return salary;
}

export function calcMonthlyRevenue(
  clientId: string,
  rates: SalaryRate[],
  completedDates: string[],
): number {
  const months = new Set(completedDates.map(d => d.slice(0, 7)));
  let total = 0;
  months.forEach(m => {
    const [yr, mo] = m.split('-').map(Number);
    total += getSalaryForMonth(rates, clientId, new Date(yr, mo - 1));
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
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
