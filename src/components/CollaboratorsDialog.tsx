import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, TextField,
  Button, Select, MenuItem, IconButton, List, ListItem,
  ListItemAvatar, ListItemText, Avatar, Divider, Alert, CircularProgress,
  Chip, Tooltip,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';

interface CollaboratorsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CollaboratorsDialog({ open, onClose }: CollaboratorsDialogProps) {
  const {
    activeWorkspace,
    workspaceMembers,
    workspaceInvites,
    currentRole,
    isOnline,
    inviteCollaborator,
    cancelInvite,
    removeCollaborator,
  } = useApp();
  const { user } = useAuth();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('viewer');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isOwner = currentRole === 'owner';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspace) return;

    if (inviteEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setErrorMsg('You cannot invite yourself.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const res = await inviteCollaborator(activeWorkspace.id, inviteEmail.trim().toLowerCase(), inviteRole);
      if (res?.error) {
        setErrorMsg(res.error.message || 'Failed to send invite');
      } else {
        setSuccessMsg(`Invitation sent to ${inviteEmail} as ${inviteRole}!`);
        setInviteEmail('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (!activeWorkspace) return;
    if (!window.confirm(`Remove ${email} from this workspace?`)) return;

    try {
      await removeCollaborator(activeWorkspace.id, userId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove member');
    }
  };

  const handleCancelInvite = async (inviteId: string, email: string) => {
    if (!activeWorkspace) return;
    if (!window.confirm(`Cancel invitation sent to ${email}?`)) return;

    try {
      await cancelInvite(inviteId);
      setSuccessMsg(`Cancelled invite for ${email}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel invite');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0F172A',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupAddRoundedIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Collaborators — {activeWorkspace?.name}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {!isOnline && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>
            You are offline. Collaborator changes require an active internet connection.
          </Alert>
        )}

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }} onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2, fontSize: '0.8rem' }} onClose={() => setSuccessMsg(null)}>
            {successMsg}
          </Alert>
        )}

        {/* Invite Form (only visible if owner) */}
        {isOwner ? (
          <Box component="form" onSubmit={handleInvite} sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, textTransform: 'uppercase' }}>
              Invite a Collaborator
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="colleague@gmail.com"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={submitting || !isOnline}
                sx={{ flex: '1 1 200px' }}
              />
              <Select
                size="small"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'manager' | 'viewer')}
                disabled={submitting || !isOnline}
                sx={{ minWidth: 120, fontSize: '0.85rem' }}
              >
                <MenuItem value="manager">Manager (Can Edit)</MenuItem>
                <MenuItem value="viewer">Viewer (Read Only)</MenuItem>
              </Select>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !isOnline || !inviteEmail.trim()}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <GroupAddRoundedIcon />}
                sx={{ textTransform: 'none', fontWeight: 600, px: 2 }}
              >
                Invite
              </Button>
            </Box>
          </Box>
        ) : (
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
            You have <strong>{currentRole?.toUpperCase()}</strong> access. Only the workspace Owner can invite or remove members.
          </Alert>
        )}

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Pending Invites for this Workspace */}
        {workspaceInvites.length > 0 && (
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
              <HourglassEmptyRoundedIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pending Invitations ({workspaceInvites.length})
              </Typography>
            </Box>

            <List disablePadding>
              {workspaceInvites.map((invite) => (
                <ListItem
                  key={invite.id}
                  sx={{
                    bgcolor: 'rgba(245, 158, 11, 0.05)',
                    borderRadius: 2,
                    mb: 1,
                    px: 1.5,
                    py: 0.75,
                    border: '1px dashed rgba(245, 158, 11, 0.25)',
                  }}
                  secondaryAction={
                    isOwner ? (
                      <Tooltip title="Cancel invitation">
                        <IconButton
                          size="small"
                          onClick={() => handleCancelInvite(invite.id, invite.invitee_email)}
                          disabled={!isOnline}
                          sx={{ color: '#F87171', '&:hover': { bgcolor: 'rgba(248, 113, 113, 0.12)' } }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null
                  }
                >
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(245, 158, 11, 0.18)', color: '#F59E0B' }}>
                      <MailOutlineRoundedIcon sx={{ fontSize: 16 }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {invite.invitee_email}
                        </Typography>
                        <Chip
                          label="Pending"
                          size="small"
                          sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', fontWeight: 700 }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                        Invited as {invite.role === 'manager' ? 'Manager (Can Edit)' : 'Viewer (Read-only)'} • Waiting for user to accept
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Members List */}
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, textTransform: 'uppercase' }}>
          Current Members ({workspaceMembers.length})
        </Typography>

        <List disablePadding>
          {workspaceMembers.map((member) => {
            const isCurrentUser = member.user_id === user?.id;
            const isMemberOwner = member.role === 'owner';

            return (
              <ListItem
                key={member.id}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.02)',
                  borderRadius: 2,
                  mb: 1,
                  px: 1.5,
                  py: 1,
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
                secondaryAction={
                  isOwner && !isMemberOwner && !isCurrentUser ? (
                    <IconButton
                      size="small"
                      onClick={() => handleRemove(member.user_id, member.user_email)}
                      disabled={!isOnline}
                      sx={{ color: '#F87171' }}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  ) : null
                }
              >
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: isMemberOwner ? '#F59E0B' : member.role === 'manager' ? '#34D399' : '#818CF8' }}>
                    {member.user_email?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {member.user_email}
                      </Typography>
                      {isCurrentUser && (
                        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                          (you)
                        </Typography>
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                      <ShieldRoundedIcon sx={{ fontSize: 13, color: isMemberOwner ? '#F59E0B' : member.role === 'manager' ? '#34D399' : '#818CF8' }} />
                      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize', fontWeight: 600, fontSize: '0.72rem' }}>
                        {member.role === 'owner' ? 'Owner' : member.role === 'manager' ? 'Manager (Edit access)' : 'Viewer (Read-only)'}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
