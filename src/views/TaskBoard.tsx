import React, { useState, useMemo } from 'react';
import { usePersistedState } from '../lib/usePersistedState';
import {
  Box, Card, Typography, Chip, IconButton, Fade,
  Select, MenuItem, Button, Skeleton, Checkbox, ListItemText, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButton, ToggleButtonGroup,
  InputAdornment, Tooltip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import DiscountRoundedIcon from '@mui/icons-material/DiscountRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { calcTaskRevenueFull, formatCurrency, formatDate, PAYMENT_METHODS } from '../types';
import type { Task, Payment, Discount } from '../types';
import TaskDialog from '../components/TaskDialog';

type SortKey = 'date_desc' | 'date_asc' | 'title' | 'revenue_desc' | 'revenue_asc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date_desc', label: 'Newest Date' },
  { key: 'date_asc', label: 'Oldest Date' },
  { key: 'title', label: 'Title (A-Z)' },
  { key: 'revenue_desc', label: 'Revenue (High → Low)' },
  { key: 'revenue_asc', label: 'Revenue (Low → High)' },
];

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
      renderValue={selected => selected.length === 0 ? 'Link to bill month(s)...' : selected.map(monthLabel).join(', ')}
      sx={{ fontSize: '0.82rem' }}
    >
      {Array.from({ length: 18 }).map((_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - 12 + i);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return (
          <MenuItem key={val} value={val} dense>
            <Checkbox size="small" checked={value.includes(val)} sx={{ p: 0.5 }} />
            <ListItemText primary={d.toLocaleDateString('en', { month: 'long', year: 'numeric' })} sx={{ '& .MuiListItemText-primary': { fontSize: '0.8rem' } }} />
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
  const sym = currency === 'INR' ? '₹' : '$';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', backgroundImage: 'none', border: '1px solid rgba(255,255,255,0.1)' } }}>
      <DialogTitle sx={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        {isPayment ? <PaymentsRoundedIcon sx={{ color: '#34D399' }} /> : <DiscountRoundedIcon sx={{ color: '#A78BFA' }} />}
        Edit {isPayment ? 'Payment' : 'Discount'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
        <Select value={(item as Payment).client_id} disabled size="small" sx={{ fontSize: '0.85rem' }}>
          <MenuItem value={(item as Payment).client_id}>{clients.find(c => c.id === (item as Payment).client_id)?.name ?? 'Unknown'}</MenuItem>
        </Select>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField size="small" type="date" label="Date" value={date} onChange={e => setDate(e.target.value)} />
          <TextField size="small" type="number" label={`Amount (${sym})`} value={amount} onChange={e => setAmount(e.target.value)} />
        </Box>
        {isPayment && (
          <Select value={method} onChange={e => setMethod(e.target.value)} size="small" sx={{ fontSize: '0.85rem' }}>
            {PAYMENT_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        )}
        <MonthSelect value={paymentForMonths} onChange={setPaymentForMonths} />
        <TextField size="small" label="Note / Reference" value={note} onChange={e => setNote(e.target.value)} fullWidth />
      </DialogContent>
      <DialogActions sx={{ p: 2.5, pt: 0 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" size="small" onClick={() => onSave({
          amount: parseFloat(amount) || 0,
          method: isPayment ? method : undefined,
          note,
          date: new Date(date + 'T12:00:00').toISOString(),
          payment_for_months: paymentForMonths,
        } as Partial<Payment>)} sx={{ bgcolor: isPayment ? '#34D399' : '#A78BFA', color: '#111827', fontWeight: 700 }}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Task Card in Modern Grid Layout
function TaskGridCard({ task, onEdit, onDelete }: {
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
      onDoubleClick={() => canEdit && onEdit(task)}
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: client ? `${client.color}35` : 'rgba(255,255,255,0.08)',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.2s ease',
        cursor: canEdit ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: client ? client.color : 'primary.main',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          '& .card-actions': { opacity: 1 },
        },
      }}
    >
      {/* Top Accent Bar */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: client?.color || 'primary.main' }} />

      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1, pr: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 800, fontSize: '0.96rem', letterSpacing: '-0.01em', lineHeight: 1.3, mb: 0.5 }}>
              {task.title || 'Untitled Task'}
            </Typography>
            {task.description && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4, fontSize: '0.74rem' }}>
                {task.description}
              </Typography>
            )}
          </Box>

          {/* Action buttons (always available on mobile, on hover on desktop) */}
          {canEdit && (
            <Box className="card-actions" sx={{ display: 'flex', gap: 0.5, opacity: { xs: 1, sm: 0.75 }, transition: 'opacity 0.15s' }}>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(task); }} sx={{ width: 28, height: 28, bgcolor: 'rgba(255,255,255,0.06)' }}>
                <EditRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} sx={{ width: 28, height: 28, bgcolor: 'rgba(248,113,113,0.1)', color: '#F87171' }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Client & Tags */}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
          {client ? (
            <Chip
              size="small"
              label={client.name}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                bgcolor: `${client.color}18`,
                color: client.color,
                fontWeight: 700,
                border: `1px solid ${client.color}35`,
              }}
            />
          ) : (
            <Chip size="small" label="No Client" sx={{ height: 22, fontSize: '0.68rem', bgcolor: 'rgba(255,255,255,0.05)' }} />
          )}

          <Chip
            icon={<VideoLibraryRoundedIcon sx={{ fontSize: '13px !important' }} />}
            label={`${task.videos ?? 1} video${(task.videos ?? 1) > 1 ? 's' : ''}`}
            size="small"
            sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600, bgcolor: 'rgba(255,255,255,0.05)' }}
          />

          {task.status && (
            <Chip
              label={task.status}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 700,
                bgcolor: task.status === 'Completed' ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
                color: task.status === 'Completed' ? '#34D399' : '#F59E0B',
              }}
            />
          )}
        </Box>
      </Box>

      {/* Card Footer: Date & Revenue */}
      <Box sx={{ pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
          <CalendarMonthRoundedIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption" sx={{ fontSize: '0.72rem' }}>
            {formatDate(dateStr)}
          </Typography>
        </Box>

        {rev > 0 && (
          <Box sx={{ px: 1.25, py: 0.4, borderRadius: 1.5, bgcolor: 'primary.main', color: '#fff', fontWeight: 800, fontSize: '0.82rem' }}>
            {cur(rev)}
          </Box>
        )}
      </Box>
    </Card>
  );
}

// Task Card in Compact List Layout
function TaskListRow({ task, onEdit, onDelete }: {
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
      onDoubleClick={() => canEdit && onEdit(task)}
      sx={{
        mb: 1,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `4px solid ${client?.color || '#818CF8'}`,
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        cursor: canEdit ? 'pointer' : 'default',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title || 'Untitled'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            {client && (
              <Typography variant="caption" sx={{ color: client.color, fontWeight: 700, fontSize: '0.72rem' }}>
                {client.name}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
              • {formatDate(dateStr)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
          <VideoLibraryRoundedIcon sx={{ fontSize: 13 }} />
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{task.videos ?? 1}</Typography>
        </Box>

        {rev > 0 && (
          <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.light', minWidth: 80, textAlign: 'right', fontSize: '0.88rem' }}>
            {cur(rev)}
          </Typography>
        )}
      </Box>

      {canEdit && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => onEdit(task)}>
            <EditRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(task.id)} sx={{ color: '#F87171' }}>
            <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      )}
    </Card>
  );
}

// Payments & Ledger View (Spacious Layout)
function PaymentsSection() {
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
  const netReceived = total - discTotal;

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
    <Box>
      {/* Financial KPI Highlights */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5, mb: 3 }}>
        <Card sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid rgba(52,211,153,0.2)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Payments Received</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#34D399', mt: 0.5 }}>{cur(total)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>{filtered.length} transactions</Typography>
        </Card>

        <Card sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid rgba(167,139,250,0.2)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Total Discounts Applied</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#A78BFA', mt: 0.5 }}>-{cur(discTotal)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>{filteredDiscounts.length} deductions</Typography>
        </Card>

        <Card sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid rgba(129,140,248,0.2)' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Net Realized Balance</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#818CF8', mt: 0.5 }}>{cur(netReceived)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>After all discounts</Typography>
        </Card>
      </Box>

      {/* Main 2-column layout */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, gap: 2.5, alignItems: 'start' }}>
        {/* Left: Transaction History */}
        <Card sx={{ p: 2.5, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Transaction History</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Ledger of client payments & deductions</Typography>
            </Box>

            <Select
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
              size="small"
              displayEmpty
              sx={{ minWidth: 150, fontSize: '0.82rem' }}
            >
              <MenuItem value="">All Clients</MenuItem>
              {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 500, overflowY: 'auto', pr: 0.5 }}>
            {unifiedList.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
                <AccountBalanceWalletRoundedIcon sx={{ fontSize: 36, mb: 1, opacity: 0.5 }} />
                <Typography variant="body2">No payments or discounts recorded yet</Typography>
              </Box>
            ) : (
              unifiedList.map(item => {
                const client = clients.find(c => c.id === item.client_id);
                const isDisc = item.type === 'discount';
                return (
                  <Box
                    key={item.type + item.id}
                    onDoubleClick={() => canEdit && setEditItem({ type: item.type, id: item.id })}
                    sx={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: 2,
                      bgcolor: isDisc ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid',
                      borderColor: isDisc ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)',
                      borderLeft: `4px solid ${isDisc ? '#A78BFA' : (client?.color || '#34D399')}`,
                      cursor: canEdit ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: isDisc ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.06)' },
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                        {isDisc && <DiscountRoundedIcon sx={{ fontSize: 14, color: '#A78BFA' }} />}
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{client?.name ?? 'Unknown Client'}</Typography>
                        <Chip
                          label={isDisc ? 'Discount' : (item.method || 'Cash')}
                          size="small"
                          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 600, bgcolor: isDisc ? 'rgba(167,139,250,0.15)' : 'rgba(52,211,153,0.15)', color: isDisc ? '#A78BFA' : '#34D399' }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {formatDate(item.date)}{item.note ? ` • "${item.note}"` : ''}
                      </Typography>
                      {item.payment_for_months.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 600, fontSize: '0.68rem', display: 'block', mt: 0.25 }}>
                          For Bill Month(s): {item.payment_for_months.map(monthLabel).join(', ')}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: isDisc ? '#A78BFA' : '#34D399', fontSize: '0.98rem' }}>
                        {isDisc ? '-' : ''}{cur(item.amount)}
                      </Typography>
                      {canEdit && (
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          <IconButton size="small" onClick={() => setEditItem({ type: item.type, id: item.id })}>
                            <EditRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => isDisc ? deleteDiscount(item.id) : deletePayment(item.id)} sx={{ color: '#F87171' }}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Card>

        {/* Right: New Entry Card */}
        {canEdit ? (
          <Card sx={{ p: 2.5, bgcolor: 'background.paper' }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Record Entry</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
              Add a client payment or apply an adjustment/discount
            </Typography>

            <ToggleButtonGroup
              value={entryType}
              exclusive
              size="small"
              fullWidth
              onChange={(_, v) => v && setEntryType(v)}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="payment" sx={{ color: isPayment ? '#34D399 !important' : 'inherit', bgcolor: isPayment ? 'rgba(52,211,153,0.12) !important' : 'transparent', fontWeight: 700, textTransform: 'none' }}>
                <PaymentsRoundedIcon sx={{ fontSize: 16, mr: 0.75 }} /> Payment Received
              </ToggleButton>
              <ToggleButton value="discount" sx={{ color: !isPayment ? '#A78BFA !important' : 'inherit', bgcolor: !isPayment ? 'rgba(167,139,250,0.12) !important' : 'transparent', fontWeight: 700, textTransform: 'none' }}>
                <DiscountRoundedIcon sx={{ fontSize: 16, mr: 0.75 }} /> Discount / Waiver
              </ToggleButton>
            </ToggleButtonGroup>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                size="small"
                displayEmpty
                fullWidth
              >
                <MenuItem value="" disabled>Select Client *</MenuItem>
                {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </Select>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <TextField
                  size="small"
                  type="date"
                  label="Date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                {isPayment ? (
                  <Select value={method} onChange={e => setMethod(e.target.value)} size="small">
                    {PAYMENT_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>
                ) : (
                  <TextField
                    size="small"
                    label="Reason"
                    placeholder="e.g. Courtesy discount"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                )}
              </Box>

              <MonthSelect value={paymentForMonths} onChange={setPaymentForMonths} />

              {isPayment && (
                <TextField
                  size="small"
                  label="Note / Reference"
                  placeholder="e.g. UPI Ref #93821"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  fullWidth
                />
              )}

              <TextField
                size="small"
                type="number"
                label="Amount"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {settings.currency === 'INR' ? '₹' : '$'}
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                variant="contained"
                size="large"
                onClick={handleAdd}
                disabled={!clientId || !amount}
                startIcon={<AddRoundedIcon />}
                sx={{
                  bgcolor: accentColor,
                  color: '#111827',
                  '&:hover': { bgcolor: accentColor, filter: 'brightness(1.1)' },
                  fontWeight: 800,
                  textTransform: 'none',
                  py: 1,
                  mt: 0.5,
                }}
              >
                Save {isPayment ? 'Payment' : 'Discount'}
              </Button>
            </Box>
          </Card>
        ) : (
          <Card sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {currentRole === 'viewer' ? 'Viewer access (Read Only)' : 'Read-only mode (Offline)'}
            </Typography>
          </Card>
        )}
      </Box>

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
  const [activeTab, setActiveTab] = useState<'tasks' | 'payments'>('tasks');
  const [viewMode, setViewMode] = usePersistedState<'grid' | 'list'>('tb_viewMode', 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

    // Client filter
    if (compClient) result = result.filter(t => t.client_id === compClient);

    // Month filter
    if (compMonth) {
      const [yr, mo] = compMonth.split('-').map(Number);
      const start = startOfMonth(new Date(yr, mo - 1)).toISOString();
      const end = endOfMonth(new Date(yr, mo - 1)).toISOString();
      result = result.filter(t => {
        const d = t.completed_date ?? t.received_date;
        return d && d >= start && d <= end;
      });
    }

    // Search query filter (title, client name, description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => {
        const client = clients.find(c => c.id === t.client_id);
        const titleMatch = (t.title || '').toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const clientMatch = client ? client.name.toLowerCase().includes(q) : false;
        return titleMatch || descMatch || clientMatch;
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
  }, [tasks, clients, salaryRates, compClient, compMonth, compSort, searchQuery]);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: 2 }} />)}
      </Box>
    );
  }

  return (
    <Fade in timeout={400}>
      <Box sx={{ pb: 4 }}>
        {/* Section Navigation Tabs & Primary Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
          <ToggleButtonGroup
            value={activeTab}
            exclusive
            onChange={(_, v) => v && setActiveTab(v)}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.04)', p: 0.5, borderRadius: 2 }}
          >
            <ToggleButton
              value="tasks"
              sx={{
                borderRadius: 1.5, px: 2, py: 0.75, textTransform: 'none', fontWeight: 700, fontSize: '0.85rem',
                '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff' },
              }}
            >
              <VideoLibraryRoundedIcon sx={{ fontSize: 16, mr: 0.75 }} />
              Video Tasks ({allFilteredTasks.length})
            </ToggleButton>

            <ToggleButton
              value="payments"
              sx={{
                borderRadius: 1.5, px: 2, py: 0.75, textTransform: 'none', fontWeight: 700, fontSize: '0.85rem',
                '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff' },
              }}
            >
              <PaymentsRoundedIcon sx={{ fontSize: 16, mr: 0.75 }} />
              Payments & Ledger
            </ToggleButton>
          </ToggleButtonGroup>

          {activeTab === 'tasks' && canEdit && (
            <Button
              variant="contained"
              size="medium"
              startIcon={<AddRoundedIcon />}
              onClick={() => { setEditTask(null); setDialogOpen(true); }}
              sx={{ textTransform: 'none', fontWeight: 700, px: 2.5, borderRadius: 2 }}
            >
              Add New Task
            </Button>
          )}
        </Box>

        {/* TAB 1: Tasks View */}
        {activeTab === 'tasks' && (
          <Box>
            {/* Filter & Search Bar */}
            <Card sx={{ p: 1.5, mb: 2.5, bgcolor: 'background.paper', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search Bar */}
                <TextField
                  size="small"
                  placeholder="Search tasks, clients..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ flex: '1 1 200px', minWidth: 160 }}
                />

                {/* Client Filter */}
                <Select
                  value={compClient}
                  onChange={e => setCompClient(e.target.value)}
                  size="small"
                  displayEmpty
                  sx={{ minWidth: 140, fontSize: '0.82rem' }}
                >
                  <MenuItem value="">All Clients</MenuItem>
                  {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>

                {/* Month Filter */}
                <Select
                  value={compMonth}
                  onChange={e => setCompMonth(e.target.value)}
                  size="small"
                  displayEmpty
                  sx={{ minWidth: 130, fontSize: '0.82rem' }}
                >
                  <MenuItem value="">All Months</MenuItem>
                  {monthOptions.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </Select>

                {/* Sort Dropdown */}
                <Select
                  value={compSort}
                  onChange={e => setCompSort(e.target.value as SortKey)}
                  size="small"
                  sx={{ minWidth: 140, fontSize: '0.82rem' }}
                >
                  {SORT_OPTIONS.map(o => <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>)}
                </Select>

                {/* View Mode Toggle: Grid vs List */}
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, v) => v && setViewMode(v)}
                  size="small"
                  sx={{ ml: 'auto' }}
                >
                  <ToggleButton value="grid" aria-label="Grid view">
                    <Tooltip title="Grid View"><GridViewRoundedIcon fontSize="small" /></Tooltip>
                  </ToggleButton>
                  <ToggleButton value="list" aria-label="List view">
                    <Tooltip title="List View"><ViewListRoundedIcon fontSize="small" /></Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Card>

            {/* Tasks Render: Grid or List */}
            {allFilteredTasks.length === 0 ? (
              <Card sx={{ py: 8, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                <VideoLibraryRoundedIcon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5, opacity: 0.5 }} />
                <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.secondary' }}>No tasks found</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
                  Try adjusting your filters, search terms, or click "Add New Task" to create one.
                </Typography>
              </Card>
            ) : viewMode === 'grid' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                {allFilteredTasks.map(t => (
                  <TaskGridCard
                    key={t.id}
                    task={t}
                    onEdit={task => { setEditTask(task); setDialogOpen(true); }}
                    onDelete={deleteTask}
                  />
                ))}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {allFilteredTasks.map(t => (
                  <TaskListRow
                    key={t.id}
                    task={t}
                    onEdit={task => { setEditTask(task); setDialogOpen(true); }}
                    onDelete={deleteTask}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* TAB 2: Payments & Ledger View */}
        {activeTab === 'payments' && (
          <PaymentsSection />
        )}

        {/* Task Dialog */}
        <TaskDialog
          open={dialogOpen}
          task={editTask}
          onClose={() => { setDialogOpen(false); setEditTask(null); }}
          onSave={() => { setEditTask(null); setDialogOpen(false); }}
        />
      </Box>
    </Fade>
  );
}
