import { Box, Typography } from '@mui/material';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import { useApp } from '../contexts/AppContext';

export default function OfflineBanner() {
  const { isOnline } = useApp();

  if (isOnline) return null;

  return (
    <Box
      sx={{
        bgcolor: '#EF4444',
        color: '#FFFFFF',
        px: 2,
        py: 0.75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        fontSize: '0.8rem',
        fontWeight: 600,
        zIndex: 1300,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      <CloudOffRoundedIcon sx={{ fontSize: 18 }} />
      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
        You are currently offline. Viewing cached data. Editing is disabled until connection is restored.
      </Typography>
    </Box>
  );
}
