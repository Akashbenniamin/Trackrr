import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Select, MenuItem, Box, Chip, InputAdornment, Slide, IconButton, Typography,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
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
    if (!form.title?.trim()) return;
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
          width: { xs: '100%', sm: 480 },
          borderRadius: { xs: '20px 20px 0 0', sm: 2 },
          position: { xs: 'fixed', sm: 'relative' },
          bottom: { xs: 0, sm: undefined },
          maxHeight: { xs: '92vh', sm: '85vh' },
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }
      }}
    >
      {/* Mobile Drag Indicator */}
      <Box sx={{ width: 36, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, mx: 'auto', mt: 1.25, display: { xs: 'block', sm: 'none' } }} />

      {/* Header */}
      <DialogTitle sx={{ px: 2.5, pt: { xs: 1.5, sm: 2 }, pb: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {task ? <EditNoteRoundedIcon sx={{ color: 'primary.main', fontSize: 24 }} /> : <AddTaskRoundedIcon sx={{ color: 'primary.main', fontSize: 24 }} />}
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em' }}>
            {task ? 'Edit Task' : 'New Task'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {revenue > 0 && !isMonthly && (
            <Chip
              label={`${cs}${revenue.toLocaleString()}`}
              size="small"
              sx={{ bgcolor: 'rgba(129,140,248,0.15)', color: 'primary.light', fontWeight: 800, fontSize: '0.78rem', height: 26 }}
            />
          )}
          {isMonthly && (
            <Chip label="Monthly Client" size="small" sx={{ bgcolor: 'rgba(52,211,153,0.15)', color: '#34D399', fontWeight: 700, fontSize: '0.72rem', height: 26 }} />
          )}
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary', ml: 0.5 }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Content Form */}
      <DialogContent sx={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2, px: 2.5, py: 1 }}>
        {/* Task Title */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
            Task Title <Box component="span" sx={{ color: 'error.main' }}>*</Box>
          </Typography>
          <TextField
            placeholder="e.g. Reel #12, Wedding Teaser, Highlight Cut..."
            fullWidth
            size="small"
            autoFocus
            value={form.title ?? ''}
            onChange={e => set('title', e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
          />
        </Box>

        {/* Client Selection */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', display: 'block', mb: 0.75 }}>
            Client
          </Typography>
          <Select
            value={form.client_id ?? ''}
            onChange={e => set('client_id', e.target.value || null)}
            displayEmpty
            fullWidth
            size="small"
            renderValue={sel => {
              const c = clients.find(cl => cl.id === sel);
              return c ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color }} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.name}</Typography>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>Select a client (optional)...</Typography>
              );
            }}
            sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}
          >
            <MenuItem value="">
              <em>No Client (General Task)</em>
            </MenuItem>
            {clients.map(c => (
              <MenuItem key={c.id} value={c.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.name}</Typography>
                  {c.payment_type === 'monthly' && (
                    <Chip label="Monthly" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(52,211,153,0.15)', color: '#34D399', ml: 'auto' }} />
                  )}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Pricing & Videos Card */}
        <Box sx={{ p: 1.75, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1.2fr 1fr' }, gap: 1.5 }}>
            {/* Videos Count */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Videos Count
              </Typography>
              <TextField
                type="number"
                size="small"
                fullWidth
                value={form.videos ?? 1}
                onChange={e => set('videos', Math.max(1, parseInt(e.target.value) || 1))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VideoLibraryRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Price */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                {form.pricing_type === 'per_video' ? 'Rate per Video' : 'Total Price'}
              </Typography>
              <TextField
                type="number"
                size="small"
                fullWidth
                disabled={isMonthly}
                value={form.price ?? 0}
                onChange={e => set('price', parseFloat(e.target.value) || 0)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.85rem' }}>{cs}</Typography>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Pricing Mode */}
            <Box sx={{ gridColumn: { xs: 'span 2', sm: 'span 1' } }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                Pricing Type
              </Typography>
              <Select
                value={form.pricing_type ?? 'total'}
                onChange={e => set('pricing_type', e.target.value as 'total' | 'per_video')}
                size="small"
                fullWidth
                disabled={isMonthly}
              >
                <MenuItem value="total">Total Flat</MenuItem>
                <MenuItem value="per_video">Per Video</MenuItem>
              </Select>
            </Box>
          </Box>

          {form.pricing_type === 'per_video' && (form.videos ?? 1) > 1 && !isMonthly && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'primary.light', fontWeight: 600 }}>
              Calculated: {form.videos} videos × {cs}{form.price} = {cs}{revenue.toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Date */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', display: 'block', mb: 0.75 }}>
            Completion Date
          </Typography>
          <TextField
            type="date"
            size="small"
            fullWidth
            value={form.completed_date ? new Date(form.completed_date).toISOString().slice(0, 10) : form.received_date ? new Date(form.received_date).toISOString().slice(0, 10) : ''}
            onChange={e => {
              const iso = new Date(e.target.value + 'T12:00:00').toISOString();
              set('completed_date', iso);
              set('received_date', iso);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarMonthRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{ bgcolor: 'rgba(255,255,255,0.03)' }}
          />
        </Box>

        {/* Description */}
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', display: 'block', mb: 0.75 }}>
            Description / Notes (optional)
          </Typography>
          <TextField
            placeholder="Add shoot notes, drive link, resolution details..."
            fullWidth
            multiline
            rows={2}
            size="small"
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.03)' } }}
          />
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            flex: 1,
            py: 0.85,
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            color: 'text.secondary',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.3)' },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !form.title?.trim()}
          startIcon={task ? <CheckRoundedIcon /> : <AddTaskRoundedIcon />}
          sx={{
            flex: 1.75,
            py: 0.85,
            textTransform: 'none',
            fontWeight: 800,
            borderRadius: 1,
            boxShadow: '0 4px 14px rgba(129,140,248,0.3)',
          }}
        >
          {saving ? 'Saving…' : task ? 'Update Task' : 'Add Task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
