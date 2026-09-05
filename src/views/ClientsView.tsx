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
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import { useApp } from '../contexts/AppContext';
import { usePersistedState } from '../lib/usePersistedState';
import { calcTaskRevenueFull, calcClientPaid, calcMonthlyRevenue, formatCurrency } from '../types';
import ClientDialog from '../components/ClientDialog';
import type { Client } from '../types';

export default function ClientsView() {
  const { clients, tasks, payments, salaryRates, settings, deleteClient, canEdit } = useApp();
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
    return Array.from(months).sort().reverse();
  }, [tasks]);

  const getClientStats = (clientId: string) => {
    let clientTasks = tasks.filter(t => t.client_id === clientId);
    if (monthFilter) {
      clientTasks = clientTasks.filter(t => {
        const d = t.completed_date ?? t.received_date;
        return d && d.slice(0, 7) === monthFilter;
      });
    }
    const client = clients.find(c => c.id === clientId);

    let earned = 0;
    if (client?.payment_type === 'monthly') {
      const dates = clientTasks
        .map(t => t.completed_date ?? t.received_date)
        .filter(Boolean) as string[];
      earned = calcMonthlyRevenue(clientId, salaryRates, dates);
    } else {
      clientTasks.forEach(t => {
        earned += calcTaskRevenueFull(t, client, salaryRates, tasks);
      });
    }

    const paid = monthFilter
      ? payments.filter(p => p.client_id === clientId && p.date.slice(0, 7) === monthFilter).reduce((s, p) => s + p.amount, 0)
      : calcClientPaid(payments, clientId);
    const balance = earned - paid;
    const totalVideos = clientTasks.reduce((s, t) => s + (t.videos ?? 0), 0);

    // Videos per day for this client
    let videosPerDay = 0;
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
      videosPerDay = totalVideos / days;
    }

    return { earned, paid, balance, totalVideos, videosPerDay, taskCount: clientTasks.length };
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
            let clientTasks = tasks.filter(t => t.client_id === client.id);
            if (monthFilter) {
              clientTasks = clientTasks.filter(t => {
                const d = t.completed_date ?? t.received_date;
                return d && d.slice(0, 7) === monthFilter;
              });
            }

            return (
              <Card key={client.id} sx={{ mb: 1.5, overflow: 'hidden', borderLeft: `4px solid ${client.color}` }}>
                <Box sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: client.color, width: 44, height: 44, fontSize: '1.1rem', fontWeight: 700 }}>
                      {client.name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                            {client.name}
                          </Typography>
                          {client.company && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{client.company}</Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Chip
                            label={client.payment_type === 'monthly' ? 'Monthly' : 'Per Video'}
                            size="small"
                            sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(129,140,248,0.15)', color: 'primary.light' }}
                          />
                          {canEdit && (
                            <>
                              <IconButton size="small" sx={{ p: 0.4 }} onClick={() => { setSelectedClient(client); setDialogOpen(true); }}>
                                <EditRoundedIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                              <IconButton size="small" sx={{ p: 0.4 }} onClick={() => {
                                if (window.confirm(`Delete client "${client.name}"?`)) deleteClient(client.id);
                              }}>
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 15, color: '#F87171' }} />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Box>

                      {/* Quick stats */}
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.75 }}>
                        {[
                          { label: 'Earned', value: cur(stats.earned), color: '#818CF8' },
                          { label: 'Paid', value: cur(stats.paid), color: '#34D399' },
                          { label: 'Balance', value: cur(stats.balance), color: stats.balance > 0 ? '#F87171' : '#34D399' },
                          { label: 'Videos', value: stats.totalVideos, color: '#FBBF24' },
                          { label: 'Vids/Day', value: stats.videosPerDay.toFixed(1), color: '#A78BFA' },
                        ].map(s => (
                          <Box key={s.label} sx={{ flex: '1 1 calc(20% - 8px)', minWidth: 0, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem', display: 'block', textTransform: 'uppercase' }}>
                              {s.label}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: s.color, fontSize: '0.78rem' }}>
                              {s.value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* Expand/collapse tasks */}
                {clientTasks.length > 0 && (
                  <>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                    <Box
                      sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
                      onClick={() => setExpandedId(isExpanded ? null : client.id)}
                    >
                      <Typography variant="caption" sx={{ flex: 1, color: 'text.secondary', fontWeight: 600 }}>
                        {clientTasks.length} task{clientTasks.length !== 1 ? 's' : ''}
                      </Typography>
                      {isExpanded ? <ExpandLessRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                    </Box>
                    <Collapse in={isExpanded}>
                      <Box sx={{ px: 1.5, pb: 1 }}>
                        {clientTasks.slice(0, 5).map(t => (
                          <Box key={t.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{t.title || 'Untitled'}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <VideoLibraryRoundedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>{t.videos ?? 0}</Typography>
                              <Typography variant="caption" sx={{ color: '#818CF8', fontWeight: 700, fontSize: '0.72rem', ml: 0.5 }}>
                                {cur(calcTaskRevenueFull(t, client, salaryRates, tasks))}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                        {clientTasks.length > 5 && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', textAlign: 'center', mt: 0.5 }}>
                            +{clientTasks.length - 5} more
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
