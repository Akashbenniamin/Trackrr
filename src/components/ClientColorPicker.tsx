import React, { useRef } from 'react';
import {
  Box, Typography, Tooltip, TextField, InputAdornment, Chip, Avatar,
} from '@mui/material';
import ColorizeRoundedIcon from '@mui/icons-material/ColorizeRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import {
  CLIENT_COLORS, CLIENT_GRADIENTS, getClientPrimaryColor, isGradient,
} from '../types';

interface ClientColorPickerProps {
  value: string;
  onChange: (newColor: string) => void;
  previewName?: string;
}

export default function ClientColorPicker({
  value,
  onChange,
  previewName = 'Sample Client',
}: ClientColorPickerProps) {
  const nativePickerRef = useRef<HTMLInputElement>(null);

  const selectedPrimary = getClientPrimaryColor(value);
  const selectedIsGrad = isGradient(value);

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      onChange(val.toUpperCase());
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value.trim();
    onChange(text);
  };

  const initials = previewName
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'C';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 1. Curated Solid Colors */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
          Solid Colors
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {CLIENT_COLORS.map(color => {
            const isSelected = value.toLowerCase() === color.toLowerCase();
            return (
              <Tooltip key={color} title={color} arrow>
                <Box
                  onClick={() => onChange(color)}
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    bgcolor: color,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isSelected ? '2px solid #FFFFFF' : '2px solid rgba(255,255,255,0.12)',
                    boxShadow: isSelected ? `0 0 12px ${color}90` : 'none',
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': { transform: 'scale(1.18)', boxShadow: `0 0 10px ${color}80` },
                  }}
                >
                  {isSelected && <CheckRoundedIcon sx={{ fontSize: 16, color: '#FFFFFF' }} />}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* 2. Default Gradient Options */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
          Default Gradients
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {CLIENT_GRADIENTS.map(grad => {
            const isSelected = value === grad.value;
            return (
              <Tooltip key={grad.name} title={grad.name} arrow>
                <Box
                  onClick={() => onChange(grad.value)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: grad.value,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isSelected ? '2px solid #FFFFFF' : '2px solid rgba(255,255,255,0.12)',
                    boxShadow: isSelected ? `0 0 14px ${grad.primary}99` : '0 2px 6px rgba(0,0,0,0.3)',
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': { transform: 'scale(1.18)', boxShadow: `0 0 12px ${grad.primary}90` },
                  }}
                >
                  {isSelected && <CheckRoundedIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />}
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* 3. Custom Color / Hex Picker */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
          Custom Color / Hex
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {/* Visual Picker Trigger Button */}
          <Tooltip title="Open Color Picker">
            <Box
              onClick={() => nativePickerRef.current?.click()}
              sx={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                background: value || '#6366F1',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'all 0.15s ease',
                '&:hover': { transform: 'scale(1.08)', borderColor: '#FFFFFF' },
              }}
            >
              <ColorizeRoundedIcon sx={{ fontSize: 18, color: '#FFFFFF', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }} />
            </Box>
          </Tooltip>

          {/* Hidden HTML5 Color Picker */}
          <input
            ref={nativePickerRef}
            type="color"
            value={selectedPrimary.startsWith('#') && selectedPrimary.length === 7 ? selectedPrimary : '#6366F1'}
            onChange={handleNativeChange}
            style={{ display: 'none' }}
          />

          {/* Hex / CSS Value Text Input */}
          <TextField
            size="small"
            placeholder="#6366F1 or CSS color"
            value={value}
            onChange={handleTextChange}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: value || '#6366F1',
                      border: '1px solid rgba(255,255,255,0.3)',
                    }}
                  />
                </InputAdornment>
              ),
              sx: {
                fontSize: '0.82rem',
                height: 38,
                fontFamily: 'monospace',
                bgcolor: 'rgba(255,255,255,0.03)',
              },
            }}
          />
        </Box>
      </Box>

      {/* 4. Live Preview Banner */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              background: value || '#6366F1',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.75rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          >
            {initials}
          </Avatar>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 800,
                fontSize: '0.85rem',
                ...(selectedIsGrad
                  ? {
                      background: value,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      display: 'inline-block',
                    }
                  : {
                      color: value || '#818CF8',
                    }),
              }}
            >
              {previewName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', fontSize: '0.68rem' }}>
              {selectedIsGrad ? 'Gradient Theme' : `${value.toUpperCase()}`}
            </Typography>
          </Box>
        </Box>

        {/* Chip badge preview */}
        <Chip
          label="Active Tag"
          size="small"
          sx={{
            background: selectedIsGrad ? value : `${selectedPrimary}22`,
            color: selectedIsGrad ? '#FFFFFF' : selectedPrimary,
            border: `1px solid ${selectedPrimary}40`,
            fontWeight: 800,
            fontSize: '0.68rem',
            height: 22,
          }}
        />
      </Box>
    </Box>
  );
}
