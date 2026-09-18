import { useMemo, useState } from 'react';
import {
  Box, Card, Typography, Avatar, IconButton, Chip, Button, Fade,
  Divider, Collapse, Select, MenuItem,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import { useApp } from '../contexts/AppContext';
import { usePersistedState } from '../lib/usePersistedState';
import { calcTaskRevenueFull, calcClientPaid, calcMonthlyRevenue, formatCurrency, formatDate, getClientMonthlyRetainerSchedule, getItemAmountForMonth } from '../types';
import ClientDialog from '../components/ClientDialog';
import type { Client } from '../types';

export default function ClientsView() {
  const { clients, tasks, payments, discounts, salaryRates, settings, deleteClient, canEdit } = useApp();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = usePersistedState<string | null>('clients_expandedId', null);
  const [monthFilter, setMonthFilter] = usePersistedState('clients_monthFilter', '');

  const cur = (v: number) => formatCurrency(v, settings.currency);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    tasks.forEach(t => {
      const d = t.completed_date ?? t.received_date;
      if (d) months.add(d.slice(0, 7));
    });
    payments.forEach(p => {
      (p.payment_for_months || []).forEach(m => months.add(m));
      if (p.date) months.add(p.date.slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [tasks, payments]);

  const getClientStats = (clientId: string) => {
    const allClientTasks = tasks.filter(t => t.client_id === clientId);
    let clientTasks = allClientTasks;
    if (monthFilter) {
      clientTasks = clientTasks.filter(t => {
        const d = t.completed_date ?? t.received_date;
        return d && d.slice(0, 7) === monthFilter;
      });
    }
    const client = clients.find(c => c.id === clientId);

    // Month-scoped earned (or all-time if no monthFilter)
    let earned = 0;
    if (client?.payment_type === 'monthly') {
      const dates = clientTasks
        .map(t => t.completed_date ?? t.received_date)
        .filter(Boolean) as string[];
      earned = calcMonthlyRevenue(clientId, salaryRates, dates, client);
    } else {
      clientTasks.forEach(t => {
        earned += calcTaskRevenueFull(t, client, salaryRates, tasks);
      });
    }

    // All-time earned across all tasks for this client (to compute all unpaid balance)
    let allTimeEarned = 0;
    if (client?.payment_type === 'monthly') {
      const allDates = allClientTasks
        .map(t => t.completed_date ?? t.received_date)
        .filter(Boolean) as string[];
      allTimeEarned = calcMonthlyRevenue(clientId, salaryRates, allDates, client);
    } else {
      allClientTasks.forEach(t => {
        allTimeEarned += calcTaskRevenueFull(t, client, salaryRates, tasks);
      });
    }

    const clientPayments = payments.filter(p => p.client_id === clientId);
    const clientDiscounts = discounts.filter(d => d.client_id === clientId);

    // Month-scoped paid (or all-time if no monthFilter)
    const paid = monthFilter
      ? clientPayments.reduce((s, p) => s + getItemAmountForMonth(p, monthFilter), 0)
      : calcClientPaid(payments, clientId);

    // All-time paid & discounts
    const allTimePaid = calcClientPaid(payments, clientId);
    const allTimeDisc = clientDiscounts.reduce((s, d) => s + (d.amount ?? 0), 0);

    // Balance ALWAYS includes all the unpaid balance across all time regardless of the selected month
    const balance = allTimeEarned - allTimePaid - allTimeDisc;
    const taskCount = clientTasks.length;

    // Tasks per day for this client
    let tasksPerDay = 0;
    const taskDates = clientTasks
      .map(t => t.completed_date ?? t.received_date)
      .filter(Boolean) as string[];
    if (taskDates.length > 0) {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const currentMonth = today.toISOString().slice(0, 7);
      const sorted = [...taskDates].sort();
      const earliest = sorted[0];
      const latest = sorted[sorted.length - 1];
      let days: number;
      if (monthFilter === currentMonth || (!monthFilter && latest.slice(0, 7) === currentMonth)) {
        // Ongoing month: count days from earliest task up to today
        days = Math.max(1, Math.ceil((new Date(todayStr).getTime() - new Date(earliest).getTime()) / 86400000) + 1);
      } else {
        // Completed month: use the full span of tasks
        days = Math.max(1, Math.ceil((new Date(latest).getTime() - new Date(earliest).getTime()) / 86400000) + 1);
      }
      tasksPerDay = taskCount / days;
    }

    return { earned, paid, balance, taskCount, tasksPerDay };
  };

  return (
    <Fade in timeout={400}>
      <Box sx={{ pb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
          <Select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            size="small"
            displayEmpty
            sx={{ fontSize: '0.82rem', minWidth: 160 }}
          >
            <MenuItem value="">All Months</MenuItem>
            {availableMonths.map(m => {
              const [yr, mo] = m.split('-').map(Number);
              return <MenuItem key={m} value={m}>{new Date(yr, mo - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })}</MenuItem>;
            })}
          </Select>
          <Button
            variant="contained"
            disabled={!canEdit}
            startIcon={<AddRoundedIcon />}
            onClick={() => { setSelectedClient(null); setDialogOpen(true); }}
          >
            Add Client
          </Button>
        </Box>

        {clients.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              No clients yet. Add your first client to get started.
            </Typography>
            <Button variant="outlined" disabled={!canEdit} onClick={() => { setSelectedClient(null); setDialogOpen(true); }}>
              Add Client
            </Button>
          </Card>
        ) : (
          clients.map(client => {
            const stats = getClientStats(client.id);
            const isExpanded = expandedId === client.id;
            const allClientTasks = tasks.filter(t => t.client_id === client.id);
            let clientTasks = allClientTasks;
            if (monthFilter) {
              clientTasks = clientTasks.filter(t => {
                const d = t.completed_date ?? t.received_date;
                return d && d.slice(0, 7) === monthFilter;
              });
            }

            const fullSchedule = client.payment_type === 'monthly'
              ? getClientMonthlyRetainerSchedule(client, tasks, salaryRates, 0)
              : [];
            const activeRetainer = fullSchedule.length > 0
              ? (monthFilter ? (fullSchedule.find(s => s.monthStr === monthFilter) || fullSchedule[fullSchedule.length - 1]) : fullSchedule[fullSchedule.length - 1])
              : null;

            return (
              <Card
                key={client.id}
                onDoubleClick={() => {
                  if (canEdit) {
                    setSelectedClient(client);
                    setDialogOpen(true);
                  }
                }}
                title={canEdit ? 'Double-click to edit client' : undefined}
                sx={{
                  mb: 1.5,
                  overflow: 'hidden',
                  borderLeft: `4px solid ${client.color}`,
                  cursor: canEdit ? 'pointer' : 'default',
                  borderRadius: 1,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': { transform: 'translateX(2px)' },
                }}
              >
                <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                  {/* Client Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                      <Avatar
                        sx={{
                          bgcolor: client.color,
                          width: { xs: 40, sm: 44 },
                          height: { xs: 40, sm: 44 },
                          fontSize: '1.1rem',
                          fontWeight: 800,
                          borderRadius: '12px',
                          boxShadow: `0 4px 12px ${client.color}30`,
                          flexShrink: 0,
                        }}
                      >
                        {client.name?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 800,
                            fontSize: { xs: '0.98rem', sm: '1.05rem' },
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {client.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.25 }}>
                          {client.company && (
                            <>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.72rem' }}>
                                {client.company}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.72rem' }}>•</Typography>
                            </>
                          )}
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' }}>
                            {stats.taskCount} task{stats.taskCount !== 1 ? 's' : ''}
                            {stats.tasksPerDay > 0 ? ` (${stats.tasksPerDay.toFixed(1)}/day)` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip
                        label={client.payment_type === 'monthly' ? 'Monthly' : 'Per Video'}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: client.payment_type === 'monthly' ? 'rgba(52,211,153,0.12)' : 'rgba(129,140,248,0.12)',
                          color: client.payment_type === 'monthly' ? '#34D399' : 'primary.light',
                          border: '1px solid',
                          borderColor: client.payment_type === 'monthly' ? 'rgba(52,211,153,0.25)' : 'rgba(129,140,248,0.25)',
                        }}
                      />
                      {canEdit && (
                        <>
                          <IconButton size="small" sx={{ p: 0.5 }} onClick={(e) => { e.stopPropagation(); setSelectedClient(client); setDialogOpen(true); }}>
                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton size="small" sx={{ p: 0.5 }} onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete client "${client.name}"?`)) deleteClient(client.id);
                          }}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: '#F87171' }} />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </Box>

                  {/* Clean 3-Box Financial Grid */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: { xs: 1, sm: 1.25 },
                    }}
                  >
                    {[
                      { label: 'Earned', value: cur(stats.earned), color: '#818CF8' },
                      { label: 'Paid', value: cur(stats.paid), color: '#34D399' },
                      { label: 'Balance', value: cur(stats.balance), color: stats.balance > 0 ? '#F87171' : '#34D399' },
                    ].map(s => (
                      <Box
                        key={s.label}
                        sx={{
                          p: { xs: 1, sm: 1.25 },
                          borderRadius: 1.5,
                          textAlign: 'center',
                          bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.025)',
                          border: '1px solid',
                          borderColor: (theme) => theme.palette.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            fontSize: { xs: '0.62rem', sm: '0.66rem' },
                            fontWeight: 700,
                            display: 'block',
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                          }}
                        >
                          {s.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: '"MADEOkineSans", "Roboto", sans-serif',
                            fontWeight: 800,
                            color: s.color,
                            fontSize: { xs: '0.98rem', sm: '1.18rem' },
                            lineHeight: 1.2,
                            mt: 0.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Monthly Retainer: active retainer line */}
                  {client.payment_type === 'monthly' && activeRetainer && (
                    <Box sx={{
                      mt: 1.25,
                      pt: 1,
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          Retainer:
                        </Typography>
                        <Chip
                          size="small"
                          label={`${activeRetainer.label}: ${cur(activeRetainer.amount)}`}
                          sx={{
                            height: 20,
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(129,140,248,0.12)',
                            color: 'primary.light',
                            border: '1px solid rgba(129,140,248,0.25)',
                          }}
                        />
                      </Box>
                      {canEdit && (
                        <Button
                          size="small"
                          variant="text"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedClient(client);
                            setDialogOpen(true);
                          }}
                          sx={{ textTransform: 'none', fontSize: '0.68rem', py: 0.2, px: 0.75, color: 'primary.light', minWidth: 'auto', flexShrink: 0 }}
                        >
                          Edit Rates
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Expand/collapse section */}
                {(allClientTasks.length > 0 || client.payment_type === 'monthly') && (
                  <>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Box
                      sx={{
                        px: { xs: 1.5, sm: 2 },
                        py: 0.85,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        bgcolor: 'rgba(255,255,255,0.01)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                        transition: 'background-color 0.15s ease',
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : client.id)}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.74rem' }}>
                        {client.payment_type === 'monthly'
                          ? `${clientTasks.length} task${clientTasks.length !== 1 ? 's' : ''} • Full Retainer Schedule`
                          : monthFilter
                            ? `${clientTasks.length} task${clientTasks.length !== 1 ? 's' : ''} in period (${allClientTasks.length} all-time) • Task History`
                            : `${allClientTasks.length} task${allClientTasks.length !== 1 ? 's' : ''} • Task History`}
                      </Typography>
                      {isExpanded ? <ExpandLessRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                    </Box>
                    <Collapse in={isExpanded}>
                      <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 1.5 }}>
                        {/* Complete Retainer Schedule inside expanded card */}
                        {client.payment_type === 'monthly' && fullSchedule.length > 0 && (
                          <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Complete Retainer Schedule ({fullSchedule.length} Months)
                              </Typography>
                              {canEdit && (
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setSelectedClient(client);
                                    setDialogOpen(true);
                                  }}
                                  sx={{ textTransform: 'none', fontSize: '0.68rem', py: 0.2, px: 0.75, color: 'primary.light', minWidth: 'auto' }}
                                >
                                  Edit Rates
                                </Button>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                              {fullSchedule.map(s => {
                                const isCurrent = s.monthStr === activeRetainer?.monthStr;
                                return (
                                  <Chip
                                    key={s.monthStr}
                                    size="small"
                                    label={`${s.label}: ${cur(s.amount)}`}
                                    sx={{
                                      height: 22,
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      bgcolor: isCurrent ? 'rgba(129,140,248,0.22)' : 'rgba(255,255,255,0.04)',
                                      color: isCurrent ? 'primary.light' : 'text.secondary',
                                      border: isCurrent ? '1px solid rgba(129,140,248,0.45)' : '1px solid rgba(255,255,255,0.08)',
                                    }}
                                  />
                                );
                              })}
                            </Box>
                          </Box>
                        )}

                        {/* Tasks list */}
                        {clientTasks.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {clientTasks.slice(0, 5).map(t => {
                              const d = t.completed_date ?? t.received_date;
                              const rev = calcTaskRevenueFull(t, client, salaryRates, tasks);
                              return (
                                <Box
                                  key={t.id}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 0.6,
                                    px: 0.5,
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  }}
                                >
                                  <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                                    <Typography variant="caption" sx={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {t.title || 'Untitled'}
                                    </Typography>
                                    {d && (
                                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                                        {formatDate(d)}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily: '"MADEOkineSans", "Roboto", sans-serif',
                                      fontWeight: 800,
                                      color: '#818CF8',
                                      fontSize: '0.82rem',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {cur(rev)}
                                  </Typography>
                                </Box>
                              );
                            })}
                            {clientTasks.length > 5 && (
                              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', textAlign: 'center', mt: 0.5 }}>
                                +{clientTasks.length - 5} more tasks
                              </Typography>
                            )}
                          </Box>
                        ) : allClientTasks.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', py: 0.5, fontStyle: 'italic', fontSize: '0.72rem' }}>
                              No tasks in this period. Showing recent task history:
                            </Typography>
                            {allClientTasks.slice(0, 5).map(t => {
                              const d = t.completed_date ?? t.received_date;
                              const rev = calcTaskRevenueFull(t, client, salaryRates, tasks);
                              return (
                                <Box
                                  key={t.id}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    py: 0.6,
                                    px: 0.5,
                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  }}
                                >
                                  <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                                    <Typography variant="caption" sx={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {t.title || 'Untitled'}
                                    </Typography>
                                    {d && (
                                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
                                        {formatDate(d)}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      fontFamily: '"MADEOkineSans", "Roboto", sans-serif',
                                      fontWeight: 800,
                                      color: '#818CF8',
                                      fontSize: '0.82rem',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {cur(rev)}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', py: 0.5 }}>
                            No tasks recorded for this period.
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  </>
                )}
              </Card>
            );
          })
        )}

        <ClientDialog
          open={dialogOpen}
          client={selectedClient}
          onClose={() => { setDialogOpen(false); setSelectedClient(null); }}
        />
      </Box>
    </Fade>
  );
}
