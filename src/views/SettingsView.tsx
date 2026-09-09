import React, { useState, useRef } from 'react';
import {
  Box, Card, Typography, Button, Select, MenuItem, Divider, Fade,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Avatar, IconButton, Alert, List, ListItem,
  ListItemAvatar, ListItemText, Chip, Snackbar, ButtonBase,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import NightsStayRoundedIcon from '@mui/icons-material/NightsStayRounded';
import Brightness4RoundedIcon from '@mui/icons-material/Brightness4Rounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import AirRoundedIcon from '@mui/icons-material/AirRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../lib/storage';
import type { WorkspaceType, ThemeStyle } from '../types';

const WS_COLORS = ['#818CF8', '#34D399', '#F59E0B', '#F87171', '#A78BFA', '#60A5FA', '#FB7185', '#4ADE80'];

const BATCHFLOW_SQL = `-- 1. Ensure type column exists on workspaces table
alter table public.workspaces add column if not exists type text default 'freelance';

-- 2. BatchFlow Clients Table
create table if not exists public.batchflow_clients (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text default '#818CF8',
  instagram_id text,
  archived integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. BatchFlow Batches Table
create table if not exists public.batchflow_batches (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  client_id text references public.batchflow_clients(id) on delete cascade not null,
  name text not null,
  shoot_date text not null,
  script text default '',
  archived integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4. BatchFlow Videos Table
create table if not exists public.batchflow_videos (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  batch_id text references public.batchflow_batches(id) on delete cascade not null,
  name text not null,
  script_number integer default 1,
  status text default 'Pending',
  waiting_date text,
  edited_date text,
  posted_date text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. Row Level Security
alter table public.batchflow_clients enable row level security;
alter table public.batchflow_batches enable row level security;
alter table public.batchflow_videos enable row level security;

drop policy if exists "Batchflow clients access policy" on public.batchflow_clients;
create policy "Batchflow clients access policy" on public.batchflow_clients
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Batchflow batches access policy" on public.batchflow_batches;
create policy "Batchflow batches access policy" on public.batchflow_batches
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Batchflow videos access policy" on public.batchflow_videos;
create policy "Batchflow videos access policy" on public.batchflow_videos
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));`;

const THEMES: { id: ThemeStyle; name: string; tag: string; desc: string; bg: string; card: string; accent: string; isLight?: boolean; icon: React.ReactNode }[] = [
  // 4 Dark Themes
  {
    id: 'default',
    name: 'Current (Default)',
    tag: 'Navy Slate',
    desc: 'Deep midnight navy with subtle borders and clear contrast',
    bg: '#080C14',
    card: '#111827',
    accent: '#818CF8',
    icon: <Brightness4RoundedIcon fontSize="small" />,
  },
  {
    id: 'soft',
    name: 'Soft Dark',
    tag: 'Warm Charcoal',
    desc: 'Gentle charcoal and zinc tones engineered for low eyestrain',
    bg: '#141822',
    card: '#1D2330',
    accent: '#38BDF8',
    icon: <NightsStayRoundedIcon fontSize="small" />,
  },
  {
    id: 'dark',
    name: 'Pitch Black',
    tag: 'OLED Pure Black',
    desc: 'Pure OLED black background with crisp high-contrast cards',
    bg: '#000000',
    card: '#0B0B0B',
    accent: '#F43F5E',
    icon: <DarkModeRoundedIcon fontSize="small" />,
  },
  {
    id: 'smooth',
    name: 'Smooth Violet',
    tag: 'Glassmorphism',
    desc: 'Midnight violet glass with blurred surfaces & purple glows',
    bg: '#0C0C1A',
    card: '#151528',
    accent: '#A78BFA',
    icon: <AutoAwesomeRoundedIcon fontSize="small" />,
  },
  // 3 Light Themes
  {
    id: 'light',
    name: 'Pure Light',
    tag: 'Clean Minimal',
    desc: 'Crisp white canvas with soft slate borders and clean typography',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    accent: '#4F46E5',
    isLight: true,
    icon: <LightModeRoundedIcon fontSize="small" />,
  },
  {
    id: 'warm-light',
    name: 'Warm Sand',
    tag: 'Paper & Ivory',
    desc: 'Gentle warm cream palette inspired by fine paper for easy reading',
    bg: '#FAF7F2',
    card: '#FFFFFF',
    accent: '#D97706',
    isLight: true,
    icon: <WbSunnyRoundedIcon fontSize="small" />,
  },
  {
    id: 'cool-light',
    name: 'Nordic Sky',
    tag: 'Fresh Sky Blue',
    desc: 'Crisp arctic sky and ice-tinted surfaces with modern blue accents',
    bg: '#F0F9FF',
    card: '#FFFFFF',
    accent: '#0284C7',
    isLight: true,
    icon: <AirRoundedIcon fontSize="small" />,
  },
];

export default function SettingsView() {
  const { user } = useAuth();
  const {
    settings, updateSettings, workspaces, activeWorkspace, createWorkspace,
    updateWorkspace, deleteWorkspace, switchWorkspace, tasks, clients,
    payments, discounts, salaryRates, batchflowClients, batchflowBatches,
    batchflowVideos, importBackupData,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [wsDialog, setWsDialog] = useState(false);
  const [editWs, setEditWs] = useState<{ id?: string; name: string; color: string; type?: WorkspaceType } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Backup import dialog state
  const [importDialog, setImportDialog] = useState<{
    open: boolean;
    fileName: string;
    fileContent: any;
    summary: string;
  }>({
    open: false,
    fileName: '',
    fileContent: null,
    summary: '',
  });

  const [importing, setImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isBatchflow = activeWorkspace?.type === 'batchflow';

  const handleSaveWs = async () => {
    if (!editWs?.name.trim()) return;
    const targetType = editWs.type || 'freelance';
    if (editWs.id) {
      storage.setWorkspaceType(editWs.id, targetType);
      await updateWorkspace(editWs.id, { name: editWs.name, color: editWs.color, type: targetType });
    } else {
      await createWorkspace(editWs.name, editWs.color, targetType);
    }
    setWsDialog(false);
    setEditWs(null);
  };

  const handleExportBackup = () => {
    if (isBatchflow) {
      const data = {
        version: '2.0',
        workspace_type: 'batchflow',
        workspace_name: activeWorkspace?.name || 'BatchFlow',
        exported_at: new Date().toISOString(),
        clients: batchflowClients,
        batches: batchflowBatches,
        videos: batchflowVideos,
        settings,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `batchflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } else {
      const data = {
        version: '2.0',
        workspace_type: 'freelance',
        workspace_name: activeWorkspace?.name || 'Freelance',
        exported_at: new Date().toISOString(),
        tasks,
        clients,
        payments,
        discounts,
        salaryRates,
        settings,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `trackrr_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Summarize content
        const summaryParts: string[] = [];
        if (Array.isArray(parsed.tasks)) summaryParts.push(`${parsed.tasks.length} tasks`);
        if (Array.isArray(parsed.clients)) summaryParts.push(`${parsed.clients.length} clients`);
        if (Array.isArray(parsed.payments)) summaryParts.push(`${parsed.payments.length} payments`);
        if (Array.isArray(parsed.discounts)) summaryParts.push(`${parsed.discounts.length} discounts`);
        if (Array.isArray(parsed.batches)) summaryParts.push(`${parsed.batches.length} batches`);
        if (Array.isArray(parsed.videos)) summaryParts.push(`${parsed.videos.length} videos`);

        const summaryText = summaryParts.length > 0
          ? `Detected: ${summaryParts.join(', ')}`
          : 'Valid JSON backup file detected.';

        setImportDialog({
          open: true,
          fileName: file.name,
          fileContent: parsed,
          summary: summaryText,
        });
      } catch {
        alert('Invalid JSON backup file. Please select a valid Trackrr or BatchFlow backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importDialog.fileContent) return;
    setImporting(true);
    try {
      const res = await importBackupData(importDialog.fileContent);
      setToastMessage(res.message);
      setImportDialog({ open: false, fileName: '', fileContent: null, summary: '' });
    } catch (err: any) {
      alert(`Import failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  };

  const renderThemeCard = (th: typeof THEMES[0]) => {
    const isActive = (settings.theme_style || 'default') === th.id;
    return (
      <Box
        key={th.id}
        onClick={() => updateSettings({ theme_style: th.id })}
        sx={{
          p: 2,
          borderRadius: 2.5,
          border: '2px solid',
          borderColor: isActive ? 'primary.main' : (th.isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'),
          bgcolor: th.card,
          color: th.isLight ? '#0F172A' : '#F1F5F9',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isActive ? `0 0 16px ${th.accent}30` : (th.isLight ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'),
          '&:hover': {
            borderColor: isActive ? 'primary.main' : (th.isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)'),
            transform: 'translateY(-2px)',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: th.accent }}>{th.icon}</Box>
            <Typography variant="body1" sx={{ fontWeight: 700, fontSize: '0.92rem', color: th.isLight ? '#0F172A' : '#F1F5F9' }}>
              {th.name}
            </Typography>
          </Box>
          {isActive ? (
            <Chip label="Active" size="small" color="primary" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
          ) : (
            <Chip
              label={th.tag}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.62rem',
                fontWeight: 600,
                bgcolor: th.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
                color: th.isLight ? '#475569' : '#94A3B8',
              }}
            />
          )}
        </Box>
        <Typography variant="caption" sx={{ color: th.isLight ? '#64748B' : '#94A3B8', display: 'block', lineHeight: 1.4, mb: 1.5 }}>
          {th.desc}
        </Typography>

        {/* Visual Preview Swatches */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: th.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.3)', px: 1, py: 0.5, borderRadius: 1.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: th.bg, border: '1px solid rgba(0,0,0,0.15)' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: th.card, border: '1px solid rgba(0,0,0,0.15)' }} />
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: th.accent }} />
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Fade in timeout={400}>
      <Box sx={{ pb: 4, maxWidth: 900, mx: 'auto' }}>
        {/* Workspace Overview Banner */}
        <Card sx={{ p: 2.5, mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Workspace Overview</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Active: <strong>{activeWorkspace?.name}</strong> ({isBatchflow ? '🎬 BatchFlow Workspace' : '💼 Freelance Workspace'})
              </Typography>
            </Box>
            <Chip
              label={isBatchflow ? 'BatchFlow Mode' : 'Freelance Mode'}
              color={isBatchflow ? 'secondary' : 'primary'}
              size="small"
              sx={{ fontWeight: 700 }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {isBatchflow ? (
              [
                { label: 'Batches', value: batchflowBatches.length, color: '#F472B6' },
                { label: 'Clients', value: batchflowClients.length, color: '#38BDF8' },
                { label: 'Videos', value: batchflowVideos.length, color: '#34D399' },
              ].map(s => (
                <Box key={s.label} sx={{ flex: '1 1 calc(33% - 10px)', minWidth: 100, textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600 }}>{s.label}</Typography>
                </Box>
              ))
            ) : (
              [
                { label: 'Tasks', value: tasks.length, color: '#818CF8' },
                { label: 'Clients', value: clients.length, color: '#34D399' },
                { label: 'Payments', value: payments.length, color: '#FBBF24' },
              ].map(s => (
                <Box key={s.label} sx={{ flex: '1 1 calc(33% - 10px)', minWidth: 100, textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600 }}>{s.label}</Typography>
                </Box>
              ))
            )}
          </Box>
        </Card>

        {/* Theme & Visual Appearance */}
        <Card sx={{ mb: 2.5, p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PaletteRoundedIcon sx={{ color: 'primary.main', fontSize: 22 }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Theme & Appearance</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2.5 }}>
            Choose from 7 crafted themes (4 Dark, 3 Light) or customize your primary accent color
          </Typography>

          {/* Dark Themes */}
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🌙 Dark Themes
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
            {THEMES.filter(t => !t.isLight).map(th => renderThemeCard(th))}
          </Box>

          {/* Light Themes */}
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ☀️ Light Themes (New)
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
            {THEMES.filter(t => t.isLight).map(th => renderThemeCard(th))}
          </Box>

          <Divider sx={{ my: 2.5, borderColor: 'divider' }} />

          {/* Accent Color */}
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Accent Color</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Primary tint for buttons, active indicators, and highlights
                </Typography>
              </Box>
              {(!settings.theme_color || settings.theme_color === 'auto') && (
                <Chip
                  icon={<AutoAwesomeRoundedIcon sx={{ fontSize: '13px !important' }} />}
                  label="Adapts to Theme"
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.68rem', height: 22, fontWeight: 700 }}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Auto Option */}
              <ButtonBase
                onClick={() => updateSettings({ theme_color: 'auto' })}
                sx={{
                  height: 32,
                  px: 1.5,
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: (!settings.theme_color || settings.theme_color === 'auto') ? 'primary.main' : 'divider',
                  bgcolor: (!settings.theme_color || settings.theme_color === 'auto') ? 'rgba(129,140,248,0.15)' : 'action.hover',
                  color: (!settings.theme_color || settings.theme_color === 'auto') ? 'primary.main' : 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  transition: 'all 0.15s ease',
                  '&:hover': { borderColor: 'primary.light', transform: 'translateY(-1px)' },
                }}
              >
                <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: (!settings.theme_color || settings.theme_color === 'auto') ? 'primary.main' : 'text.secondary' }} />
                Auto
              </ButtonBase>

              {/* Color Swatches */}
              {WS_COLORS.map(c => {
                const isSelected = settings.theme_color === c;
                return (
                  <Box
                    key={c}
                    onClick={() => updateSettings({ theme_color: c })}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: c,
                      cursor: 'pointer',
                      border: isSelected ? '3px solid #fff' : '3px solid transparent',
                      boxShadow: isSelected ? '0 0 10px rgba(0,0,0,0.3)' : 'none',
                      transition: 'transform 0.2s, border 0.2s',
                      '&:hover': { transform: 'scale(1.15)' },
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          <Divider sx={{ my: 2, borderColor: 'divider' }} />

          {/* Currency Preference */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Currency Symbol</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Used across revenue, video rates, and bills</Typography>
            </Box>
            <Select
              value={settings.currency || 'INR'}
              onChange={e => updateSettings({ currency: e.target.value as 'USD' | 'INR' })}
              size="small"
              sx={{ minWidth: 130, fontSize: '0.85rem' }}
            >
              <MenuItem value="INR">INR (₹) - Default</MenuItem>
              <MenuItem value="USD">USD ($)</MenuItem>
            </Select>
          </Box>
        </Card>

        {/* Workspaces Management */}
        <Card sx={{ mb: 2.5, p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WorkspacesRoundedIcon sx={{ color: 'primary.main', fontSize: 22 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Workspaces ({workspaces.length})</Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => { setEditWs({ name: '', color: WS_COLORS[0], type: 'freelance' }); setWsDialog(true); }}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              New Workspace
            </Button>
          </Box>

          <List disablePadding>
            {workspaces.map((ws, i) => {
              const isOwner = !ws.user_id || !user || ws.user_id === user.id;
              const isWsBatch = ws.type === 'batchflow';
              return (
                <React.Fragment key={ws.id}>
                  {i > 0 && <Divider sx={{ borderColor: 'divider' }} />}
                  <ListItem
                    sx={{ px: 1, py: 1.25, borderRadius: 2 }}
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {ws.id !== activeWorkspace?.id && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => switchWorkspace(ws.id)}
                            sx={{ fontSize: '0.75rem', py: 0.25, px: 1.5, textTransform: 'none', fontWeight: 600 }}
                          >
                            Switch
                          </Button>
                        )}
                        {isOwner && (
                          <IconButton size="small" onClick={() => { setEditWs({ id: ws.id, name: ws.name, color: ws.color, type: ws.type }); setWsDialog(true); }}>
                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        )}
                        {isOwner && workspaces.length > 1 && (
                          <IconButton size="small" onClick={() => setDeleteConfirm(ws.id)}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: '#F87171' }} />
                          </IconButton>
                        )}
                      </Box>
                    }
                  >
                    <ListItemAvatar sx={{ minWidth: 44 }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: ws.color, fontSize: '0.85rem', fontWeight: 700 }}>
                        {isWsBatch ? '🎬' : (ws.name?.[0]?.toUpperCase() || 'W')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{ws.name}</Typography>
                          <Chip
                            label={isWsBatch ? '🎬 BatchFlow' : '💼 Freelance'}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              bgcolor: isWsBatch ? 'rgba(244,114,182,0.15)' : 'rgba(129,140,248,0.15)',
                              color: isWsBatch ? '#F472B6' : '#818CF8',
                            }}
                          />
                        </Box>
                      }
                      secondary={ws.id === activeWorkspace?.id ? 'Currently Active' : undefined}
                      secondaryTypographyProps={{ fontSize: '0.72rem', color: 'primary.light', fontWeight: 600 }}
                    />
                  </ListItem>
                </React.Fragment>
              );
            })}
          </List>
        </Card>

        {/* Data Backup & Restore */}
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Backup & Data Management</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
            Safely export your data to a JSON file or import a previous backup from Trackrr or BatchFlow.
          </Typography>

          <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.8rem' }}>
            Backups are stored offline on your device in standard JSON format. Importing merges data safely into your active workspace without duplicate ID conflicts.
          </Alert>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {/* Export Backup Button */}
            <Button
              variant="contained"
              color="primary"
              size="medium"
              startIcon={<FileDownloadRoundedIcon />}
              onClick={handleExportBackup}
              sx={{ textTransform: 'none', fontWeight: 700, px: 2.5 }}
            >
              Export Backup (JSON)
            </Button>

            {/* Import Backup Button */}
            <Button
              variant="outlined"
              color="inherit"
              size="medium"
              startIcon={<FileUploadRoundedIcon />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ textTransform: 'none', fontWeight: 700, px: 2.5, borderColor: 'divider' }}
            >
              Import Backup (JSON)
            </Button>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </Box>
        </Card>

        {/* Supabase Cloud Database Setup */}
        <Card sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageRoundedIcon sx={{ color: 'primary.main' }} />
            Supabase Cloud Setup for BatchFlow
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
            Run this one-time SQL migration in your Supabase SQL editor to enable cloud backup for BatchFlow clients, batches, and videos.
          </Typography>

          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
            Even without running this SQL, your BatchFlow workspace data is stored locally and safely persists across reloads. Running this SQL enables full cloud sync across devices.
          </Alert>

          <Button
            variant="outlined"
            color="primary"
            size="medium"
            startIcon={<ContentCopyRoundedIcon />}
            onClick={() => {
              navigator.clipboard.writeText(BATCHFLOW_SQL);
              setToastMessage('BatchFlow SQL copied to clipboard! Paste into Supabase SQL editor and run.');
            }}
            sx={{ textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            Copy BatchFlow SQL Migration
          </Button>
        </Card>

        {/* Workspace Dialog (Create / Edit) */}
        <Dialog open={wsDialog} onClose={() => { setWsDialog(false); setEditWs(null); }} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>
            {editWs?.id ? 'Edit Workspace' : 'Create New Workspace'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1.5 }}>
            <TextField
              label="Workspace Name"
              fullWidth
              value={editWs?.name ?? ''}
              onChange={e => setEditWs(prev => prev ? { ...prev, name: e.target.value } : null)}
              autoFocus
              placeholder="e.g. Acme Video Agency"
            />

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>Workspace Type</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Box
                  onClick={() => setEditWs(prev => prev ? { ...prev, type: 'freelance' } : null)}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: editWs?.type === 'freelance' ? 'primary.main' : 'divider',
                    bgcolor: editWs?.type === 'freelance' ? 'rgba(129,140,248,0.12)' : 'action.hover',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>💼 Freelance</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.68rem', mt: 0.25 }}>
                    Video pricing, monthly salary & bills
                  </Typography>
                </Box>

                <Box
                  onClick={() => setEditWs(prev => prev ? { ...prev, type: 'batchflow' } : null)}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: editWs?.type === 'batchflow' ? '#F472B6' : 'divider',
                    bgcolor: editWs?.type === 'batchflow' ? 'rgba(244,114,182,0.12)' : 'action.hover',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 800, color: editWs?.type === 'batchflow' ? '#F472B6' : 'inherit' }}>
                    🎬 BatchFlow
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.68rem', mt: 0.25 }}>
                    Batches, script parser & pipeline
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>Color Theme</Typography>
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
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => { setWsDialog(false); setEditWs(null); }}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveWs} disabled={!editWs?.name.trim()}>
              {editWs?.id ? 'Save Changes' : 'Create Workspace'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Workspace Confirmation */}
        <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, color: '#F87171' }}>Delete Workspace?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will permanently delete this workspace and all associated tasks, clients, batches, and records.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={async () => {
              if (deleteConfirm) { await deleteWorkspace(deleteConfirm); setDeleteConfirm(null); }
            }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Import Backup Confirmation Dialog */}
        <Dialog open={importDialog.open} onClose={() => setImportDialog(prev => ({ ...prev, open: false }))} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileUploadRoundedIcon color="primary" />
            Import Backup File
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2">
              Ready to import data from:
            </Typography>
            <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{importDialog.fileName}</Typography>
              <Typography variant="caption" sx={{ color: 'primary.light', display: 'block', mt: 0.5 }}>
                {importDialog.summary}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
              Items will be safely mapped to your active workspace (<strong>{activeWorkspace?.name}</strong>).
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setImportDialog(prev => ({ ...prev, open: false }))} disabled={importing}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleConfirmImport} disabled={importing} startIcon={<CheckCircleRoundedIcon />}>
              {importing ? 'Importing…' : 'Confirm Import'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast Snackbar for Success Notification */}
        <Snackbar
          open={!!toastMessage}
          autoHideDuration={4000}
          onClose={() => setToastMessage(null)}
          message={toastMessage}
        />
      </Box>
    </Fade>
  );
}
