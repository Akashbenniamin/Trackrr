import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, Box, InputAdornment,
  Slide, Typography, IconButton, Chip,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useApp } from '../contexts/AppContext';
import type { Client, SalaryRate } from '../types';
import { CLIENT_COLORS, getSalaryForMonth, formatCurrency, formatDate } from '../types';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ClientDialogProps {
  open: boolean;
  client: Client | null;
  onClose: () => void;
}

const empty = (): Partial<Client> => ({
  name: '',
  company: '',
  email: '',
  phone: '',
  color: CLIENT_COLORS[0],
  payment_type: 'per_video',
  monthly_salary: 0,
  notes: '',
});

export default function ClientDialog({ open, client, onClose }: ClientDialogProps) {
  const { addClient, updateClient, addSalaryRate, updateSalaryRate, deleteSalaryRate, salaryRates, settings } = useApp();
  const [form, setForm] = useState<Partial<Client>>(empty());
  const [saving, setSaving] = useState(false);
  const [newSalary, setNewSalary] = useState('');
  const [newSalaryDate, setNewSalaryDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (client) setForm({ ...client });
    else setForm(empty());
    setNewSalary('');
    setNewSalaryDate(new Date().toISOString().slice(0, 10));
    setEditingRateId(null);
  }, [client, open]);

  const cs = settings.currency === 'INR' ? '₹' : '$';
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setForm(p => ({ ...p, [k]: v }));

  const clientRates = client
    ? salaryRates.filter(r => r.client_id === client.id).sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    : [];

  const currentSalary = clientRates.length > 0 ? clientRates[clientRates.length - 1].amount : (client?.monthly_salary ?? 0);
  const activeSalaryNow = client ? getSalaryForMonth(salaryRates, client.id, new Date()) : 0;

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      if (client?.id) {
        await updateClient(client.id, form);
        if (form.payment_type === 'monthly' && newSalary && parseFloat(newSalary) > 0) {
          await addSalaryRate({
            client_id: client.id,
            amount: parseFloat(newSalary),
            effective_from: newSalaryDate,
          });
        }
      } else {
        const newClient = await addClient(form);
        if (newClient && form.payment_type === 'monthly' && form.monthly_salary) {
          await addSalaryRate({
            client_id: newClient.id,
            amount: form.monthly_salary,
            effective_from: newSalaryDate,
          });
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const startEditRate = (rate: SalaryRate) => {
    setEditingRateId(rate.id);
    setEditAmount(String(rate.amount));
    setEditDate(rate.effective_from.slice(0, 10));
  };

  const saveEditRate = async () => {
    if (!editingRateId || !editAmount || parseFloat(editAmount) <= 0) return;
    await updateSalaryRate(editingRateId, {
      amount: parseFloat(editAmount),
      effective_from: editDate,
    });
    setEditingRateId(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          m: { xs: 0, sm: 2 },
          width: { xs: '100%', sm: undefined },
          borderRadius: { xs: '20px 20px 0 0', sm: '20px' },
          position: { xs: 'fixed', sm: 'relative' },
          bottom: { xs: 0, sm: undefined },
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
        {client ? 'Edit Client' : 'New Client'}
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <TextField
          label="Client Name"
          fullWidth
          autoFocus
          value={form.name ?? ''}
          onChange={e => set('name', e.target.value)}
        />

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
            <TextField
              label="Company"
              fullWidth
              size="small"
              value={form.company ?? ''}
              onChange={e => set('company', e.target.value)}
            />
          </Box>
          <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
            <TextField
              label="Email"
              fullWidth
              size="small"
              type="email"
              value={form.email ?? ''}
              onChange={e => set('email', e.target.value)}
            />
          </Box>
        </Box>

        <TextField
          label="Phone"
          fullWidth
          size="small"
          value={form.phone ?? ''}
          onChange={e => set('phone', e.target.value)}
        />

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Payment Type</InputLabel>
              <Select
                value={form.payment_type ?? 'per_video'}
                onChange={e => set('payment_type', e.target.value as 'per_video' | 'monthly')}
                label="Payment Type"
              >
                <MenuItem value="per_video">Per Video</MenuItem>
                <MenuItem value="monthly">Monthly Retainer</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {form.payment_type === 'monthly' && (
          <>
            {/* New rate entry */}
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.light', display: 'block', mb: 1 }}>
                {client ? 'Add New Rate' : 'Set Monthly Rate'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}>
                  <TextField
                    label="Amount"
                    type="number"
                    size="small"
                    fullWidth
                    placeholder={client ? `Current: ${cs}${currentSalary}` : '0'}
                    value={client ? newSalary : (form.monthly_salary ?? 0)}
                    onChange={e => {
                      if (client) setNewSalary(e.target.value);
                      else set('monthly_salary', parseFloat(e.target.value) || 0);
                    }}
                    InputProps={{ startAdornment: <InputAdornment position="start">{cs}</InputAdornment> }}
                  />
                </Box>
                <Box sx={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}>
                  <TextField
                    label="Effective From"
                    type="date"
                    size="small"
                    fullWidth
                    value={newSalaryDate}
                    onChange={e => setNewSalaryDate(e.target.value)}
                    helperText={client ? 'Pick when this rate starts' : ''}
                  />
                </Box>
              </Box>
              {client && currentSalary > 0 && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75, fontSize: '0.7rem' }}>
                  Active rate: {cs}{activeSalaryNow} · Last set: {cs}{currentSalary}
                </Typography>
              )}
            </Box>

            {/* Salary rate history */}
            {client && clientRates.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                  Rate History
                </Typography>
                {clientRates.map((rate, i) => {
                  const isLatest = i === clientRates.length - 1;
                  const isEditing = editingRateId === rate.id;
                  return (
                    <Box key={rate.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, p: 0.75, borderRadius: 1.5,
                      bgcolor: isLatest ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isLatest ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                      {isEditing ? (
                        <>
                          <TextField size="small" type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                            sx={{ width: 90, '& input': { fontSize: '0.78rem', py: 0.5 } }}
                            InputProps={{ startAdornment: <InputAdornment position="start">{cs}</InputAdornment> }} />
                          <TextField size="small" type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                            sx={{ flex: 1, '& input': { fontSize: '0.78rem', py: 0.5 } }} />
                          <IconButton size="small" onClick={saveEditRate} sx={{ color: '#34D399' }}><CheckRoundedIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => setEditingRateId(null)} sx={{ color: 'text.disabled' }}><CloseRoundedIcon fontSize="small" /></IconButton>
                        </>
                      ) : (
                        <>
                          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {formatCurrency(rate.amount, settings.currency)}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                              from {formatDate(rate.effective_from)}
                            </Typography>
                            {isLatest && <Chip label="current" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(52,211,153,0.15)', color: '#34D399' }} />}
                          </Box>
                          <IconButton size="small" onClick={() => startEditRate(rate)} sx={{ color: 'text.disabled', '&:hover': { color: '#818CF8' } }}>
                            <EditRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => deleteSalaryRate(rate.id)} sx={{ color: 'text.disabled', '&:hover': { color: '#F87171' } }}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </>
        )}

        {/* Color picker */}
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Client Color</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {CLIENT_COLORS.map(c => (
              <Box
                key={c}
                onClick={() => set('color', c)}
                sx={{
                  width: 32, height: 32, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  border: form.color === c ? '3px solid #fff' : '3px solid transparent',
                  transition: 'transform 0.15s, border 0.15s',
                  '&:hover': { transform: 'scale(1.15)' },
                }}
              />
            ))}
          </Box>
        </Box>

        <TextField
          label="Notes"
          fullWidth
          multiline
          rows={2}
          size="small"
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value)}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ flex: 1 }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name?.trim()} sx={{ flex: 2 }}>
          {saving ? 'Saving…' : client ? 'Update Client' : 'Add Client'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
