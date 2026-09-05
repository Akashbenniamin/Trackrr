import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, Box, Chip,
  InputAdornment, Slide,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import { useApp } from '../contexts/AppContext';
import type { Task } from '../types';

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: () => void;
}

const empty = (): Partial<Task> => {
  const now = new Date().toISOString();
  return {
    title: '',
    description: '',
    status: 'Completed',
    videos: 1,
    price: 0,
    pricing_type: 'total',
    client_id: null,
    received_date: now,
    completed_date: now,
    tags: [],
  };
};

export default function TaskDialog({ open, task, onClose, onSave }: TaskDialogProps) {
  const { clients, addTask, updateTask, settings } = useApp();
  const [form, setForm] = useState<Partial<Task>>(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) setForm({ ...task });
    else setForm(empty());
  }, [task, open]);

  const client = clients.find(c => c.id === form.client_id);
  const isMonthly = client?.payment_type === 'monthly';
  const cs = settings.currency === 'INR' ? '₹' : '$';
  const revenue = isMonthly ? 0 : (form.pricing_type === 'per_video' ? (form.videos ?? 0) * (form.price ?? 0) : (form.price ?? 0));

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (task?.id) {
        await updateTask(task.id, { ...form, updated_at: new Date().toISOString() });
      } else {
        await addTask(form);
      }
      onSave();
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
          maxHeight: { xs: '90vh', sm: '80vh' },
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {task ? 'Edit Task' : 'New Task'}
        {revenue > 0 && !isMonthly && (
          <Chip
            label={`${cs}${revenue.toFixed(0)}`}
            size="small"
            sx={{ bgcolor: 'rgba(129,140,248,0.2)', color: 'primary.light', fontWeight: 800 }}
          />
        )}
        {isMonthly && <Chip label="Monthly" size="small" sx={{ bgcolor: 'rgba(52,211,153,0.2)', color: '#34D399' }} />}
      </DialogTitle>

      <DialogContent sx={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <TextField
          label="Task Title"
          fullWidth
          autoFocus
          value={form.title ?? ''}
          onChange={e => set('title', e.target.value)}
        />

        <TextField
          label="Description (optional)"
          fullWidth
          multiline
          rows={2}
          value={form.description ?? ''}
          onChange={e => set('description', e.target.value)}
        />

        <FormControl size="small" fullWidth>
          <InputLabel>Client</InputLabel>
          <Select
            value={form.client_id ?? ''}
            onChange={e => set('client_id', e.target.value || null)}
            label="Client"
          >
            <MenuItem value="">No Client</MenuItem>
            {clients.map(c => (
              <MenuItem key={c.id} value={c.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
                  {c.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 0 }}>
            <TextField
              label="Videos"
              type="number"
              size="small"
              fullWidth
              value={form.videos ?? 1}
              onChange={e => set('videos', Math.max(0, parseInt(e.target.value) || 0))}
              InputProps={{
                startAdornment: <InputAdornment position="start"><VideoLibraryRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} /></InputAdornment>,
              }}
            />
          </Box>
          <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 0 }}>
            <TextField
              label="Price"
              type="number"
              size="small"
              fullWidth
              disabled={isMonthly}
              value={form.price ?? 0}
              onChange={e => set('price', parseFloat(e.target.value) || 0)}
              InputProps={{
                startAdornment: <InputAdornment position="start">{cs}</InputAdornment>,
              }}
            />
          </Box>
          <Box sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 0 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Pricing</InputLabel>
              <Select
                value={form.pricing_type ?? 'total'}
                onChange={e => set('pricing_type', e.target.value as 'total' | 'per_video')}
                label="Pricing"
                disabled={isMonthly}
              >
                <MenuItem value="total">Total</MenuItem>
                <MenuItem value="per_video">Per Video</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <TextField
          label="Date"
          type="date"
          size="small"
          fullWidth
          value={form.completed_date ? new Date(form.completed_date).toISOString().slice(0, 10) : form.received_date ? new Date(form.received_date).toISOString().slice(0, 10) : ''}
          onChange={e => {
            const iso = new Date(e.target.value + 'T12:00:00').toISOString();
            set('completed_date', iso);
            set('received_date', iso);
          }}
          InputLabelProps={{ shrink: true }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ flex: 1 }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.title?.trim()} sx={{ flex: 2 }}>
          {saving ? 'Saving…' : task ? 'Update Task' : 'Add Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
