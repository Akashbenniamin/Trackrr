import React, { useMemo } from 'react';
import {
  Box, Card, Typography, Chip, Fade, Select, MenuItem, FormControl,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { usePersistedState } from '../lib/usePersistedState';
import { calcTaskRevenue, calcMonthlyRevenue, formatCurrency } from '../types';

const CHART_COLORS = ['#818CF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#60A5FA', '#FB7185', '#4ADE80'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, mt: 0.5 }}>
      {children}
    </Typography>
  );
}

type Scope = 'all' | 'this_month' | string;

export default function AnalyticsView() {
  const { tasks, clients, payments, salaryRates, settings } = useApp();
  const cur = (v: number) => formatCurrency(v, settings.currency);
  const [scope, setScope] = usePersistedState<Scope>('analytics_scope', 'all');

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    tasks.forEach(t => { const d = t.completed_date ?? t.received_date; if (d) months.add(d.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [tasks]);

  const scopeBounds = useMemo(() => {
    const now = new Date();
    if (scope === 'all') return { start: null as string | null, end: null as string | null };
    if (scope === 'this_month') return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() };
    const [yr, mo] = scope.split('-').map(Number);
    const d = new Date(yr, mo - 1);
    return { start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() };
  }, [scope]);

  const inScope = (d: string | null | undefined) => {
    if (!d) return false;
    if (scope === 'all') return true;
    return d >= scopeBounds.start! && d <= scopeBounds.end!;
  };

  const scopedTasks = useMemo(() => tasks.filter(t => inScope(t.completed_date ?? t.received_date)), [tasks, scopeBounds, scope]);
  const scopedPayments = useMemo(() => scope === 'all' ? payments : payments.filter(p => p.date >= scopeBounds.start! && p.date <= scopeBounds.end!), [payments, scopeBounds, scope]);

  // Monthly revenue (last 6 months) — always full timeline regardless of scope
  const monthlyRevenue = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), 5 - i);
      const start = startOfMonth(date).toISOString();
      const end = endOfMonth(date).toISOString();
      const monthTasks = tasks.filter(t => {
        const d = t.completed_date ?? t.received_date;
        return d && d >= start && d <= end;
      });
      let rev = 0;
      monthTasks.forEach(t => {
        const client = clients.find(c => c.id === t.client_id);
        if (!client || client.payment_type !== 'monthly') rev += calcTaskRevenue(t, client);
      });
      clients.filter(c => c.payment_type === 'monthly').forEach(c => {
        const dates = monthTasks.filter(t => t.client_id === c.id).map(t => (t.completed_date ?? t.received_date)!);
        if (dates.length > 0) rev += calcMonthlyRevenue(c.id, salaryRates, dates);
      });
      const videos = monthTasks.reduce((s, t) => s + (t.videos ?? 0), 0);
      const paid = payments.filter(p => p.date >= start && p.date <= end).reduce((s, p) => s + p.amount, 0);
      return { month: format(date, 'MMM'), rev, videos, paid };
    });
  }, [tasks, clients, payments, salaryRates]);

  // Revenue by client (scoped)
  const revenueByClient = useMemo(() => {
    return clients.map(client => {
      const clientTasks = scopedTasks.filter(t => t.client_id === client.id);
      let rev = 0;
      if (client.payment_type === 'monthly') {
        const dates = clientTasks.map(t => t.completed_date ?? t.received_date).filter(Boolean) as string[];
        rev = calcMonthlyRevenue(client.id, salaryRates, dates);
      } else {
        clientTasks.forEach(t => { rev += calcTaskRevenue(t, client); });
      }
      return { name: client.name, value: rev, color: client.color };
    }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);
  }, [scopedTasks, clients, salaryRates]);

  // Videos per client (scoped)
  const videosByClient = useMemo(() => {
    return clients.map(client => {
      const ct = scopedTasks.filter(t => t.client_id === client.id);
      const total = ct.reduce((s, t) => s + (t.videos ?? 0), 0);
      return { name: client.name, total, color: client.color };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  }, [scopedTasks, clients]);

  const totalEarned = revenueByClient.reduce((s, c) => s + c.value, 0);
  const totalPaid = scopedPayments.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, totalEarned - totalPaid);

  const paymentByMethod = useMemo(() => {
    const map = new Map<string, number>();
    scopedPayments.forEach(p => map.set(p.method, (map.get(p.method) ?? 0) + p.amount));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [scopedPayments]);

  const avgPerVideo = (() => {
    const totalVideos = scopedTasks.reduce((s, t) => s + (t.videos ?? 0), 0);
    return totalVideos > 0 ? totalEarned / totalVideos : 0;
  })();

  const bestMonth = monthlyRevenue.reduce((best, m) => m.rev > best.rev ? m : best, { month: '—', rev: 0 });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <Box sx={{ bgcolor: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{label}</Typography>
        {payload.map((entry: any) => (
          <Typography key={entry.dataKey} variant="caption" sx={{ color: entry.color, display: 'block', fontWeight: 700 }}>
            {entry.name}: {typeof entry.value === 'number' && entry.dataKey !== 'videos' ? cur(entry.value) : entry.value}
          </Typography>
        ))}
      </Box>
    );
  };

  const scopeLabel = scope === 'all' ? 'All Time' : scope === 'this_month' ? 'This Month' : format(new Date(scope + '-01'), 'MMMM yyyy');

  return (
    <Fade in timeout={400}>
      <Box sx={{ pb: 3 }}>
        {/* Month selector */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select value={scope} onChange={e => setScope(e.target.value as Scope)} sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.75 } }}>
              <MenuItem value="all" sx={{ fontSize: '0.8rem' }}>All Time</MenuItem>
              <MenuItem value="this_month" sx={{ fontSize: '0.8rem' }}>This Month</MenuItem>
              {availableMonths.map(m => {
                const [yr, mo] = m.split('-').map(Number);
                return <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{format(new Date(yr, mo - 1), 'MMMM yyyy')}</MenuItem>;
              })}
            </Select>
          </FormControl>
        </Box>

        {/* Summary Stats */}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1, fontWeight: 600 }}>
          {scopeLabel}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          {[
            { label: 'Total Earned', value: cur(totalEarned), color: '#818CF8' },
            { label: 'Total Received', value: cur(totalPaid), color: '#34D399' },
            { label: 'Outstanding', value: cur(outstanding), color: '#F87171' },
            { label: 'Avg per Video', value: cur(avgPerVideo), color: '#FBBF24' },
          ].map(s => (
            <Box key={s.label} sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
              <Card sx={{ p: 1.5, borderLeft: `4px solid ${s.color}` }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                  {s.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: s.color, mt: 0.25 }}>
                  {s.value}
                </Typography>
              </Card>
            </Box>
          ))}
        </Box>

        {/* Monthly Revenue + Videos */}
        <Card sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <SectionTitle>Monthly Revenue</SectionTitle>
            <Chip label={`Best: ${bestMonth.month} ${cur(bestMonth.rev)}`} size="small"
              sx={{ bgcolor: 'rgba(129,140,248,0.15)', color: 'primary.light', fontSize: '0.7rem' }} />
          </Box>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyRevenue} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#6366F1" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rev" name="Revenue" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue vs Payments Area Chart */}
        <Card sx={{ p: 2, mb: 2 }}>
          <SectionTitle>Earned vs Received</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyRevenue} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34D399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="rev" name="Earned" stroke="#818CF8" strokeWidth={2} fill="url(#earnGrad)" dot={false} />
              <Area type="monotone" dataKey="paid" name="Received" stroke="#34D399" strokeWidth={2} fill="url(#paidGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue by Client */}
        {revenueByClient.length > 0 && (
          <Card sx={{ p: 2, mb: 2 }}>
            <SectionTitle>Revenue by Client — {scopeLabel}</SectionTitle>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ width: 180, height: 180, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revenueByClient} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                      {revenueByClient.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => cur(v)} contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ flex: 1, minWidth: 140 }}>
                {revenueByClient.map((c, i) => (
                  <Box key={c.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color || CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{c.name}</Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: c.color || CHART_COLORS[i % CHART_COLORS.length] }}>
                      {cur(c.value)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Card>
        )}

        {/* Videos per Client */}
        {videosByClient.length > 0 && (
          <Card sx={{ p: 2, mb: 2 }}>
            <SectionTitle>Videos by Client — {scopeLabel}</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(120, videosByClient.length * 36)}>
              <BarChart data={videosByClient} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Videos" radius={[0, 4, 4, 0]} fill="#34D399" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Payment methods */}
        {paymentByMethod.length > 0 && (
          <Card sx={{ p: 2 }}>
            <SectionTitle>Payment Methods — {scopeLabel}</SectionTitle>
            {paymentByMethod.map((m, i) => (
              <Box key={m.name} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                    {cur(m.value)}
                  </Typography>
                </Box>
                <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)' }}>
                  <Box sx={{
                    height: '100%',
                    borderRadius: 3,
                    bgcolor: CHART_COLORS[i % CHART_COLORS.length],
                    width: `${totalPaid > 0 ? (m.value / totalPaid) * 100 : 0}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </Box>
              </Box>
            ))}
          </Card>
        )}
      </Box>
    </Fade>
  );
}
