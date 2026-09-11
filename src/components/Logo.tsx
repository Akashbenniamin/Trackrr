import { Box, Typography } from '@mui/material';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  subtitle?: string;
  sx?: any;
}

export default function Logo({
  size = 32,
  showWordmark = true,
  subtitle,
  sx,
}: LogoProps) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25, userSelect: 'none', ...sx }}>
      {/* SVG Icon Emblem */}
      <Box
        component="svg"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.35))',
          transition: 'transform 0.2s ease',
          '&:hover': { transform: 'scale(1.05)' },
        }}
      >
        <defs>
          <linearGradient id="trackrrGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="trackrrGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="trackrrBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Rounded Shield/Pill Background */}
        <rect x="1" y="1" width="34" height="34" rx="9" fill="url(#trackrrBgGrad)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.2" />

        {/* Top Horizontal Bar of "T" (Track Timeline Bar 1) */}
        <rect x="7" y="7.5" width="22" height="4.5" rx="2.25" fill="url(#trackrrGrad1)" />

        {/* Vertical Stem of "T" (Playhead Needle & Core) */}
        <rect x="15.5" y="10" width="5" height="18" rx="2.5" fill="url(#trackrrGrad2)" />

        {/* Dynamic Studio Timeline Pulse / Right Track Bar */}
        <rect x="22.5" y="15" width="6.5" height="3.5" rx="1.75" fill="#06B6D4" opacity="0.9" />

        {/* Dynamic Studio Timeline Pulse / Left Track Bar */}
        <rect x="7" y="18.5" width="6.5" height="3.5" rx="1.75" fill="#818CF8" opacity="0.8" />

        {/* Active Playhead Diamond Accent */}
        <circle cx="18" cy="27" r="1.75" fill="#38BDF8" />
      </Box>

      {/* Optional Wordmark */}
      {showWordmark && (
        <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              component="span"
              sx={{
                fontWeight: 900,
                fontSize: size * 0.58,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, #FFFFFF 30%, #C7D2FE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1,
              }}
            >
              TRACKRR
            </Typography>
            <Box
              sx={{
                width: size * 0.18,
                height: size * 0.18,
                borderRadius: '50%',
                bgcolor: '#06B6D4',
                ml: 0.4,
                boxShadow: '0 0 8px #06B6D4',
              }}
            />
          </Box>
          {subtitle && (
            <Typography
              component="span"
              sx={{
                fontSize: size * 0.28,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'primary.light',
                mt: 0.3,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
