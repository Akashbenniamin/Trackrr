import { createTheme } from '@mui/material/styles';
import type { ThemeStyle } from './types';

interface ThemePaletteConfig {
  bgDefault: string;
  bgPaper: string;
  bgDialog: string;
  bgDrawer: string;
  bgAppBar: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  cardBorder: string;
  backdropBlur?: boolean;
}

const THEME_CONFIGS: Record<ThemeStyle, ThemePaletteConfig> = {
  default: {
    bgDefault: '#080C14',
    bgPaper: '#111827',
    bgDialog: '#1E293B',
    bgDrawer: '#0F172A',
    bgAppBar: 'rgba(8, 12, 20, 0.9)',
    divider: 'rgba(255, 255, 255, 0.07)',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    cardBorder: '1px solid rgba(255, 255, 255, 0.06)',
  },
  soft: {
    bgDefault: '#141822',
    bgPaper: '#1D2330',
    bgDialog: '#242C3C',
    bgDrawer: '#181E2B',
    bgAppBar: 'rgba(20, 24, 34, 0.92)',
    divider: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#E2E8F0',
    textSecondary: '#94A3B8',
    cardBorder: '1px solid rgba(255, 255, 255, 0.08)',
  },
  dark: {
    bgDefault: '#000000',
    bgPaper: '#0B0B0B',
    bgDialog: '#141414',
    bgDrawer: '#050505',
    bgAppBar: 'rgba(0, 0, 0, 0.95)',
    divider: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA',
    cardBorder: '1px solid rgba(255, 255, 255, 0.14)',
  },
  smooth: {
    bgDefault: '#0C0C1A',
    bgPaper: '#151528',
    bgDialog: '#1B1B33',
    bgDrawer: '#101022',
    bgAppBar: 'rgba(12, 12, 26, 0.85)',
    divider: 'rgba(167, 139, 250, 0.15)',
    textPrimary: '#F8FAFC',
    textSecondary: '#C4B5FD',
    cardBorder: '1px solid rgba(167, 139, 250, 0.2)',
    backdropBlur: true,
  },
};

export function getAppTheme(themeStyle: ThemeStyle = 'default', accentColor = '#818CF8') {
  const cfg = THEME_CONFIGS[themeStyle] || THEME_CONFIGS.default;

  return createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: accentColor,
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
        default: cfg.bgDefault,
        paper: cfg.bgPaper,
      },
      error: { main: '#F87171' },
      warning: { main: '#FBBF24' },
      success: { main: '#34D399' },
      info: { main: '#60A5FA' },
      text: {
        primary: cfg.textPrimary,
        secondary: cfg.textSecondary,
        disabled: '#475569',
      },
      divider: cfg.divider,
    },
    shape: { borderRadius: themeStyle === 'smooth' ? 18 : 16 },
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
            background: cfg.bgDefault,
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
            backgroundColor: cfg.bgPaper,
            border: cfg.cardBorder,
            borderRadius: themeStyle === 'smooth' ? 18 : 16,
            backdropFilter: cfg.backdropBlur ? 'blur(16px)' : 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: themeStyle === 'smooth' ? 14 : 12 },
          contained: {
            boxShadow: `0 4px 14px ${accentColor}35`,
            '&:hover': { boxShadow: `0 6px 20px ${accentColor}50` },
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
              '& fieldset': { borderColor: cfg.divider },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            backgroundImage: 'none',
            backgroundColor: cfg.bgDialog,
            border: cfg.cardBorder,
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            minWidth: 'auto',
            padding: '6px 4px',
            '&.Mui-selected': { color: accentColor },
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
            backgroundColor: cfg.bgAppBar,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: cfg.cardBorder,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: cfg.bgDrawer,
            borderRight: cfg.cardBorder,
          },
        },
      },
      MuiFab: {
        styleOverrides: { root: { boxShadow: `0 8px 24px ${accentColor}40` } },
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
          notchedOutline: { borderColor: cfg.divider },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: '0.75rem',
            backgroundColor: cfg.bgDialog,
            border: cfg.cardBorder,
          },
        },
      },
    },
  });
}

const defaultTheme = getAppTheme('default');
export default defaultTheme;
