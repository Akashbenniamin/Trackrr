import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, LinearProgress, Avatar, ButtonBase, Chip,
  Select, MenuItem, FormControl,
} from '@mui/material';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import PendingRoundedIcon from '@mui/icons-material/PendingRounded';
import MovieCreationRoundedIcon from '@mui/icons-material/MovieCreationRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../../contexts/AppContext';

function StatCard({ label, value, icon, color, subLabel, progress, onClick }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
  subLabel?: string; progress?: number; onClick?: () => void;
}) {
  return (
    <ButtonBase onClick={onClick} sx={{ borderRadius: 1, display: 'block', width: '100%', height: '100%', textAlign: 'left' }}>
      <Card sx={{
        p: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
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

export default function BatchflowDashboard({ onNavigate }: { onNavigate?: (view: any) => void }) {
  const { batchflowClients, batchflowBatches, batchflowVideos } = useApp();
  const [timeRange, setTimeRange] = useState<'all_time' | 'this_month'>('all_time');

  const activeClients = batchflowClients.filter(c => !c.archived);
  const activeBatches = batchflowBatches.filter(b => !b.archived);
  const activeBatchIds = new Set(activeBatches.map(b => b.id));
  const activeVideos = batchflowVideos.filter(v => activeBatchIds.has(v.batch_id));

  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-09"

  const displayBatches = timeRange === 'this_month'
    ? activeBatches.filter(b => (b.shoot_date && b.shoot_date.startsWith(currentMonthPrefix)) || (b.created_at && b.created_at.startsWith(currentMonthPrefix)))
    : activeBatches;

  const displayBatchIds = new Set(displayBatches.map(b => b.id));

  const displayVideos = timeRange === 'this_month'
    ? activeVideos.filter(v => {
        if (displayBatchIds.has(v.batch_id)) return true;
        if (v.posted_date && v.posted_date.startsWith(currentMonthPrefix)) return true;
        if (v.edited_date && v.edited_date.startsWith(currentMonthPrefix)) return true;
        if (v.created_at && v.created_at.startsWith(currentMonthPrefix)) return true;
        return false;
      })
    : activeVideos;

  const pendingCount = displayVideos.filter(v => v.status === 'Pending').length;
  const editedCount = displayVideos.filter(v => v.status === 'Edited').length;
  const postedCount = displayVideos.filter(v => v.status === 'Posted').length;
  const totalVideos = displayVideos.length;

  const displayClientCount = timeRange === 'this_month'
    ? activeClients.filter(c => displayBatches.some(b => b.client_id === c.id)).length
    : activeClients.length;

  const chartData = [
    { name: 'Pending', count: pendingCount, color: '#F59E0B' },
    { name: 'Edited', count: editedCount, color: '#3B82F6' },
    { name: 'Posted', count: postedCount, color: '#10B981' },
  ];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            Production Overview
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {timeRange === 'this_month'
              ? 'Real-time video pipeline metrics for this month.'
              : 'Real-time video pipeline metrics for this batchflow workspace.'}
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as 'all_time' | 'this_month')}
            size="small"
            sx={{
              borderRadius: 1,
              height: 38,
              fontSize: '0.85rem',
              fontWeight: 700,
              bgcolor: 'background.paper',
            }}
          >
            <MenuItem value="all_time">All Time</MenuItem>
            <MenuItem value="this_month">This Month</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flex: { xs: '1 1 calc(50% - 6px)', sm: '1 1 calc(33% - 6px)', md: '1 1 0' }, minWidth: { xs: 'calc(50% - 6px)', md: 140 } }}>
          <StatCard
            label="Active Clients"
            value={displayClientCount}
            icon={<PeopleRoundedIcon fontSize="small" />}
            color="#818CF8"
            subLabel={timeRange === 'this_month' ? 'active this mo' : 'in pipeline'}
            onClick={() => onNavigate?.('clients')}
          />
        </Box>
        <Box sx={{ flex: { xs: '1 1 calc(50% - 6px)', sm: '1 1 calc(33% - 6px)', md: '1 1 0' }, minWidth: { xs: 'calc(50% - 6px)', md: 140 } }}>
          <StatCard
            label="Active Batches"
            value={displayBatches.length}
            icon={<LayersRoundedIcon fontSize="small" />}
            color="#A78BFA"
            subLabel={timeRange === 'this_month' ? 'this month' : 'in progress'}
            onClick={() => onNavigate?.('batches')}
          />
        </Box>
        <Box sx={{ flex: { xs: '1 1 calc(50% - 6px)', sm: '1 1 calc(33% - 6px)', md: '1 1 0' }, minWidth: { xs: 'calc(50% - 6px)', md: 140 } }}>
          <StatCard
            label="Edit Pending"
            value={pendingCount}
            icon={<PendingRoundedIcon fontSize="small" />}
            color="#F59E0B"
            subLabel="waiting edit"
            onClick={() => onNavigate?.('batches')}
          />
        </Box>
        <Box sx={{ flex: { xs: '1 1 calc(50% - 6px)', sm: '1 1 calc(33% - 6px)', md: '1 1 0' }, minWidth: { xs: 'calc(50% - 6px)', md: 140 } }}>
          <StatCard
            label="Edited Videos"
            value={editedCount}
            icon={<MovieCreationRoundedIcon fontSize="small" />}
            color="#3B82F6"
            subLabel="ready to post"
            onClick={() => onNavigate?.('batches')}
          />
        </Box>
        <Box sx={{ flex: { xs: '1 1 calc(50% - 6px)', sm: '1 1 calc(33% - 6px)', md: '1 1 0' }, minWidth: { xs: 'calc(50% - 6px)', md: 140 } }}>
          <StatCard
            label="Posted Videos"
            value={postedCount}
            icon={<CheckCircleRoundedIcon fontSize="small" />}
            color="#10B981"
            subLabel="published"
            onClick={() => onNavigate?.('batches')}
          />
        </Box>
      </Box>

      {/* Charts & Breakdown */}
      <Grid container spacing={2}>
        {/* Pipeline Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ p: 3, height: 380, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Production Pipeline
            </Typography>
            <Box sx={{ flex: 1, width: '100%', minHeight: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" axisLine={false} tickLine={false} />
                  <YAxis stroke="#94A3B8" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Status Breakdown & Progress */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ p: 3, height: 380, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Status Breakdown
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
              {[
                { label: 'Edit Pending', count: pendingCount, color: '#F59E0B' },
                { label: 'Edited Videos', count: editedCount, color: '#3B82F6' },
                { label: 'Posted to Socials', count: postedCount, color: '#10B981' },
              ].map(item => {
                const pct = totalVideos > 0 ? Math.round((item.count / totalVideos) * 100) : 0;
                return (
                  <Box key={item.label}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.label}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: item.color }}>
                        {item.count} <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>({pct}%)</Typography>
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        height: 8,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 1.5 },
                      }}
                    />
                  </Box>
                );
              })}

              <Box sx={{ mt: 'auto', p: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Overall Completion
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#10B981' }}>
                  {totalVideos > 0 ? Math.round((postedCount / totalVideos) * 100) : 0}% Done
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Batches Quick Strip */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
          Recent Batches
        </Typography>
        <Grid container spacing={2}>
          {displayBatches.slice(0, 4).map(b => {
            const client = activeClients.find(c => c.id === b.client_id);
            const bVideos = activeVideos.filter(v => v.batch_id === b.id);
            const bPosted = bVideos.filter(v => v.status === 'Posted').length;
            const progress = bVideos.length > 0 ? Math.round((bPosted / bVideos.length) * 100) : 0;

            return (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={b.id} sx={{ display: 'flex' }}>
                <Card
                  onClick={() => onNavigate?.('batches')}
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    p: 2,
                    cursor: 'pointer',
                    borderLeft: `4px solid ${client?.color || '#818CF8'}`,
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'translateY(-2px)' },
                  }}
                >
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1 }}>
                      <Typography variant="body1" noWrap sx={{ fontWeight: 700 }}>{b.name}</Typography>
                      <Chip label={client?.name || 'Client'} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: `${client?.color || '#818CF8'}20`, color: client?.color || '#818CF8' }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                      Shoot Date: {b.shoot_date || 'N/A'} • {bVideos.length} Videos
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 'auto' }}>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 6,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: client?.color || 'primary.main', borderRadius: 1.5 },
                      }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>Progress</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem' }}>{progress}%</Typography>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            );
          })}
          {displayBatches.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Card sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {timeRange === 'this_month'
                    ? 'No shoot batches recorded for this month. Switch to "All Time" to view previous batches.'
                    : 'No batches yet. Click Batches in the menu to create your first content shoot batch!'}
                </Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
}
