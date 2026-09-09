import { useState } from 'react';
import {
  Box, Card, Typography, TextField, InputAdornment, Grid, Chip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import { useApp } from '../../contexts/AppContext';

export default function BatchflowSearch({
  onSelectBatch,
  onNavigate,
}: {
  onSelectBatch?: (batchId: string) => void;
  onNavigate?: (view: any) => void;
}) {
  const { batchflowClients, batchflowBatches, batchflowVideos } = useApp();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const matchedClients = q ? batchflowClients.filter(c => !c.archived && c.name.toLowerCase().includes(q)) : [];
  const matchedBatches = q ? batchflowBatches.filter(b => !b.archived && (b.name.toLowerCase().includes(q) || (b.script && b.script.toLowerCase().includes(q)))) : [];
  const matchedVideos = q ? batchflowVideos.filter(v => v.name.toLowerCase().includes(q)) : [];

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
          Global Production Search
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Instantly search across clients, batches, master shoot scripts, and videos.
        </Typography>
      </Box>

      {/* Big Search Input */}
      <Card sx={{ p: 2, mb: 3 }}>
        <TextField
          placeholder="Search anything (e.g. client name, video hook, script topic, batch)..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          fullWidth
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: 'primary.main', fontSize: 24 }} />
              </InputAdornment>
            ),
            sx: { fontSize: '1rem', py: 0.5 },
          }}
        />
      </Card>

      {/* Search Results */}
      {q ? (
        <Grid container spacing={2.5}>
          {/* Clients */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PeopleRoundedIcon sx={{ color: 'primary.light', fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Clients ({matchedClients.length})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {matchedClients.map(c => (
                  <Box
                    key={c.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      borderLeft: `4px solid ${c.color || '#818CF8'}`,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
                    {c.instagram_id && (
                      <Typography variant="caption" sx={{ color: '#F43F5E' }}>
                        {c.instagram_id.startsWith('@') ? c.instagram_id : `@${c.instagram_id}`}
                      </Typography>
                    )}
                  </Box>
                ))}
                {matchedClients.length === 0 && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}>
                    No clients match
                  </Typography>
                )}
              </Box>
            </Card>
          </Grid>

          {/* Batches & Scripts */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <LayersRoundedIcon sx={{ color: '#A78BFA', fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Batches & Scripts ({matchedBatches.length})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {matchedBatches.map(b => (
                  <Box
                    key={b.id}
                    onClick={() => {
                      if (onSelectBatch) onSelectBatch(b.id);
                      if (onNavigate) onNavigate('batches');
                    }}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      cursor: (onSelectBatch || onNavigate) ? 'pointer' : 'default',
                      '&:hover': (onSelectBatch || onNavigate) ? { bgcolor: 'rgba(255,255,255,0.07)' } : {},
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{b.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      Shoot Date: {b.shoot_date || 'N/A'}
                    </Typography>
                    {b.script && b.script.toLowerCase().includes(q) && (
                      <Box sx={{ mt: 1, p: 1, borderRadius: 1, bgcolor: 'rgba(129,140,248,0.1)', display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                        <DescriptionRoundedIcon sx={{ fontSize: 14, color: 'primary.light', mt: 0.25 }} />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          "{b.script}"
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ))}
                {matchedBatches.length === 0 && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}>
                    No batches match
                  </Typography>
                )}
              </Box>
            </Card>
          </Grid>

          {/* Videos */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <MovieRoundedIcon sx={{ color: '#3B82F6', fontSize: 18 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Videos ({matchedVideos.length})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {matchedVideos.map(v => (
                  <Box
                    key={v.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{v.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>Script #{v.script_number}</Typography>
                    </Box>
                    <Chip
                      label={v.status}
                      size="small"
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: v.status === 'Posted' ? 'rgba(16,185,129,0.15)' : v.status === 'Edited' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                        color: v.status === 'Posted' ? '#10B981' : v.status === 'Edited' ? '#3B82F6' : '#F59E0B',
                      }}
                    />
                  </Box>
                ))}
                {matchedVideos.length === 0 && (
                  <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}>
                    No videos match
                  </Typography>
                )}
              </Box>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Start typing above to search
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Instant search finds clients, batch names, video titles, and dialogue inside master scripts.
          </Typography>
        </Card>
      )}
    </Box>
  );
}
