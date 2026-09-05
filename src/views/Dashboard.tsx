import React, { useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, LinearProgress,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, IconButton,
  Divider, ButtonBase, Fade, Skeleton, MenuItem, Select,
  ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AttachMoneyRoundedIcon from '@mui/icons-material/AttachMoneyRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import AreaChartRoundedIcon from '@mui/icons-material/AreaChartRounded';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { usePersistedState } from '../lib/usePersistedState';
import { calcTaskRevenue, calcMonthlyRevenue, formatCurrency, formatDate } from '../types';
import type { ViewName } from '../types';

function StatCard({ label, value, icon, color, subLabel, progress, onClick }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
  subLabel?: string; progress?: number; onClick?: () => void;
}) {
  return (
    <ButtonBase onClick={onClick} sx={{ borderRadius: 2, display: 'block', width: '100%', textAlign: 'left' }}>
      <Card sx={{
        p: 0, transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 32px ${color}22` },
        borderLeft: `4px solid ${color}`, cursor: onClick ? 'pointer' : 'default',
      }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{label}</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color, mt: 0.25, lineHeight: 1.1 }}>{value}</Typography>
              {subLabel && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>{subLabel}</Typography>}
            </Box>
            <Avatar sx={{ bgcolor: `${color}22`, color, width: 40, height: 40 }}>{icon}</Avatar>
          </Box>
          {progress !== undefined && <LinearProgress variant="determinate" value={Math.min(progress, 100)} sx={{ mt: 1.5, '& .MuiLinearProgress-bar': { bgcolor: color } }} />}
        </CardContent>
      </Card>
    </ButtonBase>
  );
}

type MetricKey = 'revenue' | 'videos' | 'completed' | 'payments';
const METRIC_OPTIONS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'revenue', label: 'Revenue', color: '#818CF8' },
  { key: 'videos', label: 'Videos', color: '#FBBF24' },
  { key: 'completed', label: 'Tasks', color: '#34D399' },
  { key: 'payments', label: 'Payments', color: '#60A5FA' },
];

type ChartType = 'bar' | 'line' | 'area';
type TimeRange = '6m' | '12m' | '30d';

type StatScope = 'total' | 'this_month' | string;

export default function Dashboard({ onNavigate }: { onNavigate?: (v: ViewName) => void }) {
  const { tasks, clients, payments, salaryRates, settings, loading } = useApp();
  const [metric, setMetric] = usePersistedState<MetricKey>('dash_metric', 'revenue');
  const [scope, setScope] = usePersistedState<StatScope>('dash_scope', 'total');
  const [chartType, setChartType] = usePersistedState<ChartType>('dash_chartType', 'bar');
  const [timeRange, setTimeRange] = usePersistedState<TimeRange>('dash_timeRange', '6m');

  const cur = (v: number) => formatCurrency(v, settings.currency);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    tasks.forEach(t => { const d = t.completed_date ?? t.received_date; if (d) months.add(d.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [tasks]);

  const scopeBounds = useMemo(() => {
    const now = new Date();
    if (scope === 'total') return { start: null as string | null, end: null as string | null };
    if (scope === 'this_month') return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() };
    const [yr, mo] = scope.split('-').map(Number);
    const d = new Date(yr, mo - 1);
    return { start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() };
  }, [scope]);

  const inScope = (d: string | null | undefined) => {
    if (scope === 'total') return true;
    if (!d) return false;
    return d >= scopeBounds.start! && d <= scopeBounds.end!;
  };

  const stats = useMemo(() => {
    const scopedTasks = tasks.filter(t => inScope(t.completed_date ?? t.received_date));

    let earned = 0;
    scopedTasks.forEach(t => {
      const client = clients.find(c => c.id === t.client_id);
      if (!client || client.payment_type !== 'monthly') earned += calcTaskRevenue(t, client);
    });
    clients.filter(c => c.payment_type === 'monthly').forEach(c => {
      const dates = scopedTasks.filter(t => t.client_id === c.id && (t.completed_date ?? t.received_date)).map(t => (t.completed_date ?? t.received_date)!);
      earned += calcMonthlyRevenue(c.id, salaryRates, dates);
    });

    const scopedPayments = scope === 'total' ? payments : payments.filter(p => p.date >= scopeBounds.start! && p.date <= scopeBounds.end!);
    const totalPaid = scopedPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalVideos = scopedTasks.reduce((s, t) => s + (t.videos ?? 0), 0);

    // Videos per day
    let videosPerDay = 0;
    if (scope === 'total') {
      const earliest = tasks.reduce<string | null>((min, t) => {
        const d = t.completed_date ?? t.received_date;
        return d && (!min || d < min) ? d : min;
      }, null);
      if (earliest) {
        const days = Math.max(1, Math.ceil((Date.now() - new Date(earliest).getTime()) / 86400000));
        videosPerDay = totalVideos / days;
      }
    } else {
      const start = scopeBounds.start ? new Date(scopeBounds.start) : startOfMonth(new Date());
      const end = scopeBounds.end ? new Date(scopeBounds.end) : new Date();
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
      videosPerDay = totalVideos / days;
    }

    return {
      taskCount: scopedTasks.length,
      totalVideos,
      earned, totalPaid,
      paymentCount: scopedPayments.length,
      videosPerDay,
    };
  }, [tasks, clients, payments, salaryRates, scope, scopeBounds]);

  // Build chart data based on time range
  const chartData = useMemo(() => {
    const now = new Date();

    if (timeRange === '30d') {
      // Last 30 days, grouped by day
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      return eachDayOfInterval({ start, end: now }).map(date => {
        const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
        const ds = dayStart.toISOString();
        const de = dayEnd.toISOString();

        const dayTasks = tasks.filter(t => { const d = t.completed_date ?? t.received_date; return d && d >= ds && d <= de; });
        let rev = 0;
        dayTasks.forEach(t => { const c = clients.find(c => c.id === t.client_id); if (!c || c.payment_type !== 'monthly') rev += calcTaskRevenue(t, c); });
        clients.filter(c => c.payment_type === 'monthly').forEach(c => {
          const dates = dayTasks.filter(t => t.client_id === c.id && (t.completed_date ?? t.received_date)).map(t => (t.completed_date ?? t.received_date)!);
          if (dates.length > 0) rev += calcMonthlyRevenue(c.id, salaryRates, dates);
        });
        const dayPayments = payments.filter(p => p.date >= ds && p.date <= de).reduce((s, p) => s + p.amount, 0);
        const videos = dayTasks.reduce((s, t) => s + (t.videos ?? 0), 0);

        const v = metric === 'revenue' ? rev : metric === 'videos' ? videos : metric === 'completed' ? dayTasks.length : dayPayments;
        return { label: format(date, 'd'), v, date };
      });
    }

    // Monthly data: 6m or 12m
    const months = timeRange === '12m' ? 12 : 6;
    return Array.from({ length: months }).map((_, i) => {
      const date = subMonths(now, months - 1 - i);
      const start = startOfMonth(date).toISOString();
      const end = endOfMonth(date).toISOString();
      const monthTasks = tasks.filter(t => { const d = t.completed_date ?? t.received_date; return d && d >= start && d <= end; });
      let rev = 0;
      monthTasks.forEach(t => { const c = clients.find(c => c.id === t.client_id); if (!c || c.payment_type !== 'monthly') rev += calcTaskRevenue(t, c); });
      clients.filter(c => c.payment_type === 'monthly').forEach(c => {
        const dates = monthTasks.filter(t => t.client_id === c.id && (t.completed_date ?? t.received_date)).map(t => (t.completed_date ?? t.received_date)!);
        if (dates.length > 0) rev += calcMonthlyRevenue(c.id, salaryRates, dates);
      });
      const monthPayments = payments.filter(p => p.date >= start && p.date <= end).reduce((s, p) => s + p.amount, 0);
      const videos = monthTasks.reduce((s, t) => s + (t.videos ?? 0), 0);

      const v = metric === 'revenue' ? rev : metric === 'videos' ? videos : metric === 'completed' ? monthTasks.length : monthPayments;
      return { label: format(date, 'MMM'), v, date };
    });
  }, [tasks, clients, payments, salaryRates, metric, timeRange]);

  const recentPayments = useMemo(() => [...payments].slice(0, 4), [payments]);
  const activeMetric = METRIC_OPTIONS.find(m => m.key === metric)!;

  const isCurrency = metric === 'revenue' || metric === 'payments';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <Box sx={{ bgcolor: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: activeMetric.color, fontWeight: 700, display: 'block' }}>
          {activeMetric.label}: {isCurrency ? cur(payload[0].value) : payload[0].value}
        </Typography>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ pt: 1 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          {[1, 2, 3, 4, 5].map(i => <Box key={i} sx={{ flex: '1 1 calc(33% - 6px)', minWidth: 0 }}><Skeleton variant="rounded" height={96} sx={{ borderRadius: 2 }} /></Box>)}
        </Box>
      </Box>
    );
  }

  const chartHeight = 220;

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 10, bottom: 0, left: -20 },
    };

    const axisProps = {
      tick: { fill: '#94A3B8', fontSize: 10 },
      axisLine: false as const,
      tickLine: false as const,
    };

    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <defs>
            <linearGradient id="barGradDash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeMetric.color} />
              <stop offset="100%" stopColor={activeMetric.color} stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={v => isCurrency && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
          <RTooltip content={<CustomTooltip />} />
          <Bar dataKey="v" fill="url(#barGradDash)" radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }

    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={v => isCurrency && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
          <RTooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="v" stroke={activeMetric.color} strokeWidth={3} dot={{ fill: activeMetric.color, r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      );
    }

    return (
      <AreaChart {...commonProps}>
        <defs>
          <linearGradient id="areaGradDash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={activeMetric.color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={activeMetric.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={v => isCurrency && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
        <RTooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="v" stroke={activeMetric.color} strokeWidth={2} fill="url(#areaGradDash)" dot={false} />
      </AreaChart>
    );
  };

  return (
    <Fade in timeout={400}>
      <Box sx={{ pb: 3 }}>
        {/* Scope selector */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
          <Select value={scope} onChange={e => setScope(e.target.value as StatScope)} size="small"
            sx={{ fontSize: '0.78rem', minWidth: 140, '& .MuiSelect-select': { py: 0.75 } }}>
            <MenuItem value="total" sx={{ fontSize: '0.8rem' }}>All Time</MenuItem>
            <MenuItem value="this_month" sx={{ fontSize: '0.8rem' }}>This Month</MenuItem>
            {availableMonths.map(m => {
              const [yr, mo] = m.split('-').map(Number);
              return <MenuItem key={m} value={m} sx={{ fontSize: '0.8rem' }}>{format(new Date(yr, mo - 1), 'MMMM yyyy')}</MenuItem>;
            })}
          </Select>
        </Box>

        {/* Stat cards — 5 cards */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ flex: '1 1 calc(33% - 6px)', minWidth: 0 }}>
            <StatCard label="Tasks" value={stats.taskCount} icon={<CheckCircleRoundedIcon fontSize="small" />} color="#34D399" subLabel="total jobs" onClick={() => onNavigate?.('tasks')} />
          </Box>
          <Box sx={{ flex: '1 1 calc(33% - 6px)', minWidth: 0 }}>
            <StatCard label="Earned" value={cur(stats.earned)} icon={<TrendingUpRoundedIcon fontSize="small" />} color="#818CF8" subLabel={`${cur(stats.totalPaid)} received`} onClick={() => onNavigate?.('analytics')} />
          </Box>
          <Box sx={{ flex: '1 1 calc(33% - 6px)', minWidth: 0 }}>
            <StatCard label="Videos" value={stats.totalVideos} icon={<VideoLibraryRoundedIcon fontSize="small" />} color="#FBBF24" subLabel="total videos" onClick={() => onNavigate?.('tasks')} />
          </Box>
          <Box sx={{ flex: '1 1 calc(33% - 6px)', minWidth: 0 }}>
            <StatCard label="Received" value={cur(stats.totalPaid)} icon={<AttachMoneyRoundedIcon fontSize="small" />} color="#60A5FA" subLabel={`${stats.paymentCount} payments`} onClick={() => onNavigate?.('bills')} />
          </Box>
          <Box sx={{ flex: '1 1 calc(33% - 6px)', minWidth: 0 }}>
            <StatCard label="Videos / Day" value={stats.videosPerDay.toFixed(1)} icon={<SpeedRoundedIcon fontSize="small" />} color="#A78BFA" subLabel="avg output" onClick={() => onNavigate?.('analytics')} />
          </Box>
        </Box>

        {/* Multi-view trend chart */}
        <Card sx={{ mb: 2, p: 2 }}>
          {/* Header row: metric select + chart type toggle + time range toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{activeMetric.label} Trend</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {/* Time range toggle */}
              <ToggleButtonGroup
                value={timeRange}
                exclusive
                size="small"
                onChange={(_, v) => v && setTimeRange(v)}
                sx={{ '& .MuiToggleButton-root': { py: 0.3, px: 1, fontSize: '0.7rem', textTransform: 'none', borderColor: 'rgba(255,255,255,0.1)' } }}
              >
                <ToggleButton value="30d">30D</ToggleButton>
                <ToggleButton value="6m">6M</ToggleButton>
                <ToggleButton value="12m">12M</ToggleButton>
              </ToggleButtonGroup>

              {/* Chart type toggle */}
              <ToggleButtonGroup
                value={chartType}
                exclusive
                size="small"
                onChange={(_, v) => v && setChartType(v)}
                sx={{ '& .MuiToggleButton-root': { py: 0.3, px: 0.75, borderColor: 'rgba(255,255,255,0.1)' } }}
              >
                <ToggleButton value="bar"><Tooltip title="Bar chart"><BarChartRoundedIcon sx={{ fontSize: 16 }} /></Tooltip></ToggleButton>
                <ToggleButton value="line"><Tooltip title="Line chart"><ShowChartRoundedIcon sx={{ fontSize: 16 }} /></Tooltip></ToggleButton>
                <ToggleButton value="area"><Tooltip title="Area chart"><AreaChartRoundedIcon sx={{ fontSize: 16 }} /></Tooltip></ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Metric selector row */}
          <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
            {METRIC_OPTIONS.map(m => (
              <Box
                key={m.key}
                onClick={() => setMetric(m.key)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
                  px: 1.25, py: 0.4, borderRadius: 3,
                  bgcolor: metric === m.key ? `${m.color}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${metric === m.key ? m.color : 'transparent'}`,
                  transition: 'all 0.15s ease',
                  '&:hover': { bgcolor: metric === m.key ? `${m.color}22` : 'rgba(255,255,255,0.08)' },
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color }} />
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', color: metric === m.key ? m.color : 'text.secondary' }}>
                  {m.label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* The chart */}
          <ResponsiveContainer width="100%" height={chartHeight}>
            {renderChart()}
          </ResponsiveContainer>
        </Card>

        {/* Recent Payments */}
        <Card>
          <Box sx={{ p: 2, pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Recent Payments</Typography>
            <IconButton size="small" onClick={() => onNavigate?.('analytics')}><ArrowForwardRoundedIcon fontSize="small" /></IconButton>
          </Box>
          <List dense disablePadding>
            {recentPayments.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No payments yet</Typography></Box>
            ) : recentPayments.map((payment, i) => {
              const client = clients.find(c => c.id === payment.client_id);
              return (
                <React.Fragment key={payment.id}>
                  {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />}
                  <ListItem sx={{ px: 2 }}>
                    <ListItemAvatar sx={{ minWidth: 36 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: client?.color ?? '#475569', fontSize: '0.7rem' }}>
                        <AttachMoneyRoundedIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${cur(payment.amount)} — ${client?.name ?? 'Unknown'}`}
                      secondary={`${payment.method} · ${formatDate(payment.date)}`}
                      primaryTypographyProps={{ fontWeight: 600, fontSize: '0.85rem' }}
                      secondaryTypographyProps={{ fontSize: '0.72rem', color: 'text.secondary' }}
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        </Card>
      </Box>
    </Fade>
  );
}
