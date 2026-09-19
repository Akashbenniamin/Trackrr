import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Card, Typography, Button, Select, MenuItem, Divider, Fade,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Avatar, IconButton, Alert, List, ListItem,
  ListItemAvatar, ListItemText, Chip, Snackbar, ButtonBase,
  CircularProgress, InputAdornment, Accordion, AccordionSummary, AccordionDetails,
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
import AcUnitRoundedIcon from '@mui/icons-material/AcUnitRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import MovieCreationRoundedIcon from '@mui/icons-material/MovieCreationRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../lib/storage';
import {
  fetchVideoMetadata,
  resolveInstagramBusinessAccountId,
  type VideoMetadataResult,
} from '../lib/videoMetadata';
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
  description text default '',
  status text default 'Pending',
  video_url text,
  views text,
  likes text,
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
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

-- 6. Video URLs, Views, Likes, & Descriptions Schema Extension
alter table public.batchflow_videos add column if not exists script_number integer default 1;
alter table public.batchflow_videos add column if not exists video_url text;
alter table public.batchflow_videos add column if not exists views text;
alter table public.batchflow_videos add column if not exists likes text;
alter table public.batchflow_videos add column if not exists description text;
alter table public.settings add column if not exists meta_app_id text;
alter table public.settings add column if not exists meta_client_token text;
alter table public.settings add column if not exists meta_user_token text;
alter table public.settings add column if not exists meta_ig_user_id text;`;

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
  {
    id: 'frosted-glass',
    name: 'Frosted Glass',
    tag: 'Neo-Frost',
    desc: 'Cool icy-blue frosted glass with translucent surfaces & navy accents',
    bg: '#D8E5F3',
    card: 'rgba(255, 255, 255, 0.75)',
    accent: '#1C293E',
    isLight: true,
    icon: <AcUnitRoundedIcon fontSize="small" />,
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

  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>(activeWorkspace?.id || '');

  const [importing, setImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isBatchflow = activeWorkspace?.type === 'batchflow';

  // Meta / Instagram API Credentials State
  const [metaAppId, setMetaAppId] = useState(settings.meta_app_id || '');
  const [metaClientToken, setMetaClientToken] = useState(settings.meta_client_token || '');
  const [metaUserToken, setMetaUserToken] = useState(settings.meta_user_token || '');
  const [metaIgUserId, setMetaIgUserId] = useState(settings.meta_ig_user_id || '');
  const [showTokens, setShowTokens] = useState(false);
  const [detectingIgId, setDetectingIgId] = useState(false);

  // Keep state in sync if settings update from cloud
  useEffect(() => {
    if (settings.meta_app_id !== undefined) setMetaAppId(settings.meta_app_id || '');
    if (settings.meta_client_token !== undefined) setMetaClientToken(settings.meta_client_token || '');
    if (settings.meta_user_token !== undefined) setMetaUserToken(settings.meta_user_token || '');
    if (settings.meta_ig_user_id !== undefined) setMetaIgUserId(settings.meta_ig_user_id || '');
  }, [settings.meta_app_id, settings.meta_client_token, settings.meta_user_token, settings.meta_ig_user_id]);

  // Test Link Fetch State
  const [metaTestUrl, setMetaTestUrl] = useState('');
  const [metaTestHandle, setMetaTestHandle] = useState('');
  const [metaTesting, setMetaTesting] = useState(false);
  const [metaTestResult, setMetaTestResult] = useState<VideoMetadataResult | null>(null);

  const handleSaveMetaCredentials = async () => {
    const cleanAppId = metaAppId.trim();
    const cleanClientToken = metaClientToken.trim();
    const cleanUserToken = metaUserToken.trim();
    const cleanIgUserId = metaIgUserId.trim();

    await updateSettings({
      meta_app_id: cleanAppId,
      meta_client_token: cleanClientToken,
      meta_user_token: cleanUserToken,
      meta_ig_user_id: cleanIgUserId,
    });

    setToastMessage('Meta & Instagram API credentials saved successfully!');
  };

  const handleClearMetaCredentials = async () => {
    setMetaAppId('');
    setMetaClientToken('');
    setMetaUserToken('');
    setMetaIgUserId('');

    await updateSettings({
      meta_app_id: '',
      meta_client_token: '',
      meta_user_token: '',
      meta_ig_user_id: '',
    });

    setToastMessage('Meta & Instagram credentials cleared.');
  };

  const handleAutoDetectIgId = async () => {
    const token = metaUserToken.trim() || settings.meta_user_token?.trim();
    if (!token) {
      setToastMessage('Please paste your Meta User Access Token first.');
      return;
    }

    setDetectingIgId(true);
    try {
      const res = await resolveInstagramBusinessAccountId(token);
      if (res?.id) {
        setMetaIgUserId(res.id);
        await updateSettings({ meta_ig_user_id: res.id });
        setToastMessage(`Connected to Instagram: @${res.username || 'business'} (ID: ${res.id})! Saved.`);
      } else {
        alert(res?.error || 'Could not find a linked Instagram Business/Creator Account. Make sure your Facebook Page is linked to your Instagram Professional Account and the token includes instagram_basic and pages_show_list permissions.');
      }
    } catch (err: any) {
      alert(`Auto-detection error: ${err?.message || 'Network error'}`);
    } finally {
      setDetectingIgId(false);
    }
  };

  const handleTestMetaApi = async () => {
    const raw = metaTestUrl.trim();
    if (!raw) return;

    setMetaTesting(true);
    setMetaTestResult(null);

    try {
      const res = await fetchVideoMetadata(raw, {
        metaAppId: metaAppId.trim() || settings.meta_app_id,
        metaClientToken: metaClientToken.trim() || settings.meta_client_token,
        metaUserToken: metaUserToken.trim() || settings.meta_user_token,
        metaIgUserId: metaIgUserId.trim() || settings.meta_ig_user_id,
        clientHandle: metaTestHandle.trim() || undefined,
      });
      setMetaTestResult(res);
    } catch (err: any) {
      setMetaTestResult({
        provider: 'other',
        error: err?.message || 'Failed to fetch video metadata',
      });
    } finally {
      setMetaTesting(false);
    }
  };

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
    const isBf = activeWorkspace?.type === 'batchflow';
    const now = new Date().toISOString();

    if (isBf) {
      // Export Batchflow Data for current workspace
      const currentClients = batchflowClients.filter(c => c.workspace_id === activeWorkspace?.id);
      const currentBatches = batchflowBatches.filter(b => b.workspace_id === activeWorkspace?.id);
      const currentVideos = batchflowVideos.filter(v => v.workspace_id === activeWorkspace?.id);

      const backupData = {
        version: '1.0',
        workspace_type: 'batchflow',
        workspace_name: activeWorkspace?.name,
        exported_at: now,
        clients: currentClients,
        batches: currentBatches,
        videos: currentVideos,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batchflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Export Freelance Tracker Data
      const currentClients = clients.filter(c => c.workspace_id === activeWorkspace?.id);
      const currentTasks = tasks.filter(t => t.workspace_id === activeWorkspace?.id);
      const currentPayments = payments.filter(p => p.workspace_id === activeWorkspace?.id);
      const currentDiscounts = discounts.filter(d => d.workspace_id === activeWorkspace?.id);

      const backupData = {
        version: '1.0',
        workspace_type: 'freelance',
        workspace_name: activeWorkspace?.name,
        exported_at: now,
        clients: currentClients,
        tasks: currentTasks,
        payments: currentPayments,
        discounts: currentDiscounts,
        salaryRates,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trackrr_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const processJsonData = (parsed: any, sourceName: string) => {
    const summaryParts: string[] = [];
    if (Array.isArray(parsed.tasks)) summaryParts.push(`${parsed.tasks.length} tasks`);
    if (Array.isArray(parsed.clients)) summaryParts.push(`${parsed.clients.length} clients`);
    if (Array.isArray(parsed.payments)) summaryParts.push(`${parsed.payments.length} payments`);
    if (Array.isArray(parsed.discounts)) summaryParts.push(`${parsed.discounts.length} discounts`);
    if (Array.isArray(parsed.batches)) summaryParts.push(`${parsed.batches.length} batches`);
    if (Array.isArray(parsed.videos)) summaryParts.push(`${parsed.videos.length} videos`);

    const summaryText = summaryParts.length > 0
      ? `Detected: ${summaryParts.join(', ')}`
      : 'Valid JSON backup detected.';

    // Auto-detect best target workspace
    const hasBatchflowData = Boolean(
      (Array.isArray(parsed.batches) && parsed.batches.length) ||
      (Array.isArray(parsed.videos) && parsed.videos.length)
    );
    if (hasBatchflowData && activeWorkspace?.type !== 'batchflow') {
      const bfWs = workspaces.find(w => w.type === 'batchflow');
      setTargetWorkspaceId(bfWs ? bfWs.id : (activeWorkspace?.id || ''));
    } else {
      setTargetWorkspaceId(activeWorkspace?.id || '');
    }

    setImportDialog({
      open: true,
      fileName: sourceName,
      fileContent: parsed,
      summary: summaryText,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        processJsonData(parsed, file.name);
      } catch {
        alert('Invalid JSON backup file. Please select a valid Trackrr or BatchFlow backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteJsonSubmit = () => {
    if (!rawJsonInput.trim()) return;
    try {
      const parsed = JSON.parse(rawJsonInput.trim());
      processJsonData(parsed, 'Pasted Raw JSON');
      setPasteDialogOpen(false);
      setRawJsonInput('');
    } catch (err: any) {
      alert(`Invalid JSON: ${err?.message || 'Check JSON syntax'}`);
    }
  };

  const handleConfirmImport = async () => {
    if (!importDialog.fileContent) return;
    setImporting(true);
    try {
      if (targetWorkspaceId && targetWorkspaceId !== activeWorkspace?.id) {
        await switchWorkspace(targetWorkspaceId);
      }
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
      <ButtonBase
        key={th.id}
        onClick={() => updateSettings({ theme_style: th.id })}
        sx={{
          width: '100%',
          display: 'block',
          textAlign: 'left',
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            p: 1.1,
            px: 1.25,
            borderRadius: 2,
            border: '1.5px solid',
            borderColor: isActive ? 'primary.main' : (th.isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'),
            bgcolor: th.card,
            color: th.isLight ? '#0F172A' : '#F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            transition: 'all 0.18s ease',
            position: 'relative',
            boxShadow: isActive ? `0 0 12px ${th.accent}30` : (th.isLight ? '0 1px 2px rgba(0,0,0,0.04)' : 'none'),
            '&:hover': {
              borderColor: isActive ? 'primary.main' : (th.isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.22)'),
              transform: 'translateY(-1px)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0 }}>
            {/* Color swatch dot pill */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.35,
                p: 0.4,
                borderRadius: 1.5,
                bgcolor: th.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.35)',
                border: '1px solid',
                borderColor: th.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)',
                flexShrink: 0,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: th.bg, border: '1px solid rgba(0,0,0,0.12)' }} />
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: th.accent }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.8rem',
                  color: th.isLight ? '#0F172A' : '#F1F5F9',
                  lineHeight: 1.2,
                }}
              >
                {th.name}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  color: th.isLight ? '#64748B' : '#94A3B8',
                  fontSize: '0.66rem',
                  display: 'block',
                }}
              >
                {th.tag}
              </Typography>
            </Box>
          </Box>
          {isActive ? (
            <CheckCircleRoundedIcon sx={{ color: 'primary.main', fontSize: 17, flexShrink: 0 }} />
          ) : (
            <Box sx={{ color: th.accent, opacity: 0.65, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {th.icon}
            </Box>
          )}
        </Box>
      </ButtonBase>
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
                Active: <strong>{activeWorkspace?.name}</strong> ({isBatchflow ? 'BatchFlow Workspace' : 'Freelance Workspace'})
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
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
            Choose from 8 crafted themes (4 Dark, 4 Light) or customize your primary accent color
          </Typography>

          {/* Dark Themes */}
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🌙 Dark Themes
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2.5 }}>
            {THEMES.filter(t => !t.isLight).map(th => renderThemeCard(th))}
          </Box>

          {/* Light Themes */}
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ☀️ Light Themes
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2.5 }}>
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
                        {isWsBatch ? <MovieCreationRoundedIcon sx={{ fontSize: 18 }} /> : (ws.name?.[0]?.toUpperCase() || 'W')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{ws.name}</Typography>
                          <Chip
                            label={isWsBatch ? 'BatchFlow' : 'Freelance'}
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
        <Card sx={{ p: 2.5, mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileDownloadRoundedIcon sx={{ color: 'primary.main', fontSize: 22 }} />
            Backup & Data Management
          </Typography>
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
              sx={{ textTransform: 'none', fontWeight: 700, px: 2.5, borderColor: 'divider', borderRadius: 1 }}
            >
              Import Backup (JSON)
            </Button>

            {/* Paste Raw JSON Button */}
            <Button
              variant="outlined"
              color="inherit"
              size="medium"
              startIcon={<DataObjectRoundedIcon />}
              onClick={() => { setRawJsonInput(''); setPasteDialogOpen(true); }}
              sx={{ textTransform: 'none', fontWeight: 700, px: 2.5, borderColor: 'divider', borderRadius: 1 }}
            >
              Paste JSON
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

        {/* Meta & Instagram Auto-Fetch Configuration */}
        <Card sx={{ p: 2.5, mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(220, 39, 67, 0.3)',
                }}
              >
                <InstagramIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  Meta & Instagram Auto-Fetch
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Auto-extract HD thumbnails, publication dates, live likes, and captions from Reels
                </Typography>
              </Box>
            </Box>

            {/* Status Chip */}
            {metaUserToken ? (
              <Chip
                label="Full Access: Business Discovery Active"
                color="success"
                size="small"
                icon={<CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} />}
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            ) : (metaAppId && metaClientToken) ? (
              <Chip
                label="Basic Access: oEmbed App Token Active"
                color="primary"
                size="small"
                icon={<CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} />}
                sx={{ fontWeight: 700, fontSize: '0.72rem' }}
              />
            ) : (
              <Chip
                label="Not Configured (Manual / Snowflake Only)"
                variant="outlined"
                size="small"
                sx={{ fontWeight: 600, fontSize: '0.72rem', color: 'text.secondary' }}
              />
            )}
          </Box>

          <Alert severity="info" sx={{ my: 2, fontSize: '0.8rem', lineHeight: 1.5 }}>
            <strong>Why Meta credentials?</strong> Instagram strictly blocks third-party scrapers with bot-protection errors.
            Connecting your official Meta credentials enables BatchFlow to reliably fetch live reel metrics (likes, HD thumbnails, captions, and dates) directly via Meta's Graph and oEmbed APIs.
          </Alert>

          {/* Credentials Inputs */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {/* Meta App ID */}
              <TextField
                label="Meta App ID"
                size="small"
                fullWidth
                placeholder="e.g. 123456789012345"
                value={metaAppId}
                onChange={e => setMetaAppId(e.target.value)}
                helperText="Found in developers.facebook.com app dashboard (Permanent)"
              />

              {/* Meta Client Token */}
              <TextField
                label="Meta Client Token"
                size="small"
                fullWidth
                type={showTokens ? 'text' : 'password'}
                placeholder="e.g. a1b2c3d4e5f6..."
                value={metaClientToken}
                onChange={e => setMetaClientToken(e.target.value)}
                helperText="Found in App Settings > Advanced > Client Token"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowTokens(!showTokens)}>
                        {showTokens ? <VisibilityOffRoundedIcon sx={{ fontSize: 16 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Meta User Access Token */}
              <TextField
                label="Meta User Access Token (Long-Lived)"
                size="small"
                fullWidth
                type={showTokens ? 'text' : 'password'}
                placeholder="e.g. EAA..."
                value={metaUserToken}
                onChange={e => setMetaUserToken(e.target.value)}
                helperText="User token with instagram_basic & pages_show_list permissions"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowTokens(!showTokens)}>
                        {showTokens ? <VisibilityOffRoundedIcon sx={{ fontSize: 16 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Connected Instagram Business Account ID */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <TextField
                  label="Instagram Account ID (Business / Creator)"
                  size="small"
                  fullWidth
                  placeholder="e.g. 178414..."
                  value={metaIgUserId}
                  onChange={e => setMetaIgUserId(e.target.value)}
                  helperText="Your linked Instagram ID (starts with 178414...)"
                />
                <Button
                  size="small"
                  variant="text"
                  startIcon={detectingIgId ? <CircularProgress size={13} /> : <SyncRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={handleAutoDetectIgId}
                  disabled={detectingIgId || !metaUserToken.trim()}
                  sx={{
                    alignSelf: 'flex-start',
                    fontSize: '0.73rem',
                    textTransform: 'none',
                    fontWeight: 700,
                    py: 0.25,
                    px: 0.75,
                    color: '#E1306C',
                  }}
                >
                  {detectingIgId ? 'Auto-detecting ID…' : '⚡ Auto-Detect ID from User Token'}
                </Button>
              </Box>
            </Box>

            {/* Save & Clear Buttons */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
              <Button
                variant="contained"
                onClick={handleSaveMetaCredentials}
                sx={{
                  background: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)',
                  '&:hover': { background: 'linear-gradient(45deg, #e6683c, #cc2366, #9c126e)' },
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 3,
                }}
              >
                Save Meta Credentials
              </Button>
              {(metaAppId || metaClientToken || metaUserToken || metaIgUserId) && (
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={handleClearMetaCredentials}
                  sx={{ textTransform: 'none', borderColor: 'divider', color: 'text.secondary' }}
                >
                  Clear Credentials
                </Button>
              )}
            </Box>
          </Box>

          {/* Test Link Fetch Section */}
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Test Video Metadata Extraction
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
              Paste any Instagram Reel URL and test thumbnail, date, likes, and caption retrieval in real-time.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="https://www.instagram.com/reel/... or https://youtube.com/..."
                value={metaTestUrl}
                onChange={e => setMetaTestUrl(e.target.value)}
                sx={{ flex: 2 }}
              />
              <TextField
                size="small"
                placeholder="Creator handle e.g. leoholidays.in (Optional)"
                value={metaTestHandle}
                onChange={e => setMetaTestHandle(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                onClick={handleTestMetaApi}
                disabled={metaTesting || !metaTestUrl.trim()}
                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 120 }}
              >
                {metaTesting ? <CircularProgress size={18} /> : 'Test Fetch'}
              </Button>
            </Box>

            {metaTestResult && (
              <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                {metaTestResult.error && !metaTestResult.postedDate && !metaTestResult.thumbnailUrl ? (
                  <Alert severity="warning" sx={{ fontSize: '0.82rem' }}>
                    {metaTestResult.error}
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircleRoundedIcon sx={{ color: '#10B981', fontSize: 18 }} />
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#10B981' }}>
                          Metadata Fetched Successfully
                        </Typography>
                      </Box>
                      <Chip
                        label={
                          metaTestResult.usedOfficialMetaApi && metaTestResult.likesCount
                            ? 'Official Meta Business Discovery (HD Thumbnail + Likes + Caption)'
                            : metaTestResult.usedOfficialMetaApi
                            ? 'Official Meta oEmbed API'
                            : 'Fallback Resolver / Snowflake'
                        }
                        size="small"
                        color={metaTestResult.usedOfficialMetaApi ? 'success' : 'default'}
                        sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
                      />
                    </Box>

                    {/* Result Content Row with Thumbnail Preview */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      {metaTestResult.thumbnailUrl && (
                        <Box
                          component="img"
                          src={metaTestResult.thumbnailUrl}
                          alt="preview"
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: 1.5,
                            objectFit: 'cover',
                            border: '1px solid rgba(255,255,255,0.15)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0, flex: 1 }}>
                        {metaTestResult.title && (
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                            {metaTestResult.title}
                          </Typography>
                        )}
                        {metaTestResult.caption && metaTestResult.caption !== metaTestResult.title && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {metaTestResult.caption}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
                          {metaTestResult.postedDate && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                              <CalendarTodayRoundedIcon sx={{ fontSize: 14 }} />
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                Date: {metaTestResult.postedDate}
                              </Typography>
                            </Box>
                          )}
                          {metaTestResult.likesCount && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#E1306C' }}>
                              <FavoriteRoundedIcon sx={{ fontSize: 14 }} />
                              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                {metaTestResult.likesCount} likes
                              </Typography>
                            </Box>
                          )}
                          {(metaTestResult.author || metaTestResult.creatorHandle) && (
                            <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 600 }}>
                              @{metaTestResult.author || metaTestResult.creatorHandle}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    {metaTestResult.metaApiError && (
                      <Alert severity="info" sx={{ mt: 1, py: 0.5, fontSize: '0.78rem' }}>
                        Meta Notice: {metaTestResult.metaApiError}
                      </Alert>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Quick Setup Instructions Accordion */}
          <Accordion
            sx={{
              bgcolor: 'action.hover',
              backgroundImage: 'none',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '8px !important',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon sx={{ fontSize: 18 }} />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HelpOutlineRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Quick Step-by-Step Setup Guide (Free)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, fontSize: '0.8rem', lineHeight: 1.6 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                1. Basic oEmbed App Credentials (Dates & Post Info, Never Expires):
              </Typography>
              <ol style={{ margin: '0 0 12px 0', paddingLeft: 20 }}>
                <li>Visit <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" style={{ color: '#38BDF8', fontWeight: 600 }}>developers.facebook.com</a> and click <strong>Create App</strong> (Type: <em>Other &gt; Business</em>).</li>
                <li>In <em>Add Products</em>, add <strong>oEmbed</strong>.</li>
                <li>Go to <strong>App Settings &gt; Basic</strong> to copy your <strong>App ID</strong>.</li>
                <li>Under <strong>App Settings &gt; Advanced</strong>, copy your <strong>Client Token</strong>.</li>
              </ol>

              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                2. User Access Token (Unlocks Live Likes, Captions & HD Thumbnails via Business Discovery):
              </Typography>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>In Meta Developer Portal, go to <strong>Tools &gt; Graph API Explorer</strong>.</li>
                <li>Select your App, add permissions <code>instagram_basic</code> and <code>pages_show_list</code>, and click <strong>Generate Access Token</strong>.</li>
                <li>Paste the token into the <strong>Meta User Access Token</strong> field above.</li>
                <li>Click <strong>⚡ Auto-Detect ID from User Token</strong> to automatically find and link your Instagram Creator Account ID!</li>
                <li>Click <strong>Save Meta Credentials</strong>.</li>
              </ol>
            </AccordionDetails>
          </Accordion>
        </Card>

        {/* Supabase Cloud Database Setup */}
        <Card sx={{ p: 2.5, mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageRoundedIcon sx={{ color: 'primary.main', fontSize: 22 }} />
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
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <WorkOutlineRoundedIcon sx={{ fontSize: 16, color: editWs?.type === 'freelance' ? 'primary.main' : 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>Freelance</Typography>
                  </Box>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <MovieCreationRoundedIcon sx={{ fontSize: 16, color: editWs?.type === 'batchflow' ? '#F472B6' : 'text.secondary' }} />
                    <Typography variant="body2" sx={{ fontWeight: 800, color: editWs?.type === 'batchflow' ? '#F472B6' : 'inherit' }}>
                      BatchFlow
                    </Typography>
                  </Box>
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
            Import Backup
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

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Target Workspace
              </Typography>
              <Select
                value={targetWorkspaceId}
                onChange={e => setTargetWorkspaceId(e.target.value)}
                size="small"
                fullWidth
              >
                {workspaces.map(w => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} ({w.type === 'batchflow' ? 'BatchFlow' : 'Freelance'})
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
              Items will be safely mapped into the selected workspace without conflicting existing IDs.
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

        {/* Paste Raw JSON Dialog */}
        <Dialog open={pasteDialogOpen} onClose={() => setPasteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <DataObjectRoundedIcon color="primary" />
            Paste JSON Backup
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Paste your raw JSON export from the old BatchFlow app or Trackrr below:
            </Typography>
            <TextField
              multiline
              rows={8}
              placeholder='{"clients": [...], "batches": [...], "videos": [...]}'
              value={rawJsonInput}
              onChange={e => setRawJsonInput(e.target.value)}
              fullWidth
              autoFocus
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setPasteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handlePasteJsonSubmit}
              disabled={!rawJsonInput.trim()}
              startIcon={<CheckCircleRoundedIcon />}
            >
              Process JSON
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
