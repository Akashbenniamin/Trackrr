import { useState } from 'react';
import {
  Box, Card, Typography, Button, TextField, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  InputAdornment, LinearProgress, Tooltip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import { useApp } from '../../contexts/AppContext';
import { CLIENT_COLORS } from '../../types';

export default function BatchflowClients() {
  const { batchflowClients, batchflowBatches, batchflowVideos, addBatchflowClient, updateBatchflowClient, canEdit } = useApp();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<{ id?: string; name: string; color: string; instagram_id: string } | null>(null);

  const activeClients = batchflowClients.filter(c => !c.archived);
  const filteredClients = activeClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.instagram_id && c.instagram_id.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenAdd = () => {
    setEditingClient({ name: '', color: CLIENT_COLORS[0], instagram_id: '' });
    setDialogOpen(true);
  };

  const handleOpenEdit = (c: any) => {
    setEditingClient({ id: c.id, name: c.name, color: c.color || CLIENT_COLORS[0], instagram_id: c.instagram_id || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingClient?.name.trim()) return;
    if (editingClient.id) {
      await updateBatchflowClient(editingClient.id, {
        name: editingClient.name.trim(),
        color: editingClient.color,
        instagram_id: editingClient.instagram_id.trim() || undefined,
      });
    } else {
      await addBatchflowClient({
        name: editingClient.name.trim(),
        color: editingClient.color,
        instagram_id: editingClient.instagram_id.trim() || undefined,
      });
    }
    setDialogOpen(false);
    setEditingClient(null);
  };

  const handleArchive = async (id: string, name: string) => {
    if (window.confirm(`Archive client "${name}"? You can restore them from the Archive view.`)) {
      await updateBatchflowClient(id, { archived: 1 });
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Clients
            </Typography>
            <Chip label={`${activeClients.length} clients`} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            Manage clients, Instagram profiles, and content batches.
          </Typography>
        </Box>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={handleOpenAdd}
            sx={{ borderRadius: 2.5, px: 2.5 }}
          >
            Add Client
          </Button>
        )}
      </Box>

      {/* Search Bar */}
      <Card sx={{ p: 1.5, mb: 3 }}>
        <TextField
          placeholder="Search clients by name or Instagram handle..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Card>

      {/* Client Cards Grid */}
      <Grid container spacing={2}>
        {filteredClients.map(c => {
          const clientBatches = batchflowBatches.filter(b => b.client_id === c.id && !b.archived);
          const batchIds = new Set(clientBatches.map(b => b.id));
          const clientVideos = batchflowVideos.filter(v => batchIds.has(v.batch_id));
          const postedVideos = clientVideos.filter(v => v.status === 'Posted').length;
          const editedVideos = clientVideos.filter(v => v.status === 'Edited').length;
          const pendingVideos = clientVideos.filter(v => v.status === 'Pending').length;
          const progress = clientVideos.length > 0 ? Math.round((postedVideos / clientVideos.length) * 100) : 0;

          return (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={c.id}>
              <Card
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  borderLeft: `4px solid ${c.color || '#818CF8'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  position: 'relative',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}
              >
                {/* Card Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" noWrap sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                      {c.name}
                    </Typography>
                    {c.instagram_id && (
                      <Box
                        component="a"
                        href={`https://instagram.com/${c.instagram_id.replace('@', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mt: 0.5,
                          fontSize: '0.75rem',
                          color: '#F43F5E',
                          textDecoration: 'none',
                          fontWeight: 600,
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        <InstagramIcon sx={{ fontSize: 14 }} />
                        {c.instagram_id.startsWith('@') ? c.instagram_id : `@${c.instagram_id}`}
                      </Box>
                    )}
                  </Box>

                  {canEdit && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Edit Client">
                        <IconButton size="small" onClick={() => handleOpenEdit(c)}>
                          <EditRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Archive Client">
                        <IconButton size="small" onClick={() => handleArchive(c.id, c.name)}>
                          <ArchiveRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>

                {/* Batch & Video Stats */}
                <Box sx={{ display: 'flex', gap: 2, bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LayersRoundedIcon sx={{ fontSize: 18, color: c.color || 'primary.main' }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.68rem' }}>Batches</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{clientBatches.length}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MovieRoundedIcon sx={{ fontSize: 18, color: '#3B82F6' }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.68rem' }}>Videos</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{clientVideos.length}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Video Pipeline Breakdown */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'text.secondary' }}>
                  <span>Pending: <strong style={{ color: '#F59E0B' }}>{pendingVideos}</strong></span>
                  <span>Edited: <strong style={{ color: '#3B82F6' }}>{editedVideos}</strong></span>
                  <span>Posted: <strong style={{ color: '#10B981' }}>{postedVideos}</strong></span>
                </Box>

                {/* Progress bar */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>Production Progress</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#10B981' }}>{progress}%</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(255,255,255,0.06)',
                      '& .MuiLinearProgress-bar': { bgcolor: c.color || '#10B981', borderRadius: 3 },
                    }}
                  />
                </Box>
              </Card>
            </Grid>
          );
        })}

        {filteredClients.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {search ? 'No clients match your search query.' : 'No clients yet. Click "Add Client" to create your first client!'}
              </Typography>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Add / Edit Client Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingClient?.id ? 'Edit Client' : 'New Client'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Client Name"
            fullWidth
            value={editingClient?.name ?? ''}
            onChange={e => setEditingClient(prev => prev ? { ...prev, name: e.target.value } : null)}
            autoFocus
          />
          <TextField
            label="Instagram Username (Optional)"
            placeholder="@username"
            fullWidth
            value={editingClient?.instagram_id ?? ''}
            onChange={e => setEditingClient(prev => prev ? { ...prev, instagram_id: e.target.value } : null)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><InstagramIcon sx={{ fontSize: 16 }} /></InputAdornment>,
            }}
          />
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
              Client Color Tag
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {CLIENT_COLORS.map(color => (
                <Box
                  key={color}
                  onClick={() => setEditingClient(prev => prev ? { ...prev, color } : null)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: color,
                    cursor: 'pointer',
                    border: editingClient?.color === color ? '3px solid #fff' : '3px solid transparent',
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!editingClient?.name.trim()}>
            {editingClient?.id ? 'Save Changes' : 'Create Client'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
