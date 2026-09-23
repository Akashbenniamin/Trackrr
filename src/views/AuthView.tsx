import React, { useState } from 'react';
import {
  Box, Card, Typography, TextField, Button, Divider, Alert, CircularProgress, Tabs, Tab,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

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

export default function AuthView() {
  const { isConfigured, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

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
          setErrorMsg(error.message || 'Failed to sign in. Please verify your credentials.');
        }
      } else {
        const { error } = await signUpWithEmail(email.trim(), password);
        if (error) {
          setErrorMsg(error.message || 'Failed to sign up');
        } else {
          setInfoMsg('Account created successfully! Please check your email to verify your address, then sign in.');
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
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#090D16',
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(99, 102, 241, 0.15), transparent 45%),
          radial-gradient(circle at 85% 85%, rgba(6, 182, 212, 0.08), transparent 40%),
          radial-gradient(circle at 15% 75%, rgba(129, 140, 248, 0.06), transparent 35%)
        `,
        px: 2,
        py: 4,
      }}
    >
      {/* Brand Header */}
      <Box sx={{ mb: 3.5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <Logo size={48} subtitle="STUDIO & FREELANCE" sx={{ mb: 1.5 }} />
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#F8FAFC',
            fontSize: { xs: '1.25rem', sm: '1.5rem' },
          }}
        >
          {tab === 'signin' ? 'Sign in to Trackrr' : 'Create your Trackrr account'}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: '#94A3B8',
            maxWidth: 420,
            mt: 0.5,
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}
        >
          The high-performance command center for video creators, editors, and production teams.
        </Typography>
      </Box>

      {/* Main Auth Card */}
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          bgcolor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 3.5,
          p: { xs: 2.5, sm: 3.5 },
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        {!isConfigured && (
          <Alert severity="warning" sx={{ mb: 2.5, fontSize: '0.8rem', bgcolor: 'rgba(245, 158, 11, 0.12)', color: '#FCD34D' }}>
            <strong>Supabase Setup Required:</strong> Add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file to enable cloud authentication and sync.
          </Alert>
        )}

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, fontSize: '0.82rem', borderRadius: 2 }}>
            {errorMsg}
          </Alert>
        )}

        {infoMsg && (
          <Alert severity="success" sx={{ mb: 2.5, fontSize: '0.82rem', borderRadius: 2 }}>
            {infoMsg}
          </Alert>
        )}

        {/* Google Single-Sign-On */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleSignIn}
          disabled={loading || !isConfigured}
          sx={{
            py: 1.25,
            color: '#F8FAFC',
            borderColor: 'rgba(255, 255, 255, 0.16)',
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            textTransform: 'none',
            fontSize: '0.92rem',
            fontWeight: 600,
            borderRadius: 2.25,
            mb: 2,
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'rgba(255, 255, 255, 0.35)',
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              transform: 'translateY(-1px)',
            },
          }}
        >
          Continue with Google
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
          <Typography variant="caption" sx={{ px: 1.5, color: '#64748B', textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em' }}>
            or with email
          </Typography>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
        </Box>

        {/* Tabs: Sign In / Create Account */}
        <Tabs
          value={tab}
          onChange={(_, v) => { setTab(v); setErrorMsg(null); setInfoMsg(null); }}
          variant="fullWidth"
          sx={{
            minHeight: 38,
            mb: 2.5,
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 2,
            p: 0.5,
            '& .MuiTabs-indicator': {
              height: '100%',
              borderRadius: 1.5,
              bgcolor: 'rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(129, 140, 248, 0.4)',
            },
            '& .MuiTab-root': {
              minHeight: 34,
              py: 0.5,
              fontSize: '0.85rem',
              textTransform: 'none',
              fontWeight: 700,
              zIndex: 1,
              color: '#94A3B8',
              '&.Mui-selected': {
                color: '#FFFFFF',
              },
            },
          }}
        >
          <Tab value="signin" label="Sign In" />
          <Tab value="signup" label="Create Account" />
        </Tabs>

        {/* Email & Password Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email address"
            type="email"
            size="small"
            fullWidth
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="you@example.com"
            InputLabelProps={{ sx: { color: '#94A3B8', fontSize: '0.88rem' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 2,
                color: '#F8FAFC',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                '&.Mui-focused fieldset': { borderColor: '#818CF8' },
              },
            }}
          />

          <TextField
            label="Password"
            type="password"
            size="small"
            fullWidth
            required
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
            InputLabelProps={{ sx: { color: '#94A3B8', fontSize: '0.88rem' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 2,
                color: '#F8FAFC',
                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                '&.Mui-focused fieldset': { borderColor: '#818CF8' },
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !isConfigured}
            sx={{
              mt: 1,
              py: 1.2,
              fontWeight: 800,
              fontSize: '0.92rem',
              textTransform: 'none',
              borderRadius: 2,
              background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #818CF8, #6366F1)',
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.5)',
              },
            }}
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : tab === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </Button>
        </Box>

        {/* Security & Feature Badges */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            mt: 3,
            pt: 2.5,
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            color: '#64748B',
            fontSize: '0.72rem',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LockOutlinedIcon sx={{ fontSize: 13, color: '#34D399' }} />
            <span>Secure Cloud Sync</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ShieldOutlinedIcon sx={{ fontSize: 13, color: '#60A5FA' }} />
            <span>Privacy Isolation</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BoltRoundedIcon sx={{ fontSize: 13, color: '#FBBF24' }} />
            <span>Realtime Tracker</span>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
