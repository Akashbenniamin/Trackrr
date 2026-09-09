import {
  Box, Card, Typography, Grid, IconButton, Tooltip,
} from '@mui/material';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import { useApp } from '../../contexts/AppContext';

export default function BatchflowArchive() {
  const {
    batchflowClients, batchflowBatches,
    updateBatchflowClient, deleteBatchflowClient,
    updateBatchflowBatch, deleteBatchflowBatch,
    canEdit,
  } = useApp();

  const archivedClients = batchflowClients.filter(c => !!c.archived);
  const archivedBatches = batchflowBatches.filter(b => !!b.archived);

  return (
    <Box sx={{ pb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
          Archive Management
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Restore or permanently remove archived clients and production batches.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Archived Clients */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PeopleRoundedIcon sx={{ color: '#818CF8' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Archived Clients ({archivedClients.length})
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {archivedClients.map(c => (
                <Box
                  key={c.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
                  {canEdit && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Restore Client">
                        <IconButton
                          size="small"
                          onClick={() => updateBatchflowClient(c.id, { archived: 0 })}
                          sx={{ color: '#34D399' }}
                        >
                          <RestoreRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Permanently Delete">
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (window.confirm(`Permanently delete client "${c.name}" and all their data? This cannot be undone.`)) {
                              deleteBatchflowClient(c.id);
                            }
                          }}
                          sx={{ color: '#F87171' }}
                        >
                          <DeleteForeverRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              ))}

              {archivedClients.length === 0 && (
                <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', py: 3, display: 'block' }}>
                  No archived clients.
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Archived Batches */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <LayersRoundedIcon sx={{ color: '#A78BFA' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Archived Batches ({archivedBatches.length})
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {archivedBatches.map(b => (
                <Box
                  key={b.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{b.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Shoot Date: {b.shoot_date || 'N/A'}</Typography>
                  </Box>
                  {canEdit && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Restore Batch">
                        <IconButton
                          size="small"
                          onClick={() => updateBatchflowBatch(b.id, { archived: 0 })}
                          sx={{ color: '#34D399' }}
                        >
                          <RestoreRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Permanently Delete">
                        <IconButton
                          size="small"
                          onClick={() => {
                            if (window.confirm(`Permanently delete batch "${b.name}" and all its videos? This cannot be undone.`)) {
                              deleteBatchflowBatch(b.id);
                            }
                          }}
                          sx={{ color: '#F87171' }}
                        >
                          <DeleteForeverRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Box>
              ))}

              {archivedBatches.length === 0 && (
                <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', py: 3, display: 'block' }}>
                  No archived batches.
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
