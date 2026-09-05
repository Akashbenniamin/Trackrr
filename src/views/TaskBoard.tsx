import React, { useState, useMemo } from 'react';
import { usePersistedState } from '../lib/usePersistedState';
import {
  Box, Card, Typography, Chip, IconButton, Fade,
  Select, MenuItem, Button, Skeleton, Checkbox, ListItemText, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import DiscountRoundedIcon from '@mui/icons-material/DiscountRounded';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { calcTaskRevenueFull, formatCurrency, formatDate, PAYMENT_METHODS } from '../types';
import type { Task, Payment, Discount } from '../types';
import TaskDialog from '../components/TaskDialog';

type SortKey = 'date_desc' | 'date_asc' | 'title' | 'revenue_desc' | 'revenue_asc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date_desc', label: 'Newest First' },
  { key: 'date_asc', label: 'Oldest First' },
  { key: 'title', label: 'Title A-Z' },
  { key: 'revenue_desc', label: 'Revenue: High to Low' },
  { key: 'revenue_asc', label: 'Revenue: Low to High' },
];

function TaskCard({ task, onEdit, onDelete }: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { clients, salaryRates, tasks, settings, canEdit } = useApp();
  const client = clients.find(c => c.id === task.client_id);
  const cur = (v: number) => formatCurrency(v, settings.currency);
  const rev = calcTaskRevenueFull(task, client, salaryRates, tasks);
  const dateStr = task.completed_date ?? task.received_date;

  return (
    <Card
      draggable={canEdit}
      data-task-id={task.id}
      onDoubleClick={() => canEdit && onEdit(task)}
      sx={{
        mb: 1, p: 0,
        borderLeft: client ? `3px solid ${client.color}` : undefined,
        cursor: canEdit ? 'grab' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': canEdit ? { transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(0,0,0,0.3)' } : {},
        '&:active': canEdit ? { cursor: 'grabbing', transform: 'rotate(1.5deg) scale(0.97)' } : {},
      }}
    >
      <Box sx={{ p: 1.5, pr: canEdit ? 0 : 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          {canEdit && <DragIndicatorRoundedIcon sx={{ color: 'text.disabled', fontSize: 16, mt: 0.3, flexShrink: 0 }} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700, fontSize: '0.87rem',
                mb: 0.25,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {task.title || 'Untitled'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              {client && (
                <Chip size="small" label={client.name}
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${client.color}20`, color: client.color, fontWeight: 600, '& .MuiChip-label': { px: 0.75 } }}
                />
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.secondary' }}>
                <VideoLibraryRoundedIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontSize: '0.68rem' }}>{task.videos ?? 0}</Typography>
              </Box>
              {rev > 0 && (
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#818CF8', fontSize: '0.72rem' }}>{cur(rev)}</Typography>
              )}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.25, fontSize: '0.65rem' }}>
              {formatDate(dateStr)}
            </Typography>
          </Box>
          {canEdit && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pr: 1.5,
              '& .MuiIconButton-root': { width: 28, height: 28, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 1, transition: 'all 0.15s ease' },
            }}>
              <IconButton size="small" onClick={() => onEdit(task)}
                sx={{ '&:hover': { bgcolor: 'rgba(129,140,248,0.2)', borderColor: '#818CF8' } }}>
                <EditRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              </IconButton>
              <IconButton size="small" onClick={() => onDelete(task.id)}
                sx={{ '&:hover': { bgcolor: 'rgba(248,113,113,0.2)', borderColor: '#F87171' } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 14, color: '#F87171' }} />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>
    </Card>
  );
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' });
}

function MonthSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Select
      multiple size="small" displayEmpty fullWidth
      value={value}
      onChange={e => onChange(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
      renderValue={selected => selected.length === 0 ? 'For Month(s) — links to bill' : selected.map(monthLabel).join(', ')}
      sx={{ fontSize: '0.72rem' }}
    >
      {Array.from({ length: 18 }).map((_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - 12 + i);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return (
          <MenuItem key={val} value={val} dense>
            <Checkbox size="small" checked={value.includes(val)} sx={{ p: 0.5 }} />
            <ListItemText primary={d.toLocaleDateString('en', { month: 'long', year: 'numeric' })} sx={{ '& .MuiListItemText-primary': { fontSize: '0.72rem' } }} />
          </MenuItem>
        );
      })}
    </Select>
  );
}

function EditEntryDialog({ open, item, editType, clients, currency, onClose, onSave }: {
  open: boolean;
  item: Payment | Discount | null;
  editType: 'payment' | 'discount' | null;
  clients: { id: string; name: string }[];
  currency: string;
  onClose: () => void;
  onSave: (data: Partial<Payment> | Partial<Discount>) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [paymentForMonths, setPaymentForMonths] = useState<string[]>([]);

  React.useEffect(() => {
    if (item) {
      setAmount(String(item.amount));
      setMethod('method' in item ? item.method : 'Cash');
      setNote(item.note ?? '');
      setDate(item.date.slice(0, 10));
      setPaymentForMonths(item.payment_for_months ?? []);
    }
  }, [item]);

  if (!item || !editType) return null;
  const isPayment = editType === 'payment';
  const sym = currency === 'INR' ? '\u20B9' : '$';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: '#1E293B', backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.08)' } }}>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        {isPayment ? <PaymentsRoundedIcon sx={{ color: '#34D399' }} /> : <DiscountRoundedIcon sx={{ color: '#A78BFA' }} />}
        Edit {isPayment ? 'Payment' : 'Discount'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <Select value={(item as Payment).client_id} disabled size="small" sx={{ fontSize: '0.85rem' }}>
          <MenuItem value={(item as Payment).client_id}>{clients.find(c => c.id === (item as Payment).client_id)?.name ?? 'Unknown'}</MenuItem>
        </Select>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField size="small" type="date" label="Date" value={date} onChange={e => setDate(e.target.value)} />
          <TextField size="small" type="number" label={'Amount (' + sym + ')'} value={amount} onChange={e => setAmount(e.target.value)} />
        </Box>
        {isPayment && (
          <Select value={method} onChange={e => setMethod(e.target.value)} size="small" sx={{ fontSize: '0.85rem' }}>
            {PAYMENT_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        )}
        <MonthSelect value={paymentForMonths} onChange={setPaymentForMonths} />
        <TextField size="small" label="Note" value={note} onChange={e => setNote(e.target.value)} fullWidth />
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</Button>
        <Button variant="contained" size="small" onClick={() => onSave({
          amount: parseFloat(amount) || 0,
          method: isPayment ? method : undefined,
          note,
          date: new Date(date + 'T12:00:00').toISOString(),
          payment_for_months: paymentForMonths,
        } as Partial<Payment>)} sx={{ bgcolor: isPayment ? '#34D399' : '#A78BFA', color: '#111827', '&:hover': { bgcolor: isPayment ? '#34D399' : '#A78BFA', filter: 'brightness(1.1)' }, fontWeight: 700 }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PaymentEntry() {
  const { clients, payments, discounts, settings, addPayment, updatePayment, deletePayment, addDiscount, updateDiscount, deleteDiscount, activeWorkspace, canEdit, currentRole } = useApp();
  const [entryType, setEntryType] = useState<'payment' | 'discount'>('payment');
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentForMonths, setPaymentForMonths] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState('');
  const [editItem, setEditItem] = useState<{ type: 'payment' | 'discount'; id: string } | null>(null);
  const cur = (v: number) => formatCurrency(v, settings.currency);

  const filtered = filterClient ? payments.filter(p => p.client_id === filterClient) : payments;
  const total = filtered.reduce((s, p) => s + p.amount, 0);
  const filteredDiscounts = filterClient ? discounts.filter(d => d.client_id === filterClient) : discounts;
  const discTotal = filteredDiscounts.reduce((s, d) => s + d.amount, 0);

  const resetForm = () => { setAmount(''); setNote(''); setPaymentForMonths([]); };

  const handleAdd = async () => {
    if (!canEdit || !clientId || !amount) return;
    if (entryType === 'payment') {
      await addPayment({ client_id: clientId, workspace_id: activeWorkspace?.id, amount: parseFloat(amount), method, note, date: new Date(date + 'T12:00:00').toISOString(), payment_for_months: paymentForMonths });
    } else {
      await addDiscount({ client_id: clientId, workspace_id: activeWorkspace?.id, amount: parseFloat(amount), note, date: new Date(date + 'T12:00:00').toISOString(), payment_for_months: paymentForMonths });
    }
    resetForm();
  };

  const isPayment = entryType === 'payment';
  const accentColor = isPayment ? '#34D399' : '#A78BFA';

  type UnifiedItem = { id: string; type: 'payment' | 'discount'; client_id: string; amount: number; date: string; method: string; note: string; payment_for_months: string[] };
  const unifiedList: UnifiedItem[] = [
    ...filtered.map(p => ({ id: p.id, type: 'payment' as const, client_id: p.client_id, amount: p.amount, date: p.date, method: p.method, note: p.note, payment_for_months: p.payment_for_months ?? [] })),
    ...filteredDiscounts.map(d => ({ id: d.id, type: 'discount' as const, client_id: d.client_id, amount: d.amount, date: d.date, method: '', note: d.note, payment_for_months: d.payment_for_months ?? [] })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#111827', borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Payments & Discounts</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>-{cur(discTotal)}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#34D399' }}>{cur(total)}</Typography>
        </Box>
      </Box>

      <Box sx={{ px: 1.5, pt: 1 }}>
        <Select value={filterClient} onChange={e => setFilterClient(e.target.value)} size="small" displayEmpty fullWidth sx={{ fontSize: '0.78rem', mb: 1 }}>
          <MenuItem value="">All Clients</MenuItem>
          {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </Select>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, maxHeight: 200 }}>
        {unifiedList.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', textAlign: 'center', py: 3 }}>No payments or discounts yet</Typography>
        ) : unifiedList.map(item => {
          const client = clients.find(c => c.id === item.client_id);
          const isDisc = item.type === 'discount';
          return (
            <Box
              key={item.type + item.id}
              onDoubleClick={() => canEdit && setEditItem({ type: item.type, id: item.id })}
              sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, mb: 0.75, borderRadius: 2,
                bgcolor: isDisc ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${isDisc ? '#A78BFA' : client?.color ?? '#475569'}`,
                cursor: canEdit ? 'pointer' : 'default',
                '&:hover': canEdit ? { bgcolor: isDisc ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.07)' } : {},
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {isDisc && <DiscountRoundedIcon sx={{ fontSize: 12, color: '#A78BFA' }} />}
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{client?.name ?? 'Unknown'}</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', display: 'block' }}>
                  {formatDate(item.date)}{!isDisc && ` \u00B7 ${item.method}`}{item.note && ` \u00B7 ${item.note}`}
                </Typography>
                {item.payment_for_months.length > 0 && (
                  <Typography variant="caption" sx={{ color: '#818CF8', fontSize: '0.62rem', display: 'block' }}>
                    For: {item.payment_for_months.map(monthLabel).join(', ')}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: isDisc ? '#A78BFA' : '#34D399', fontSize: '0.82rem' }}>{isDisc ? '-' : ''}{cur(item.amount)}</Typography>
                {canEdit && (
                  <IconButton size="small" sx={{ p: 0.25 }} onClick={() => isDisc ? deleteDiscount(item.id) : deletePayment(item.id)}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 13, color: '#F87171' }} />
                  </IconButton>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Unified add form */}
      {canEdit ? (
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ToggleButtonGroup
            value={entryType}
            exclusive
            size="small"
            fullWidth
            onChange={(_, v) => v && setEntryType(v)}
            sx={{ '& .MuiToggleButton-root': { py: 0.4, fontSize: '0.72rem', textTransform: 'none', borderColor: 'rgba(255,255,255,0.1)' } }}
          >
            <ToggleButton value="payment" sx={{ color: isPayment ? '#34D399 !important' : 'rgba(255,255,255,0.5)', bgcolor: isPayment ? 'rgba(52,211,153,0.12) !important' : 'transparent' }}>
              <PaymentsRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> Payment
            </ToggleButton>
            <ToggleButton value="discount" sx={{ color: !isPayment ? '#A78BFA !important' : 'rgba(255,255,255,0.5)', bgcolor: !isPayment ? 'rgba(167,139,250,0.12) !important' : 'transparent' }}>
              <DiscountRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} /> Discount
            </ToggleButton>
          </ToggleButtonGroup>
          <Select value={clientId} onChange={e => setClientId(e.target.value)} size="small" displayEmpty fullWidth sx={{ fontSize: '0.78rem' }}>
            <MenuItem value="" disabled>Select Client</MenuItem>
            {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <TextField size="small" type="date" value={date} onChange={e => setDate(e.target.value)} sx={{ '& input': { fontSize: '0.78rem', py: 0.7 } }} />
            {isPayment ? (
              <Select value={method} onChange={e => setMethod(e.target.value)} size="small" sx={{ fontSize: '0.78rem' }}>
                {PAYMENT_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </Select>
            ) : (
              <TextField size="small" placeholder="Reason" value={note} onChange={e => setNote(e.target.value)} sx={{ '& input': { fontSize: '0.78rem', py: 0.7 } }} />
            )}
          </Box>
          <MonthSelect value={paymentForMonths} onChange={setPaymentForMonths} />
          {isPayment && <TextField size="small" placeholder="Note" value={note} onChange={e => setNote(e.target.value)} sx={{ '& input': { fontSize: '0.78rem' } }} />}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" type="number" placeholder={'Amount (' + (settings.currency === 'INR' ? '\u20B9' : '$') + ')'} value={amount} onChange={e => setAmount(e.target.value)} sx={{ flex: 1, '& input': { fontSize: '0.78rem' } }} />
            <Button variant="contained" size="small" onClick={handleAdd} disabled={!clientId || !amount} startIcon={<AddRoundedIcon />}
              sx={{ bgcolor: accentColor, color: '#111827', '&:hover': { bgcolor: accentColor, filter: 'brightness(1.1)' }, fontWeight: 700, textTransform: 'none', minWidth: 90 }}>
              Add
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {currentRole === 'viewer' ? 'Viewer access (Read Only)' : 'Read-only mode (Offline)'}
          </Typography>
        </Box>
      )}

      <EditEntryDialog
        open={!!editItem}
        item={editItem ? (editItem.type === 'payment' ? payments.find(p => p.id === editItem.id) ?? null : discounts.find(d => d.id === editItem.id) ?? null) : null}
        editType={editItem?.type ?? null}
        clients={clients}
        currency={settings.currency}
        onClose={() => setEditItem(null)}
        onSave={async (data) => {
          if (!editItem) return;
          if (editItem.type === 'payment') await updatePayment(editItem.id, data);
          else await updateDiscount(editItem.id, data);
          setEditItem(null);
        }}
      />
    </Box>
  );
}

export default function TaskBoard() {
  const { tasks, clients, salaryRates, deleteTask, loading, canEdit } = useApp();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const [compMonth, setCompMonth] = usePersistedState<string>('tb_compMonth', '');
  const [compClient, setCompClient] = usePersistedState<string>('tb_compClient', '');
  const [compSort, setCompSort] = usePersistedState<SortKey>('tb_compSort', 'date_desc');

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    tasks.forEach(t => {
      const d = t.completed_date ?? t.received_date;
      if (d) months.add(format(new Date(d), 'yyyy-MM'));
    });
    return Array.from(months).sort().reverse().map(m => ({ value: m, label: format(new Date(m + '-01'), 'MMMM yyyy') }));
  }, [tasks]);

  const allFilteredTasks = useMemo(() => {
    let result = [...tasks];
    if (compClient) result = result.filter(t => t.client_id === compClient);
    if (compMonth) {
      const [yr, mo] = compMonth.split('-').map(Number);
      const start = startOfMonth(new Date(yr, mo - 1)).toISOString();
      const end = endOfMonth(new Date(yr, mo - 1)).toISOString();
      result = result.filter(t => {
        const d = t.completed_date ?? t.received_date;
        return d && d >= start && d <= end;
      });
    }
    const withRev = result.map(t => ({
      t,
      rev: calcTaskRevenueFull(t, clients.find(c => c.id === t.client_id), salaryRates, tasks),
    }));
    const sorted = [...withRev].sort((a, b) => {
      switch (compSort) {
        case 'date_desc': return new Date(b.t.completed_date ?? b.t.received_date).getTime() - new Date(a.t.completed_date ?? a.t.received_date).getTime();
        case 'date_asc': return new Date(a.t.completed_date ?? a.t.received_date).getTime() - new Date(b.t.completed_date ?? b.t.received_date).getTime();
        case 'title': return (a.t.title || '').localeCompare(b.t.title || '');
        case 'revenue_desc': return b.rev - a.rev;
        case 'revenue_asc': return a.rev - b.rev;
        default: return 0;
      }
    });
    return sorted.map(x => x.t);
  }, [tasks, clients, salaryRates, compClient, compMonth, compSort]);

  const totalVideosCount = useMemo(() => {
    return allFilteredTasks.reduce((sum, t) => sum + (t.videos ?? 0), 0);
  }, [allFilteredTasks]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!canEdit) return;
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {[1, 2].map(i => <Box key={i} sx={{ minWidth: 280, flex: 1 }}><Skeleton variant="rounded" height={300} sx={{ borderRadius: 2 }} /></Box>)}
      </Box>
    );
  }

  return (
    <Fade in timeout={400}>
      <Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 320px' }, gap: 1.5, alignItems: 'start' }}>
          {/* Videos List */}
          <Box
            sx={{ borderRadius: 2, bgcolor: 'rgba(129,140,248,0.04)', border: '1px solid rgba(129,140,248,0.15)', p: 1.5, minHeight: 200 }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#818CF8' }} />
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Videos</Typography>
                <Chip label={`${totalVideosCount} vids`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(129,140,248,0.2)', color: 'primary.light', fontWeight: 700 }} />
                <Chip label={`${allFilteredTasks.length} tasks`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'text.secondary' }} />
              </Box>
              {canEdit && (
                <IconButton size="small" onClick={() => { setEditTask(null); setDialogOpen(true); }}><AddRoundedIcon fontSize="small" /></IconButton>
              )}
            </Box>
            <Box sx={{ mb: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FilterListRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Select value={compClient} onChange={e => setCompClient(e.target.value)} size="small" displayEmpty sx={{ fontSize: '0.72rem', flex: 1, '& .MuiSelect-select': { py: 0.5 } }}>
                  <MenuItem value="" sx={{ fontSize: '0.78rem' }}>All Clients</MenuItem>
                  {clients.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.78rem' }}>{c.name}</MenuItem>)}
                </Select>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SortRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Select value={compMonth} onChange={e => setCompMonth(e.target.value)} size="small" displayEmpty sx={{ fontSize: '0.72rem', flex: 1, '& .MuiSelect-select': { py: 0.5 } }}>
                  <MenuItem value="" sx={{ fontSize: '0.78rem' }}>All Months</MenuItem>
                  {monthOptions.map(m => <MenuItem key={m.value} value={m.value} sx={{ fontSize: '0.78rem' }}>{m.label}</MenuItem>)}
                </Select>
              </Box>
              <Select value={compSort} onChange={e => setCompSort(e.target.value as SortKey)} size="small" sx={{ fontSize: '0.72rem', '& .MuiSelect-select': { py: 0.5 } }}>
                {SORT_OPTIONS.map(o => <MenuItem key={o.key} value={o.key} sx={{ fontSize: '0.78rem' }}>{o.label}</MenuItem>)}
              </Select>
            </Box>
            {allFilteredTasks.map(t => (
              <Box key={t.id} draggable onDragStart={e => handleDragStart(e, t.id)} sx={{ opacity: dragId === t.id ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                <TaskCard task={t} onEdit={t => { setEditTask(t); setDialogOpen(true); }} onDelete={deleteTask} />
              </Box>
            ))}
            {allFilteredTasks.length === 0 && <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', textAlign: 'center', py: 4 }}>No videos match filters</Typography>}
          </Box>

          {/* Payments & Discounts */}
          <Box><PaymentEntry /></Box>
        </Box>

        <TaskDialog open={dialogOpen} task={editTask} onClose={() => { setDialogOpen(false); setEditTask(null); }} onSave={() => { setEditTask(null); setDialogOpen(false); }} />
      </Box>
    </Fade>
  );
}
