import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, Box, InputAdornment,
  Slide, Typography,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import { useApp } from '../contexts/AppContext';
import type { Client, MonthlyRetainerScheduleItem } from '../types';
import { CLIENT_COLORS, getClientMonthlyRetainerSchedule } from '../types';
import ClientColorPicker from './ClientColorPicker';

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
  const { addClient, updateClient, setClientMonthlyRate, salaryRates, tasks, settings } = useApp();
  const [form, setForm] = useState<Partial<Client>>(empty());
  const [saving, setSaving] = useState(false);
  const [monthlyRates, setMonthlyRates] = useState<Record<string, number>>({});
  const [extraMonths, setExtraMonths] = useState(0);

  useEffect(() => {
    if (client) {
      setForm({ ...client });
      const sched = getClientMonthlyRetainerSchedule(client, tasks, salaryRates, 0);
      const map: Record<string, number> = {};
      sched.forEach(item => {
        map[item.monthStr] = item.amount;
      });
      setMonthlyRates(map);
    } else {
      setForm(empty());
      const now = new Date();
      const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setMonthlyRates({ [curMonthStr]: 0 });
    }
    setExtraMonths(0);
  }, [client, open, salaryRates, tasks]);

  const cs = settings.currency === 'INR' ? '₹' : '$';
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setForm(p => ({ ...p, [k]: v }));

  const schedule: MonthlyRetainerScheduleItem[] = React.useMemo(() => {
    if (client) {
      return getClientMonthlyRetainerSchedule(client, tasks, salaryRates, extraMonths);
    }
    const now = new Date();
    const items: MonthlyRetainerScheduleItem[] = [];
    for (let i = 0; i <= extraMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mName = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      items.push({
        monthIndex: i + 1,
        monthStr: ym,
        label: `Month ${i + 1} (${mName})`,
        monthName: mName,
        amount: monthlyRates[ym] ?? (form.monthly_salary || 0),
        isExistingRate: false,
      });
    }
    return items;
  }, [client, tasks, salaryRates, extraMonths, form.monthly_salary, monthlyRates]);

  const handleRateChange = (monthStr: string, val: number) => {
    setMonthlyRates(prev => ({ ...prev, [monthStr]: val }));
    set('monthly_salary', val);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      const latestSalary = schedule.length > 0
        ? (monthlyRates[schedule[schedule.length - 1].monthStr] ?? form.monthly_salary ?? 0)
        : (form.monthly_salary ?? 0);

      const clientData: Partial<Client> = {
        ...form,
        monthly_salary: form.payment_type === 'monthly' ? latestSalary : 0,
      };

      let savedClientId = client?.id;
      if (client?.id) {
        await updateClient(client.id, clientData);
      } else {
        const created = await addClient(clientData);
        savedClientId = created?.id;
      }

      if (savedClientId && form.payment_type === 'monthly') {
        for (const item of schedule) {
          const amt = monthlyRates[item.monthStr] !== undefined ? monthlyRates[item.monthStr] : item.amount;
          if (amt > 0) {
            await setClientMonthlyRate(savedClientId, item.monthStr, amt);
          }
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
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
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.light', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem' }}>
                  Monthly Retainer Pricing
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                  Month 1 begins from the oldest task's month ({schedule[0]?.monthName ?? 'start'})
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setExtraMonths(p => p + 1)}
                sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25, px: 1, height: 26, borderRadius: 1 }}
              >
                + Add Next Month
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
              {schedule.map(item => {
                const currentVal = monthlyRates[item.monthStr] !== undefined ? monthlyRates[item.monthStr] : item.amount;
                return (
                  <Box
                    key={item.monthStr}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <Box sx={{ minWidth: 140 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                        Month {item.monthIndex}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        {item.monthName}
                      </Typography>
                    </Box>

                    <TextField
                      size="small"
                      type="number"
                      placeholder="0"
                      value={currentVal || ''}
                      onChange={e => handleRateChange(item.monthStr, parseFloat(e.target.value) || 0)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">{cs}</InputAdornment>,
                      }}
                      sx={{
                        width: 140,
                        '& .MuiInputBase-root': { height: 34, fontSize: '0.82rem', fontWeight: 700 },
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Color picker */}
        <ClientColorPicker
          value={form.color || CLIENT_COLORS[0]}
          onChange={c => set('color', c)}
          previewName={form.name || 'Client Name'}
        />

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
