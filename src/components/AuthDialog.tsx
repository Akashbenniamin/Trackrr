import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, TextField,
  Button, Divider, Alert, CircularProgress, Tabs, Tab, IconButton,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '../contexts/AuthContext';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.8l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
      />
    </svg>
  );
}

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthDialog({ open, onClose }: AuthDialogProps) {
  const { isConfigured, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleReset = () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setEmail('');
    setPassword('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error.message || 'Failed to sign in with Google');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (tab === 'signin') {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) {
          setErrorMsg(error.message || 'Failed to sign in');
        } else {
          handleClose();
        }
      } else {
        const { error } = await signUpWithEmail(email.trim(), password);
        if (error) {
          setErrorMsg(error.message || 'Failed to sign up');
        } else {
          setInfoMsg('Account created! Please check your email to verify your address, then sign in.');
          setTab('signin');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
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
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {tab === 'signin' ? 'Sign In' : 'Create Account'}
        </Typography>
        <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {!isConfigured && (
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem', bgcolor: 'rgba(96, 165, 250, 0.1)', color: '#93C5FD' }}>
            <strong>Supabase Setup Required:</strong> Add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the <code>.env</code> file to enable live authentication and cloud syncing.
          </Alert>
        )}

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>
            {errorMsg}
          </Alert>
        )}

        {infoMsg && (
          <Alert severity="success" sx={{ mb: 2, fontSize: '0.8rem' }}>
            {infoMsg}
          </Alert>
        )}

        {/* Google Sign In Button */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleSignIn}
          disabled={loading || !isConfigured}
          sx={{
            py: 1.1,
            color: '#F8FAFC',
            borderColor: 'rgba(255,255,255,0.15)',
            bgcolor: 'rgba(255,255,255,0.04)',
            textTransform: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
            borderRadius: 2,
            mb: 2,
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.3)',
              bgcolor: 'rgba(255,255,255,0.08)',
            },
          }}
        >
          Continue with Google
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Typography variant="caption" sx={{ px: 1.5, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.68rem' }}>
            or with email
          </Typography>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setErrorMsg(null); setInfoMsg(null); }}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            mb: 2,
            '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.85rem', textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab value="signin" label="Sign In" />
          <Tab value="signup" label="Sign Up" />
        </Tabs>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          <TextField
            label="Email"
            type="email"
            size="small"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="you@example.com"
          />
          <TextField
            label="Password"
            type="password"
            size="small"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !isConfigured}
            sx={{
              mt: 1,
              py: 1,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            {loading ? <CircularProgress size={22} color="inherit" /> : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
