import React from 'react';
import {
  Box, Card, Typography, Grid, LinearProgress, Chip,
} from '@mui/material';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import PendingRoundedIcon from '@mui/icons-material/PendingRounded';
import MovieCreationRoundedIcon from '@mui/icons-material/MovieCreationRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../../contexts/AppContext';

export default function BatchflowDashboard({ onNavigate }: { onNavigate?: (view: any) => void }) {
  const { batchflowClients, batchflowBatches, batchflowVideos } = useApp();

  const activeClients = batchflowClients.filter(c => !c.archived);
  const activeBatches = batchflowBatches.filter(b => !b.archived);
  const activeBatchIds = new Set(activeBatches.map(b => b.id));
  const activeVideos = batchflowVideos.filter(v => activeBatchIds.has(v.batch_id));

  const pendingCount = activeVideos.filter(v => v.status === 'Pending').length;
  const editedCount = activeVideos.filter(v => v.status === 'Edited').length;
  const postedCount = activeVideos.filter(v => v.status === 'Posted').length;
  const totalVideos = activeVideos.length;

  const chartData = [
    { name: 'Pending', count: pendingCount, color: '#F59E0B' },
    { name: 'Edited', count: editedCount, color: '#3B82F6' },
    { name: 'Posted', count: postedCount, color: '#10B981' },
  ];

  const stats = [
    { label: 'Active Clients', value: activeClients.length, icon: <PeopleRoundedIcon />, color: '#818CF8' },
    { label: 'Active Batches', value: activeBatches.length, icon: <LayersRoundedIcon />, color: '#A78BFA' },
    { label: 'Edit Pending', value: pendingCount, icon: <PendingRoundedIcon />, color: '#F59E0B' },
    { label: 'Edited Videos', value: editedCount, icon: <MovieCreationRoundedIcon />, color: '#3B82F6' },
    { label: 'Posted Videos', value: postedCount, icon: <CheckCircleRoundedIcon />, color: '#10B981' },
  ];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
          Production Overview
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Real-time video pipeline metrics for this batchflow workspace.
        </Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map(s => (
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={s.label}>
            <Card
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                borderRadius: 3,
                transition: 'transform 0.15s ease',
                '&:hover': { transform: 'translateY(-2px)' },
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  bgcolor: `${s.color}18`,
                  color: s.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {React.cloneElement(s.icon, { sx: { fontSize: 20 } })}
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                  {s.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: s.color, mt: 0.25 }}>
                  {s.value}
                </Typography>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

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
                      borderRadius: 12,
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
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
                        borderRadius: 4,
                        bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 4 },
                      }}
                    />
                  </Box>
                );
              })}

              <Box sx={{ mt: 'auto', p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Recent Batches
          </Typography>
          {onNavigate && (
            <Chip
              label="View All Batches"
              size="small"
              onClick={() => onNavigate('batches')}
              sx={{ cursor: 'pointer', fontWeight: 600, bgcolor: 'rgba(129,140,248,0.15)', color: 'primary.light' }}
            />
          )}
        </Box>
        <Grid container spacing={2}>
          {activeBatches.slice(0, 3).map(b => {
            const client = batchflowClients.find(c => c.id === b.client_id);
            const bVideos = activeVideos.filter(v => v.batch_id === b.id);
            const bPosted = bVideos.filter(v => v.status === 'Posted').length;
            const progress = bVideos.length > 0 ? Math.round((bPosted / bVideos.length) * 100) : 0;

            return (
              <Grid size={{ xs: 12, md: 4 }} key={b.id}>
                <Card
                  onClick={() => onNavigate && onNavigate('batches')}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    borderLeft: `4px solid ${client?.color || '#818CF8'}`,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>{b.name}</Typography>
                    <Chip label={client?.name || 'Client'} size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: `${client?.color || '#818CF8'}20`, color: client?.color || '#818CF8' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                    Shoot Date: {b.shoot_date || 'N/A'} • {bVideos.length} Videos
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      '& .MuiLinearProgress-bar': { bgcolor: client?.color || 'primary.main', borderRadius: 3 },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>Progress</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem' }}>{progress}%</Typography>
                  </Box>
                </Card>
              </Grid>
            );
          })}
          {activeBatches.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Card sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No batches yet. Click Batches in the menu to create your first content shoot batch!
                </Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
}
