import React, { useState } from 'react';
import {
  Box, Card, Typography, Button, Select, MenuItem, Divider, Fade,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Avatar, IconButton, Alert, List, ListItem,
  ListItemAvatar, ListItemText,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import { useApp } from '../contexts/AppContext';

const WS_COLORS = ['#818CF8', '#34D399', '#F59E0B', '#F87171', '#A78BFA', '#60A5FA', '#FB7185', '#4ADE80'];

export default function SettingsView() {
  const { settings, updateSettings, workspaces, activeWorkspace, createWorkspace, updateWorkspace, deleteWorkspace, switchWorkspace, tasks, clients, payments } = useApp();
  const [wsDialog, setWsDialog] = useState(false);
  const [editWs, setEditWs] = useState<{ id?: string; name: string; color: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalTasks = tasks.length;
  const totalClients = clients.length;

  const handleSaveWs = async () => {
    if (!editWs?.name.trim()) return;
    if (editWs.id) {
      await updateWorkspace(editWs.id, { name: editWs.name, color: editWs.color });
    } else {
      await createWorkspace(editWs.name, editWs.color);
    }
    setWsDialog(false);
    setEditWs(null);
  };

  return (
    <Fade in timeout={400}>
      <Box sx={{ pb: 3 }}>
        {/* App overview */}
        <Card sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Overview</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'Tasks', value: totalTasks, color: '#818CF8' },
              { label: 'Clients', value: totalClients, color: '#34D399' },
              { label: 'Payments', value: payments.length, color: '#FBBF24' },
            ].map(s => (
              <Box key={s.label} sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 0, textAlign: 'center', p: 1, borderRadius: 2, bgcolor: `${s.color}15` }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{s.label}</Typography>
              </Box>
            ))}
          </Box>
        </Card>

        {/* Preferences */}
        <Card sx={{ mb: 2 }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Preferences</Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Currency</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Used across dashboard and bills</Typography>
            </Box>
            <Select
              value={settings.currency}
              onChange={e => updateSettings({ currency: e.target.value as 'USD' | 'INR' })}
              size="small"
              sx={{ minWidth: 100, fontSize: '0.85rem' }}
            >
              <MenuItem value="USD">USD ($)</MenuItem>
              <MenuItem value="INR">INR (₹)</MenuItem>
            </Select>
          </Box>



          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Accent Color</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {WS_COLORS.map(c => (
                <Box
                  key={c}
                  onClick={() => updateSettings({ theme_color: c })}
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    border: settings.theme_color === c ? '3px solid #fff' : '3px solid transparent',
                    transition: 'transform 0.2s, border 0.2s',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                />
              ))}
            </Box>
          </Box>
        </Card>

        {/* Workspaces */}
        <Card sx={{ mb: 2 }}>
          <Box sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WorkspacesRoundedIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Workspaces</Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={() => { setEditWs({ name: '', color: WS_COLORS[0] }); setWsDialog(true); }}
            >
              New
            </Button>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <List disablePadding>
            {workspaces.map((ws, i) => (
              <React.Fragment key={ws.id}>
                {i > 0 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />}
                <ListItem
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => { setEditWs({ id: ws.id, name: ws.name, color: ws.color }); setWsDialog(true); }}>
                        <EditRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      {workspaces.length > 1 && (
                        <IconButton size="small" onClick={() => setDeleteConfirm(ws.id)}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: '#F87171' }} />
                        </IconButton>
                      )}
                    </Box>
                  }
                >
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: ws.color, fontSize: '0.8rem', fontWeight: 700 }}>
                      {ws.name?.[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={ws.name}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                    secondary={ws.id === activeWorkspace?.id ? 'Active' : undefined}
                    secondaryTypographyProps={{ fontSize: '0.72rem', color: 'primary.light' }}
                  />
                  {ws.id !== activeWorkspace?.id && (
                    <Button size="small" variant="outlined" onClick={() => switchWorkspace(ws.id)} sx={{ mr: 5, fontSize: '0.72rem', py: 0.25 }}>
                      Switch
                    </Button>
                  )}
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Card>

        {/* Data */}
        <Card>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Data</Typography>
          </Box>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ p: 2 }}>
            <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
              All data is stored securely in the cloud and persists across devices.
            </Alert>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => {
                if (window.confirm('Export workspace data as JSON?')) {
                  const data = { tasks, clients, payments, settings };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `workspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }
              }}
            >
              Export Backup
            </Button>
          </Box>
        </Card>

        {/* Workspace dialog */}
        <Dialog open={wsDialog} onClose={() => { setWsDialog(false); setEditWs(null); }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>
            {editWs?.id ? 'Edit Workspace' : 'New Workspace'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Workspace Name"
              fullWidth
              value={editWs?.name ?? ''}
              onChange={e => setEditWs(prev => prev ? { ...prev, name: e.target.value } : null)}
              autoFocus
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>Color</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {WS_COLORS.map(c => (
                  <Box
                    key={c}
                    onClick={() => setEditWs(prev => prev ? { ...prev, color: c } : null)}
                    sx={{
                      width: 32, height: 32, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: editWs?.color === c ? '3px solid #fff' : '3px solid transparent',
                      transition: 'transform 0.15s',
                      '&:hover': { transform: 'scale(1.1)' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setWsDialog(false); setEditWs(null); }}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveWs} disabled={!editWs?.name.trim()}>
              {editWs?.id ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete workspace confirm */}
        <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: '#F87171' }}>Delete Workspace?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will permanently delete the workspace and all its tasks, clients, and payments.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={async () => {
              if (deleteConfirm) { await deleteWorkspace(deleteConfirm); setDeleteConfirm(null); }
            }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}
