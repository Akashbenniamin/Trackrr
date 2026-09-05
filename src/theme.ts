import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#818CF8',
      light: '#A5B4FC',
      dark: '#6366F1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#34D399',
      light: '#6EE7B7',
      dark: '#10B981',
      contrastText: '#000000',
    },
    background: {
      default: '#080C14',
      paper: '#111827',
    },
    error: { main: '#F87171' },
    warning: { main: '#FBBF24' },
    success: { main: '#34D399' },
    info: { main: '#60A5FA' },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
      disabled: '#475569',
    },
    divider: 'rgba(255,255,255,0.07)',
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.5rem', fontWeight: 700 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    h4: { fontSize: '1.1rem', fontWeight: 600 },
    h5: { fontSize: '1rem', fontWeight: 600 },
    h6: { fontSize: '0.9rem', fontWeight: 600 },
    body2: { fontSize: '0.8rem' },
    caption: { fontSize: '0.72rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: '#080C14',
          overscrollBehavior: 'none',
          WebkitTapHighlightColor: 'transparent',
        },
        '::-webkit-scrollbar': { width: 5, height: 5 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': {
          background: 'rgba(148,163,184,0.2)',
          borderRadius: 3,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111827',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
        },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 12 },
        contained: {
          boxShadow: '0 4px 14px rgba(129,140,248,0.25)',
          '&:hover': { boxShadow: '0 6px 20px rgba(129,140,248,0.35)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          backgroundImage: 'none',
          backgroundColor: '#1E293B',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 'auto',
          padding: '6px 4px',
          '&.Mui-selected': { color: '#818CF8' },
        },
        label: {
          fontSize: '0.62rem',
          '&.Mui-selected': { fontSize: '0.62rem' },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(8,12,20,0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: '#0F172A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    MuiFab: {
      styleOverrides: { root: { boxShadow: '0 8px 24px rgba(129,140,248,0.4)' } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 4, height: 6 },
        bar: { borderRadius: 4 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12 },
        notchedOutline: { borderColor: 'rgba(255,255,255,0.1)' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.75rem',
          backgroundColor: '#1E293B',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
  },
});

export default theme;
