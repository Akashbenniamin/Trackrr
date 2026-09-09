import { createTheme } from '@mui/material/styles';
import type { ThemeStyle } from './types';

interface ThemePaletteConfig {
  mode?: 'dark' | 'light';
  bgDefault: string;
  bgPaper: string;
  bgDialog: string;
  bgDrawer: string;
  bgAppBar: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  cardBorder: string;
  defaultAccent: string;
  backdropBlur?: boolean;
}

const THEME_CONFIGS: Record<ThemeStyle, ThemePaletteConfig> = {
  default: {
    mode: 'dark',
    defaultAccent: '#818CF8',
    bgDefault: '#080C14',
    bgPaper: '#111827',
    bgDialog: '#1E293B',
    bgDrawer: '#0F172A',
    bgAppBar: 'rgba(8, 12, 20, 0.9)',
    divider: 'rgba(255, 255, 255, 0.07)',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textDisabled: '#475569',
    cardBorder: '1px solid rgba(255, 255, 255, 0.06)',
  },
  soft: {
    mode: 'dark',
    defaultAccent: '#60A5FA',
    bgDefault: '#141822',
    bgPaper: '#1D2330',
    bgDialog: '#242C3C',
    bgDrawer: '#181E2B',
    bgAppBar: 'rgba(20, 24, 34, 0.92)',
    divider: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#E2E8F0',
    textSecondary: '#94A3B8',
    textDisabled: '#64748B',
    cardBorder: '1px solid rgba(255, 255, 255, 0.08)',
  },
  dark: {
    mode: 'dark',
    defaultAccent: '#38BDF8',
    bgDefault: '#000000',
    bgPaper: '#0B0B0B',
    bgDialog: '#141414',
    bgDrawer: '#050505',
    bgAppBar: 'rgba(0, 0, 0, 0.95)',
    divider: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textDisabled: '#52525B',
    cardBorder: '1px solid rgba(255, 255, 255, 0.14)',
  },
  smooth: {
    mode: 'dark',
    defaultAccent: '#A78BFA',
    bgDefault: '#0C0C1A',
    bgPaper: '#151528',
    bgDialog: '#1B1B33',
    bgDrawer: '#101022',
    bgAppBar: 'rgba(12, 12, 26, 0.85)',
    divider: 'rgba(167, 139, 250, 0.15)',
    textPrimary: '#F8FAFC',
    textSecondary: '#C4B5FD',
    textDisabled: '#7C3AED',
    cardBorder: '1px solid rgba(167, 139, 250, 0.2)',
    backdropBlur: true,
  },
  light: {
    mode: 'light',
    defaultAccent: '#4F46E5',
    bgDefault: '#F8FAFC',
    bgPaper: '#FFFFFF',
    bgDialog: '#FFFFFF',
    bgDrawer: '#F1F5F9',
    bgAppBar: 'rgba(255, 255, 255, 0.92)',
    divider: 'rgba(0, 0, 0, 0.08)',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textDisabled: '#94A3B8',
    cardBorder: '1px solid rgba(0, 0, 0, 0.08)',
  },
  'warm-light': {
    mode: 'light',
    defaultAccent: '#D97706',
    bgDefault: '#FAF7F2',
    bgPaper: '#FFFFFF',
    bgDialog: '#FFFFFF',
    bgDrawer: '#F4EFE6',
    bgAppBar: 'rgba(250, 247, 242, 0.94)',
    divider: 'rgba(68, 64, 60, 0.1)',
    textPrimary: '#1C1917',
    textSecondary: '#78716C',
    textDisabled: '#A8A29E',
    cardBorder: '1px solid rgba(68, 64, 60, 0.1)',
  },
  'cool-light': {
    mode: 'light',
    defaultAccent: '#0284C7',
    bgDefault: '#F0F9FF',
    bgPaper: '#FFFFFF',
    bgDialog: '#FFFFFF',
    bgDrawer: '#E0F2FE',
    bgAppBar: 'rgba(240, 249, 255, 0.94)',
    divider: 'rgba(14, 116, 144, 0.12)',
    textPrimary: '#0C4A6E',
    textSecondary: '#0284C7',
    textDisabled: '#7DD3FC',
    cardBorder: '1px solid rgba(14, 116, 144, 0.14)',
  },
};

export function getAppTheme(themeStyle: ThemeStyle = 'default', accentColor = 'auto') {
  const cfg = THEME_CONFIGS[themeStyle] || THEME_CONFIGS.default;
  const isLight = cfg.mode === 'light';
  const resolvedAccent = (!accentColor || accentColor === 'auto') ? cfg.defaultAccent : accentColor;

  return createTheme({
    palette: {
      mode: cfg.mode || 'dark',
      primary: {
        main: resolvedAccent,
        light: isLight ? '#818CF8' : '#A5B4FC',
        dark: isLight ? '#4338CA' : '#6366F1',
        contrastText: '#ffffff',
      },
      secondary: {
        main: isLight ? '#059669' : '#34D399',
        light: '#6EE7B7',
        dark: '#10B981',
        contrastText: isLight ? '#ffffff' : '#000000',
      },
      background: {
        default: cfg.bgDefault,
        paper: cfg.bgPaper,
      },
      error: { main: '#EF4444' },
      warning: { main: '#F59E0B' },
      success: { main: '#10B981' },
      info: { main: '#3B82F6' },
      text: {
        primary: cfg.textPrimary,
        secondary: cfg.textSecondary,
        disabled: cfg.textDisabled,
      },
      divider: cfg.divider,
    },
    shape: { borderRadius: themeStyle === 'smooth' ? 10 : 8 },
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
            color: cfg.textPrimary,
            overscrollBehavior: 'none',
            WebkitTapHighlightColor: 'transparent',
          },
          '::-webkit-scrollbar': { width: 5, height: 5 },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(148,163,184,0.2)',
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
            borderRadius: themeStyle === 'smooth' ? 10 : 8,
            backdropFilter: cfg.backdropBlur ? 'blur(16px)' : 'none',
            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: cfg.bgPaper,
            color: cfg.textPrimary,
            borderRadius: themeStyle === 'smooth' ? 10 : 8,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: themeStyle === 'smooth' ? 9 : 8 },
          contained: {
            boxShadow: `0 4px 14px ${accentColor}35`,
            '&:hover': { boxShadow: `0 6px 20px ${accentColor}50` },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 6, fontWeight: 500 } },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              '& fieldset': { borderColor: cfg.divider },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            backgroundImage: 'none',
            backgroundColor: cfg.bgDialog,
            border: cfg.cardBorder,
            boxShadow: isLight ? '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' : '0 25px 50px -12px rgba(0,0,0,0.7)',
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            minWidth: 'auto',
            padding: '6px 4px',
            color: cfg.textSecondary,
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
            boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
            color: cfg.textPrimary,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: cfg.bgDrawer,
            borderRight: cfg.cardBorder,
            color: cfg.textPrimary,
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
            color: cfg.textPrimary,
            border: cfg.cardBorder,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        },
      },
    },
  });
}

const defaultTheme = getAppTheme('default');
export default defaultTheme;
