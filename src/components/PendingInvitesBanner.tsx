import { useState } from 'react';
import { Box, Card, Typography, Button, Chip, CircularProgress } from '@mui/material';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useApp } from '../contexts/AppContext';

export default function PendingInvitesBanner() {
  const { pendingInvites, respondToInvite, isOnline } = useApp();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  if (!pendingInvites || pendingInvites.length === 0) return null;

  const handleResponse = async (inviteId: string, accept: boolean) => {
    setRespondingId(inviteId);
    try {
      await respondToInvite(inviteId, accept);
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2, md: 3 }, pt: 1.5 }}>
      {pendingInvites.map((invite) => (
        <Card
          key={invite.id}
          sx={{
            p: 1.5,
            mb: 1.5,
            bgcolor: 'rgba(129, 140, 248, 0.1)',
            border: '1px solid rgba(129, 140, 248, 0.3)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 240, flex: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <GroupAddRoundedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Invitation to collaborate on <strong>{invite.workspace_name}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Invited by {invite.invited_by_email} as{' '}
                <Chip
                  label={invite.role.toUpperCase()}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    bgcolor: invite.role === 'manager' ? 'rgba(52,211,153,0.15)' : 'rgba(129,140,248,0.15)',
                    color: invite.role === 'manager' ? '#34D399' : '#818CF8',
                  }}
                />
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              disabled={!isOnline || respondingId === invite.id}
              startIcon={respondingId === invite.id ? <CircularProgress size={14} color="inherit" /> : <CheckRoundedIcon />}
              onClick={() => handleResponse(invite.id, true)}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderRadius: 2 }}
            >
              Accept
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              disabled={!isOnline || respondingId === invite.id}
              startIcon={<CloseRoundedIcon />}
              onClick={() => handleResponse(invite.id, false)}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderRadius: 2, color: 'text.secondary' }}
            >
              Decline
            </Button>
          </Box>
        </Card>
      ))}
    </Box>
  );
}
