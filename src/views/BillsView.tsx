import { useState, useRef, useMemo } from 'react';
import {
  Box, Card, Typography, Button, Select, MenuItem, Chip,
  FormControl, InputLabel, TextField, Checkbox, FormControlLabel,
  Divider, Fade, Table, TableBody, TableCell, TableHead, TableRow,
  ToggleButtonGroup, ToggleButton, Snackbar, Alert,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { usePersistedState } from '../lib/usePersistedState';
import { calcTaskRevenueFull, formatCurrency, formatDate } from '../types';

type Period = 'all' | 'this_month' | 'last_month' | 'custom';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function BillsView() {
  const { tasks, clients, payments, discounts, salaryRates, settings, activeWorkspace } = useApp();
  const [clientFilter, setClientFilter] = usePersistedState('bills_clientFilter', '');
  const [period, setPeriod] = usePersistedState<Period>('bills_period', 'all');
  const [startDate, setStartDate] = usePersistedState('bills_startDate', '');
  const [endDate, setEndDate] = usePersistedState('bills_endDate', '');
  const [includePrice, setIncludePrice] = usePersistedState('bills_includePrice', true);
  const [includePaid, setIncludePaid] = usePersistedState('bills_includePaid', true);
  const [includeOldBalance, setIncludeOldBalance] = usePersistedState('bills_includeOldBalance', true);
  const [billTitle, setBillTitle] = usePersistedState('bills_title', '');
  const [snackMsg, setSnackMsg] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  const cur = (v: number) => formatCurrency(v, settings.currency);

  const getPeriodBounds = () => {
    const now = new Date();
    if (period === 'this_month') return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() };
    if (period === 'last_month') {
      const last = subMonths(now, 1);
      return { start: startOfMonth(last).toISOString(), end: endOfMonth(last).toISOString() };
    }
    if (period === 'custom' && startDate && endDate) return { start: new Date(startDate).toISOString(), end: new Date(endDate + 'T23:59:59').toISOString() };
    return { start: null, end: null };
  };

  const matchesPeriod = (item: { date: string; payment_for_months?: string[] }, bounds: { start: string | null; end: string | null }) => {
    if (!bounds.start) return true;
    if (item.payment_for_months && item.payment_for_months.length > 0) {
      return item.payment_for_months.some(ym => {
        const [y, m] = ym.split('-').map(Number);
        const mStart = startOfMonth(new Date(y, m - 1)).toISOString();
        const mEnd = endOfMonth(new Date(y, m - 1)).toISOString();
        return mStart >= bounds.start! && mEnd <= bounds.end!;
      });
    }
    return item.date >= bounds.start! && item.date <= bounds.end!;
  };

  const isBeforePeriod = (item: { date: string; payment_for_months?: string[] }, beforeStart: string) => {
    if (item.payment_for_months && item.payment_for_months.length > 0) {
      return item.payment_for_months.every(ym => {
        const [y, m] = ym.split('-').map(Number);
        const mStart = startOfMonth(new Date(y, m - 1)).toISOString();
        return mStart < beforeStart;
      });
    }
    return item.date < beforeStart;
  };

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (clientFilter) result = result.filter(t => t.client_id === clientFilter);
    const bounds = getPeriodBounds();
    if (bounds.start) result = result.filter(t => {
      const date = t.completed_date ?? t.received_date;
      return date && date >= bounds.start! && date <= bounds.end!;
    });
    return result.sort((a, b) => {
      const da = new Date(a.completed_date ?? a.received_date).getTime();
      const db = new Date(b.completed_date ?? b.received_date).getTime();
      if (da !== db) return da - db;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [tasks, clientFilter, period, startDate, endDate]);

  const totals = useMemo(() => {
    let total = 0;
    let totalVideos = 0;
    const clientIds = new Set(filteredTasks.map(t => t.client_id).filter(Boolean)) as Set<string>;
    filteredTasks.forEach(t => {
      const client = clients.find(c => c.id === t.client_id);
      const rev = calcTaskRevenueFull(t, client, salaryRates, tasks);
      total += rev;
      totalVideos += t.videos ?? 0;
    });
    const bounds = getPeriodBounds();
    const paidInPeriod = payments
      .filter(p => clientIds.has(p.client_id) && matchesPeriod(p, bounds))
      .reduce((s, p) => s + p.amount, 0);

    // Old balance: earned vs paid BEFORE the selected period for the same clients
    let oldBalance = 0;
    if (bounds.start) {
      const beforeStart = bounds.start;
      let oldEarned = 0;
      tasks
        .filter(t => t.client_id && clientIds.has(t.client_id) && (t.completed_date ?? t.received_date) && (t.completed_date ?? t.received_date) < beforeStart)
        .forEach(t => {
          const c = clients.find(c => c.id === t.client_id);
          oldEarned += calcTaskRevenueFull(t, c, salaryRates, tasks);
        });
      const oldPaid = payments
        .filter(p => clientIds.has(p.client_id) && isBeforePeriod(p, beforeStart))
        .reduce((s, p) => s + p.amount, 0);
      const oldDiscounts = discounts
        .filter(d => clientIds.has(d.client_id) && isBeforePeriod(d, beforeStart))
        .reduce((s, d) => s + d.amount, 0);
      oldBalance = oldEarned - oldPaid - oldDiscounts;
    }

    // Discounts in period
    const discountInPeriod = discounts
      .filter(d => clientIds.has(d.client_id) && matchesPeriod(d, bounds))
      .reduce((s, d) => s + d.amount, 0);

    const effectiveOldBalance = includeOldBalance ? oldBalance : 0;
    const rawBalance = total + effectiveOldBalance - paidInPeriod - discountInPeriod;
    const isOverpaid = rawBalance < 0;
    const balanceLabel = isOverpaid ? 'Overpaid' : 'Outstanding';

    const periodPayments = payments.filter(p => clientIds.has(p.client_id) && matchesPeriod(p, bounds));
    const paymentForMonthsSet = new Set<string>();
    periodPayments.forEach(p => { (p.payment_for_months || []).forEach(m => paymentForMonthsSet.add(m)); });
    const paymentForLabel = paymentForMonthsSet.size > 0
      ? Array.from(paymentForMonthsSet).sort().map(m => { const [y, mo] = m.split('-'); return new Date(+y, +mo - 1, 1).toLocaleDateString('en', { month: 'short', year: '2-digit' }); }).join(', ')
      : '';

    return { total, totalVideos, paidInPeriod, discountInPeriod, oldBalance: effectiveOldBalance, rawBalance, isOverpaid, balanceLabel, hasOldBalance: oldBalance !== 0, paymentForLabel };
  }, [filteredTasks, tasks, clients, payments, discounts, salaryRates, period, startDate, endDate, includeOldBalance]);

  const getTitle = () => {
    if (billTitle) return billTitle;
    const client = clients.find(c => c.id === clientFilter);
    const periodLabel = period === 'this_month' ? format(new Date(), 'MMMM yyyy') :
      period === 'last_month' ? format(subMonths(new Date(), 1), 'MMMM yyyy') : 'All Time';
    return client ? `${client.name} — ${periodLabel}` : `Work Report — ${periodLabel}`;
  };

  const copyWhatsApp = () => {
    const title = getTitle();
    const lines = [
      `*${title}*`,
      `📅 ${format(new Date(), 'MMMM d, yyyy')}`,
      '',
      `🎬 Videos: ${totals.totalVideos}   📋 Tasks: ${filteredTasks.length}`,
      '────────────────',
      ...filteredTasks.map((t, i) => {
        const client = clients.find(c => c.id === t.client_id);
        const rev = calcTaskRevenueFull(t, client, salaryRates, tasks);
        return `${i + 1}. ${t.title || 'Untitled'} — ${client?.name ?? 'N/A'} — ${t.videos ?? 0} vids — ${cur(rev)}`;
      }),
      '────────────────',
      `*Total: ${cur(totals.total)}*`,
      includePaid ? `*Received: ${cur(totals.paidInPeriod)}*` : '',
      totals.paymentForLabel ? `*Payment For: ${totals.paymentForLabel}*` : '',
      totals.discountInPeriod > 0 ? `*Discount: -${cur(totals.discountInPeriod)}*` : '',
      includePaid && totals.oldBalance !== 0 ? `*Old Balance: ${totals.oldBalance > 0 ? '' : '-'}${cur(Math.abs(totals.oldBalance))}*` : '',
      includePaid ? `*${totals.balanceLabel}: ${totals.isOverpaid ? '-' : ''}${cur(Math.abs(totals.rawBalance))}*` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines).then(() => setSnackMsg('Copied! Paste it in WhatsApp'));
  };

  const exportCSV = () => {
    const headers = ['Date', 'Title', 'Client', 'Videos', 'Amount'];
    const rows = filteredTasks.map(t => {
      const client = clients.find(c => c.id === t.client_id);
      return [
        formatDate(t.completed_date ?? t.received_date),
        t.title || 'Untitled',
        client?.name ?? 'N/A',
        t.videos ?? 0,
        calcTaskRevenueFull(t, client, salaryRates, tasks),
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${getTitle().replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    setSnackMsg('CSV downloaded');
  };

  const printBill = () => {
    const title = getTitle();
    const today = format(new Date(), 'MMMM d, yyyy');
    const rawBalance = totals.rawBalance;
    const balance = rawBalance;
    const isOverpaid = totals.isOverpaid;
    const balanceLabel = totals.balanceLabel;

    const rows = filteredTasks.map((t, i) => {
      const client = clients.find(c => c.id === t.client_id);
      const rev = calcTaskRevenueFull(t, client, salaryRates, tasks);
      const date = formatDate(t.completed_date ?? t.received_date);
      return `
        <tr>
          <td class="col-num">${String(i + 1).padStart(2, '0')}</td>
          <td class="col-date">${date}</td>
          <td class="col-title">${escapeHtml(t.title || 'Untitled')}</td>
          <td class="col-client">${escapeHtml(client?.name ?? '—')}</td>
          <td class="col-vids num">${t.videos ?? 0}</td>
          ${includePrice ? `<td class="col-amount num">${cur(rev)}</td>` : ''}
        </tr>`;
    }).join('');

    const summaryCards = [
      { label: 'Total Videos', value: String(totals.totalVideos) },
      { label: 'Total Tasks', value: String(filteredTasks.length) },
    ].map(s => `
      <div class="summary-card">
        <div class="summary-value">${s.value}</div>
        <div class="summary-label">${s.label}</div>
      </div>`).join('');

    const totalsBlock = `
      <div class="totals-box">
        ${includePrice ? `
        <div class="total-row">
          <span>Total</span>
          <span>${cur(totals.total)}</span>
        </div>` : ''}
        ${includePaid ? `
        <div class="total-row">
          <span>Received</span>
          <span class="received">${cur(totals.paidInPeriod)}</span>
        </div>
        ${totals.paymentForLabel ? `
        <div class="total-row" style="font-size:0.72rem">
          <span style="color:#818CF8">Payment For</span>
          <span style="color:#818CF8;font-weight:600">${totals.paymentForLabel}</span>
        </div>` : ''}
        ${totals.oldBalance !== 0 ? `
        <div class="total-row">
          <span>Old Balance</span>
          <span style="color:${totals.oldBalance > 0 ? '#EF4444' : '#10B981'};font-weight:700">${totals.oldBalance > 0 ? '' : '-'}${cur(Math.abs(totals.oldBalance))}</span>
        </div>` : ''}
        ${totals.discountInPeriod > 0 ? `
        <div class="total-row">
          <span>Discount</span>
          <span style="color:#A78BFA;font-weight:700">-${cur(totals.discountInPeriod)}</span>
        </div>` : ''}
        <div class="total-row total-final">
          <span>${balanceLabel}</span>
          <span class="${isOverpaid ? 'balance-overpaid' : balance > 0 ? 'balance-due' : 'balance-clear'}">${isOverpaid ? '-' : ''}${cur(Math.abs(balance))}</span>
        </div>` : ''}
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --ink: #0F172A;
    --muted: #64748B;
    --line: #E2E8F0;
    --accent: #6366F1;
    --bg: #F8FAFC;
  }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--ink);
    background: var(--bg);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    padding: 0;
  }
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 48px 56px;
  }
  @media print {
    body { background: #fff; }
    .page { max-width: none; margin: 0; padding: 32px 40px; }
  }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 36px;
    padding-bottom: 20px;
    border-bottom: 2px solid var(--ink);
  }
  .doc-title h1 {
    font-size: 1.65rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .doc-title .subtitle {
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 4px;
    font-weight: 500;
  }
  .doc-meta {
    text-align: right;
  }
  .doc-meta .date {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink);
  }
  .doc-meta .count {
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 3px;
  }
  .doc-badge {
    display: inline-block;
    margin-top: 8px;
    padding: 3px 10px;
    border-radius: 100px;
    background: var(--ink);
    color: #fff;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .summary-grid {
    display: flex;
    gap: 12px;
    margin-bottom: 32px;
  }
  .summary-card {
    flex: 1;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px 18px;
  }
  .summary-value {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .summary-label {
    font-size: 0.68rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    margin-top: 2px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 28px;
  }
  thead th {
    text-align: left;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--muted);
    padding: 10px 8px;
    border-bottom: 2px solid var(--ink);
  }
  thead th.num { text-align: right; }
  tbody td {
    font-size: 0.82rem;
    padding: 11px 8px;
    border-bottom: 1px solid var(--line);
    vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.col-num {
    color: var(--muted);
    font-weight: 600;
    font-size: 0.72rem;
    width: 28px;
  }
  td.col-date { color: var(--muted); white-space: nowrap; width: 90px; }
  td.col-title { font-weight: 600; }
  td.col-client { color: var(--muted); }
  td.col-amount { font-weight: 700; color: var(--accent); }
  .totals-box {
    margin-left: auto;
    width: 260px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    font-size: 0.85rem;
  }
  .total-row span:first-child { color: var(--muted); font-weight: 500; }
  .total-row span:last-child { font-weight: 700; font-variant-numeric: tabular-nums; }
  .total-row .received { color: #10B981; }
  .total-final {
    border-top: 2px solid var(--ink);
    margin-top: 4px;
    padding-top: 12px;
  }
  .total-final span:first-child { color: var(--ink); font-weight: 700; font-size: 0.9rem; }
  .balance-due { color: #EF4444; font-size: 1.05rem; font-weight: 800; }
  .balance-clear { color: #10B981; font-size: 1.05rem; font-weight: 800; }
  .balance-overpaid { color: #EF4444; font-size: 1.05rem; font-weight: 800; }
  .doc-footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    text-align: center;
    font-size: 0.68rem;
    color: var(--muted);
  }
  @page { margin: 0.5in; }
</style>
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <div class="doc-title">
        <h1>${escapeHtml(title)}</h1>
        <div class="subtitle">${escapeHtml(activeWorkspace?.name ?? '')}</div>
        <span class="doc-badge">Invoice</span>
      </div>
      <div class="doc-meta">
        <div class="date">${today}</div>
        <div class="count">${filteredTasks.length} project${filteredTasks.length !== 1 ? 's' : ''}</div>
      </div>
    </div>

    <div class="summary-grid">${summaryCards}</div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Project</th>
          <th>Client</th>
          <th class="num">Videos</th>
          ${includePrice ? '<th class="num">Amount</th>' : ''}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${totalsBlock}

    <div class="doc-footer">
      Generated on ${today} &middot; ${escapeHtml(title)}
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <Fade in timeout={400}>
      <Box sx={{ pb: 3 }}>
        {/* Filters */}
        <Card sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <FilterListRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Filters</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 200 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Client</InputLabel>
                <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)} label="Client">
                  <MenuItem value="">All Clients</MenuItem>
                  {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ width: '100%' }}>
              <ToggleButtonGroup value={period} exclusive onChange={(_, v) => v && setPeriod(v)} size="small" fullWidth>
                {(['all', 'this_month', 'last_month', 'custom'] as Period[]).map(p => (
                  <ToggleButton key={p} value={p} sx={{ fontSize: '0.72rem', py: 0.75 }}>
                    {p === 'all' ? 'All' : p === 'this_month' ? 'This Month' : p === 'last_month' ? 'Last Month' : 'Custom'}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            {period === 'custom' && (
              <>
                <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
                  <TextField size="small" type="date" label="From" fullWidth value={startDate} onChange={e => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Box>
                <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
                  <TextField size="small" type="date" label="To" fullWidth value={endDate} onChange={e => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Box>
              </>
            )}
          </Box>
        </Card>

        {/* Bill Preview */}
        <Card sx={{ mb: 2, overflow: 'visible' }}>
          {/* Print area */}
          <Box
            ref={previewRef}
            id="bill-preview"
            sx={{ p: 2, '@media print': { p: 4 } }}
          >
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}>
                {format(new Date(), 'MMMM d, yyyy')}
              </Typography>
              <TextField
                value={billTitle || getTitle()}
                onChange={e => setBillTitle(e.target.value)}
                variant="standard"
                inputProps={{ style: { textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' } }}
                sx={{ '& .MuiInput-underline:before': { borderColor: 'transparent' }, mb: 0.5 }}
                fullWidth
                placeholder={getTitle()}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {filteredTasks.length} project{filteredTasks.length !== 1 ? 's' : ''}
              </Typography>
            </Box>

            {/* Summary */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              {[
                { label: 'Total Videos', value: totals.totalVideos, color: '#FBBF24' },
                { label: 'Total Tasks', value: filteredTasks.length, color: '#818CF8' },
                { label: 'Total Amount', value: cur(totals.total), color: '#34D399' },
              ].map(s => (
                <Box key={s.label} sx={{ flex: '1 1 calc(33% - 8px)', minWidth: 0, textAlign: 'center', p: 1, borderRadius: 2, bgcolor: `${s.color}15` }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.66rem', textTransform: 'uppercase' }}>{s.label}</Typography>
                </Box>
              ))}
            </Box>

            {/* Task table */}
            <Box sx={{ overflowX: 'auto', mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>Project</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>Client</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>Vids</TableCell>
                    {includePrice && <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>Amount</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTasks.map(t => {
                    const client = clients.find(c => c.id === t.client_id);
                    const rev = calcTaskRevenueFull(t, client, salaryRates, tasks);
                    return (
                      <TableRow key={t.id} sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell sx={{ fontSize: '0.76rem', py: 0.75 }}>{formatDate(t.completed_date ?? t.received_date)}</TableCell>
                        <TableCell sx={{ fontSize: '0.76rem', fontWeight: 600, py: 0.75 }}>{t.title || 'Untitled'}</TableCell>
                        <TableCell sx={{ fontSize: '0.76rem', py: 0.75 }}>
                          {client ? <Chip label={client.name} size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: `${client.color}22`, color: client.color, '& .MuiChip-label': { px: 0.75 } }} /> : 'N/A'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.76rem', py: 0.75 }}>{t.videos ?? 0}</TableCell>
                        {includePrice && <TableCell align="right" sx={{ fontSize: '0.76rem', fontWeight: 700, color: '#818CF8', py: 0.75 }}>{cur(rev)}</TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>

            {/* Totals */}
            <Divider sx={{ mb: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ minWidth: 200, textAlign: 'right' }}>
                {includePrice && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Total</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#818CF8' }}>{cur(totals.total)}</Typography>
                  </Box>
                )}
                {totals.hasOldBalance && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={includeOldBalance}
                          onChange={e => setIncludeOldBalance(e.target.checked)}
                          sx={{ p: 0.5 }}
                        />
                      }
                      label={<Typography variant="caption" sx={{ color: 'text.secondary' }}>Old Balance</Typography>}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 700, color: totals.oldBalance > 0 ? '#F87171' : '#34D399' }}>
                      {totals.oldBalance > 0 ? '' : '-'}{cur(Math.abs(totals.oldBalance))}
                    </Typography>
                  </Box>
                )}
                {includePaid && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">Received</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#34D399' }}>{cur(totals.paidInPeriod)}</Typography>
                    </Box>
                    {totals.paymentForLabel && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ color: '#818CF8' }}>Payment For</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#818CF8' }}>{totals.paymentForLabel}</Typography>
                      </Box>
                    )}
                    {totals.discountInPeriod > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">Discount</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#A78BFA' }}>-{cur(totals.discountInPeriod)}</Typography>
                      </Box>
                    )}
                    <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.08)' }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>{totals.balanceLabel}</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: totals.isOverpaid ? '#EF4444' : totals.rawBalance > 0 ? '#F87171' : '#34D399' }}>
                        {totals.isOverpaid ? '-' : ''}{cur(Math.abs(totals.rawBalance))}
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          </Box>

          {/* Options */}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ p: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel control={<Checkbox checked={includePrice} onChange={e => setIncludePrice(e.target.checked)} size="small" />} label={<Typography variant="caption">Amounts</Typography>} />
            <FormControlLabel control={<Checkbox checked={includePaid} onChange={e => setIncludePaid(e.target.checked)} size="small" />} label={<Typography variant="caption">Payments</Typography>} />
          </Box>
        </Card>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
            <Button variant="outlined" fullWidth startIcon={<ContentCopyRoundedIcon />} onClick={copyWhatsApp}>
              WhatsApp
            </Button>
          </Box>
          <Box sx={{ flex: '1 1 calc(50% - 6px)', minWidth: 0 }}>
            <Button variant="outlined" fullWidth startIcon={<DownloadRoundedIcon />} onClick={exportCSV}>
              CSV
            </Button>
          </Box>
          <Box sx={{ flex: '1 1 100%', minWidth: 0 }}>
            <Button variant="contained" fullWidth startIcon={<PrintRoundedIcon />} onClick={printBill}>
              Print / Save PDF
            </Button>
          </Box>
        </Box>

        <Snackbar open={!!snackMsg} autoHideDuration={2500} onClose={() => setSnackMsg('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="success" variant="filled" onClose={() => setSnackMsg('')}>{snackMsg}</Alert>
        </Snackbar>
      </Box>
    </Fade>
  );
}
