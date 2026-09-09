import React, { useState } from 'react';
import {
  AppBar, Toolbar, Typography, BottomNavigation, BottomNavigationAction,
  Box, IconButton, Avatar, Chip, Drawer, List, ListItem,
  ListItemButton, ListItemText, ListItemAvatar, Divider, Button, Tooltip,
  Menu, MenuItem, useMediaQuery, useTheme, Badge,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import { useAuth } from '../contexts/AuthContext';
import AuthDialog from './AuthDialog';
import OfflineBanner from './OfflineBanner';
import PendingInvitesBanner from './PendingInvitesBanner';
import CollaboratorsDialog from './CollaboratorsDialog';
import { useApp } from '../contexts/AppContext';
import type { ViewName, WorkspaceType } from '../types';

const FREELANCE_NAV_ITEMS: { view: ViewName; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Home', icon: <DashboardRoundedIcon /> },
  { view: 'tasks', label: 'Tasks', icon: <VideoLibraryRoundedIcon /> },
  { view: 'analytics', label: 'Stats', icon: <BarChartRoundedIcon /> },
  { view: 'clients', label: 'Clients', icon: <PeopleRoundedIcon /> },
  { view: 'bills', label: 'Bills', icon: <ReceiptRoundedIcon /> },
  { view: 'settings', label: 'Settings', icon: <SettingsRoundedIcon /> },
];

const BATCHFLOW_NAV_ITEMS: { view: ViewName; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Overview', icon: <DashboardRoundedIcon /> },
  { view: 'batches', label: 'Batches', icon: <LayersRoundedIcon /> },
  { view: 'clients', label: 'Clients', icon: <PeopleRoundedIcon /> },
  { view: 'search', label: 'Search', icon: <SearchRoundedIcon /> },
  { view: 'archive', label: 'Archive', icon: <ArchiveRoundedIcon /> },
  { view: 'settings', label: 'Settings', icon: <SettingsRoundedIcon /> },
];

interface LayoutProps {
  children: React.ReactNode;
  onAddTask: () => void;
}

export default function Layout({ children, onAddTask }: LayoutProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const {
    currentView, setCurrentView, workspaces, activeWorkspace,
    switchWorkspace, createWorkspace, currentRole, canEdit, workspaceMembers,
    workspaceInvites,
  } = useApp();
  const [wsDrawerOpen, setWsDrawerOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsType, setNewWsType] = useState<WorkspaceType>('freelance');
  const [collabDialogOpen, setCollabDialogOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const isBatchflow = activeWorkspace?.type === 'batchflow';
  const navItems = isBatchflow ? BATCHFLOW_NAV_ITEMS : FREELANCE_NAV_ITEMS;
  const viewTitle = navItems.find(n => n.view === currentView)?.label ?? (isBatchflow ? 'Overview' : 'Dashboard');

  const handleCreateWs = async () => {
    if (!newWsName.trim()) return;
    const colors = ['#818CF8', '#34D399', '#F59E0B', '#F87171', '#A78BFA', '#60A5FA', '#FB7185', '#38BDF8'];
    await createWorkspace(newWsName.trim(), colors[workspaces.length % colors.length], newWsType);
    setNewWsName('');
    setNewWsType('freelance');
    setWsDrawerOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <OfflineBanner />

      {/* Top AppBar */}
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Tooltip title="Switch Workspace">
              <Chip
                avatar={
                  <Avatar sx={{ bgcolor: activeWorkspace?.color || '#818CF8', width: 24, height: 24, fontSize: '0.7rem' }}>
                    {isBatchflow ? '🎬' : (activeWorkspace?.name?.[0]?.toUpperCase() ?? 'W')}
                  </Avatar>
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <span>{activeWorkspace?.name ?? 'Workspace'}</span>
                    <Typography component="span" sx={{ fontSize: '0.62rem', opacity: 0.6, fontWeight: 700, textTransform: 'uppercase' }}>
                      {isBatchflow ? 'BatchFlow' : 'Tracker'}
                    </Typography>
                  </Box>
                }
                onClick={() => setWsDrawerOpen(true)}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'text.primary',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  maxWidth: 180,
                  '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                }}
              />
            </Tooltip>
            {currentRole !== 'owner' && (
              <Chip
                label={currentRole.toUpperCase()}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  bgcolor: currentRole === 'manager' ? 'rgba(52,211,153,0.15)' : 'rgba(129,140,248,0.15)',
                  color: currentRole === 'manager' ? '#34D399' : '#818CF8',
                }}
              />
            )}
          </Box>

          <Typography
            variant="h6"
            sx={{ flex: 1, textAlign: 'center', fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}
          >
            {viewTitle}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {currentView === 'tasks' && !isBatchflow && canEdit && (
              <IconButton
                onClick={onAddTask}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#fff',
                  width: 36,
                  height: 36,
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <AddRoundedIcon fontSize="small" />
              </IconButton>
            )}

            {activeWorkspace && user && (
              <Tooltip title={`Collaborators (${workspaceMembers.length})${workspaceInvites.length > 0 ? ` • ${workspaceInvites.length} pending invite${workspaceInvites.length > 1 ? 's' : ''}` : ''}`}>
                <IconButton
                  size="small"
                  onClick={() => setCollabDialogOpen(true)}
                  sx={{
                    color: workspaceInvites.length > 0 ? '#F59E0B' : 'text.secondary',
                    bgcolor: workspaceInvites.length > 0 ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    border: workspaceInvites.length > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                    '&:hover': { color: 'primary.light', bgcolor: 'rgba(255,255,255,0.06)' },
                  }}
                >
                  <Badge badgeContent={workspaceInvites.length} color="warning">
                    <GroupAddRoundedIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}

            {user ? (
              <>
                <Tooltip title={user.email ?? 'Account'}>
                  <IconButton
                    onClick={e => setUserMenuAnchor(e.currentTarget)}
                    size="small"
                    sx={{ p: 0.5 }}
                  >
                    <Avatar
                      src={user.user_metadata?.avatar_url}
                      sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      {(user.email?.[0] || 'U').toUpperCase()}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={userMenuAnchor}
                  open={Boolean(userMenuAnchor)}
                  onClose={() => setUserMenuAnchor(null)}
                  PaperProps={{
                    sx: {
                      bgcolor: 'background.paper',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 2,
                      minWidth: 180,
                      mt: 1,
                    },
                  }}
                >
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {user.user_metadata?.full_name || user.email?.split('@')[0]}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {user.email}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                  <MenuItem onClick={() => { setUserMenuAnchor(null); signOut(); }} sx={{ color: '#F87171', fontSize: '0.85rem', gap: 1 }}>
                    <LogoutRoundedIcon fontSize="small" />
                    Sign Out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonRoundedIcon />}
                onClick={() => setAuthDialogOpen(true)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: 2,
                  py: 0.5,
                  px: 1.5,
                  borderColor: 'rgba(255,255,255,0.15)',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(129,140,248,0.1)',
                  },
                }}
              >
                Sign In
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <PendingInvitesBanner />

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'auto',
          pb: isMobile ? '70px' : 0,
          px: { xs: 1.5, sm: 2, md: 3 },
          pt: 2,
        }}
      >
        {children}
      </Box>

      {/* Bottom navigation (mobile) */}
      {isMobile && (
        <BottomNavigation
          value={currentView}
          onChange={(_, v) => setCurrentView(v)}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
            bgcolor: theme.palette.background.paper,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            height: 64,
            '& .MuiBottomNavigationAction-root': { color: 'text.secondary' },
          }}
        >
          {navItems.map(n => (
            <BottomNavigationAction key={n.view} value={n.view} label={n.label} icon={n.icon} />
          ))}
        </BottomNavigation>
      )}

      {/* Desktop side nav */}
      {!isMobile && (
        <Box
          sx={{
            position: 'fixed',
            top: 64,
            left: 0,
            width: 64,
            bottom: 0,
            bgcolor: theme.palette.background.paper,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
            gap: 0.5,
            zIndex: theme.zIndex.drawer,
          }}
        >
          {navItems.map(n => (
            <Tooltip key={n.view} title={n.label} placement="right">
              <IconButton
                onClick={() => setCurrentView(n.view)}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  color: currentView === n.view ? 'primary.main' : 'text.secondary',
                  bgcolor: currentView === n.view ? 'rgba(129,140,248,0.12)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                {n.icon}
              </IconButton>
            </Tooltip>
          ))}
        </Box>
      )}

      {/* Workspace drawer */}
      <Drawer
        anchor="left"
        open={wsDrawerOpen}
        onClose={() => setWsDrawerOpen(false)}
        PaperProps={{ sx: { width: 300, bgcolor: 'background.paper' } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WorkspacesRoundedIcon sx={{ color: 'primary.main' }} />
            Workspaces
          </Typography>
          <List disablePadding>
            {workspaces.map(ws => {
              const wsIsBatch = ws.type === 'batchflow';
              return (
                <ListItem key={ws.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={ws.id === activeWorkspace?.id}
                    onClick={() => { switchWorkspace(ws.id); setWsDrawerOpen(false); }}
                    sx={{
                      borderRadius: 2,
                      '&.Mui-selected': { bgcolor: 'rgba(129,140,248,0.15)', '&:hover': { bgcolor: 'rgba(129,140,248,0.2)' } },
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 36 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: ws.color, fontSize: '0.75rem' }}>
                        {wsIsBatch ? '🎬' : (ws.name[0]?.toUpperCase() ?? 'W')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={ws.name}
                      secondary={wsIsBatch ? '🎬 BatchFlow' : '💼 Freelance'}
                      primaryTypographyProps={{ fontWeight: 600, fontSize: '0.88rem' }}
                      secondaryTypographyProps={{ fontSize: '0.68rem', color: wsIsBatch ? '#F472B6' : 'text.secondary' }}
                    />
                    {ws.id === activeWorkspace?.id && <CheckRoundedIcon sx={{ color: 'primary.main', fontSize: 18 }} />}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          {activeWorkspace && (
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<GroupAddRoundedIcon />}
              onClick={() => { setWsDrawerOpen(false); setCollabDialogOpen(true); }}
              sx={{
                mt: 1.5,
                mb: 0.5,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                borderRadius: 2,
                borderColor: workspaceInvites.length > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.12)',
                color: workspaceInvites.length > 0 ? '#F59E0B' : 'text.secondary',
                '&:hover': { borderColor: 'primary.main', color: 'primary.light' },
              }}
            >
              Collaborators ({workspaceMembers.length}){workspaceInvites.length > 0 ? ` • ${workspaceInvites.length} pending` : ''}
            </Button>
          )}

          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.07)' }} />

          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Create New Workspace
          </Typography>

          {/* Workspace Type Selector */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1.25 }}>
            <Box
              onClick={() => setNewWsType('freelance')}
              sx={{
                p: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: newWsType === 'freelance' ? 'primary.main' : 'rgba(255,255,255,0.1)',
                bgcolor: newWsType === 'freelance' ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 700 }}>💼 Freelance</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', display: 'block' }}>Tasks & Bills</Typography>
            </Box>

            <Box
              onClick={() => setNewWsType('batchflow')}
              sx={{
                p: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: newWsType === 'batchflow' ? '#F472B6' : 'rgba(255,255,255,0.1)',
                bgcolor: newWsType === 'batchflow' ? 'rgba(244,114,182,0.12)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 700, color: newWsType === 'batchflow' ? '#F472B6' : 'inherit' }}>🎬 BatchFlow</Typography>
              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', display: 'block' }}>Batches & Scripts</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <input
              value={newWsName}
              onChange={e => setNewWsName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateWs()}
              placeholder={newWsType === 'batchflow' ? "e.g. Creator Studios..." : "e.g. My Freelancing..."}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '8px 12px', color: '#F1F5F9', fontSize: '0.83rem', outline: 'none',
              }}
            />
            <Button variant="contained" size="small" onClick={handleCreateWs} sx={{ minWidth: 36, px: 1 }}>
              <AddRoundedIcon fontSize="small" />
            </Button>
          </Box>
        </Box>
      </Drawer>

      <AuthDialog open={authDialogOpen} onClose={() => setAuthDialogOpen(false)} />
      <CollaboratorsDialog open={collabDialogOpen} onClose={() => setCollabDialogOpen(false)} />
    </Box>
  );
}
