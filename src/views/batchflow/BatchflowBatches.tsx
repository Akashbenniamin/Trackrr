import { useState, useRef } from 'react';
import {
  Box, Card, Typography, Button, TextField, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Select, MenuItem, InputLabel, FormControl, Divider, Tooltip,
  Paper, Alert, LinearProgress,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useApp } from '../../contexts/AppContext';
import { usePersistedState } from '../../lib/usePersistedState';
import type { BatchflowVideo, BatchflowVideoStatus } from '../../types';

const STATUS_COLORS: Record<BatchflowVideoStatus, { bg: string; text: string; border: string }> = {
  Pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.4)' },
  Edited: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.4)' },
  Posted: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.4)' },
};

const VIDEO_CARD_STYLES: Record<BatchflowVideoStatus, {
  borderLeft: string;
  border: string;
  bgcolor: string;
  badgeBg: string;
  badgeColor: string;
  glow: string;
}> = {
  Pending: {
    borderLeft: '4px solid #F59E0B',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    bgcolor: 'rgba(245, 158, 11, 0.05)',
    badgeBg: 'rgba(245, 158, 11, 0.18)',
    badgeColor: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.18)',
  },
  Edited: {
    borderLeft: '4px solid #3B82F6',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    bgcolor: 'rgba(59, 130, 246, 0.05)',
    badgeBg: 'rgba(59, 130, 246, 0.18)',
    badgeColor: '#3B82F6',
    glow: 'rgba(59, 130, 246, 0.18)',
  },
  Posted: {
    borderLeft: '4px solid #10B981',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    bgcolor: 'rgba(16, 185, 129, 0.06)',
    badgeBg: 'rgba(16, 185, 129, 0.18)',
    badgeColor: '#10B981',
    glow: 'rgba(16, 185, 129, 0.18)',
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#818CF8').replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 0,
      parseInt(clean[1] + clean[1], 16) || 0,
      parseInt(clean[2] + clean[2], 16) || 0,
    ];
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return [r, g, b];
}

// Formatted Script Parser Component
function FormattedScriptViewer({ text }: { text: string }) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!text || !text.trim()) {
    return (
      <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', py: 3, textAlign: 'center' }}>
        No script written for this batch yet. Click "Edit Script" above to paste or write your master script.
      </Typography>
    );
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const processLineContent = (content: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <Box component="span" key={i} sx={{ color: '#F59E0B', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </Box>
        );
      }
      const linkParts = part.split(urlRegex);
      return linkParts.map((lPart, j) => {
        if (lPart.match(urlRegex)) {
          return (
            <Box
              component="a"
              key={`${i}-${j}`}
              href={lPart}
              target="_blank"
              rel="noreferrer"
              sx={{ color: '#3B82F6', textDecoration: 'underline' }}
            >
              {lPart}
            </Box>
          );
        }
        return lPart;
      });
    });
  };

  const sections = text.split(/(?=script\s*[-\s]?\s*\d+)/gi).filter(s => s.trim().length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={copiedSection === 'full' ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
          onClick={() => handleCopy(text, 'full')}
          sx={{ textTransform: 'none', fontSize: '0.75rem', borderRadius: 1 }}
        >
          {copiedSection === 'full' ? 'Copied Full Script!' : 'Copy Entire Script'}
        </Button>
      </Box>

      {sections.map((section, sIdx) => {
        const lines = section.trim().split('\n');
        const firstLine = lines[0];
        const match = firstLine.match(/^(script\s*[-\s]?\s*\d+)(.*)/i);
        const sectionId = `sec-${sIdx}`;

        return (
          <Paper
            key={sIdx}
            elevation={0}
            sx={{
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.02)',
            }}
          >
            {match ? (
              <>
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    bgcolor: 'primary.main',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {match[1]} {match[2] && `• ${match[2].trim()}`}
                  </Typography>
                  <Tooltip title={copiedSection === sectionId ? 'Copied!' : 'Copy this section'}>
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(section.trim(), sectionId)}
                      sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
                    >
                      {copiedSection === sectionId ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {lines.slice(1).map((line, lIdx) => {
                    const seqMatch = line.match(/^(\d+)\s*[\.\)]?\s*(.*)/);
                    if (seqMatch) {
                      return (
                        <Box key={lIdx} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              borderRadius: 1,
                              bgcolor: 'rgba(129,140,248,0.2)',
                              color: 'primary.light',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              flexShrink: 0,
                              mt: 0.25,
                            }}
                          >
                            {seqMatch[1]}
                          </Box>
                          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, flex: 1 }}>
                            {processLineContent(seqMatch[2])}
                          </Typography>
                        </Box>
                      );
                    }
                    return line.trim() ? (
                      <Typography key={lIdx} variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                        {processLineContent(line)}
                      </Typography>
                    ) : (
                      <Box key={lIdx} sx={{ height: 6 }} />
                    );
                  })}
                </Box>
              </>
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {processLineContent(section)}
                </Typography>
              </Box>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}

export default function BatchflowBatches() {
  const {
    batchflowClients, batchflowBatches, batchflowVideos,
    addBatchflowBatch, updateBatchflowBatch, deleteBatchflowBatch,
    addBatchflowVideo, updateBatchflowVideo, updateBatchflowVideoStatus, deleteBatchflowVideo,
    canEdit,
  } = useApp();

  const activeClients = batchflowClients.filter(c => !c.archived);
  const activeBatches = batchflowBatches.filter(b => !b.archived);

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(activeBatches[0]?.id || null);
  const selectedBatch = activeBatches.find(b => b.id === selectedBatchId) || activeBatches[0] || null;

  const [sortOrder, setSortOrder] = usePersistedState<
    'script_asc' | 'script_desc' | 'status_pending' | 'status_posted' | 'name_asc'
  >('trackrr_batchflow_video_sort', 'script_asc');

  // Dialog states
  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({
    clientId: activeClients[0]?.id || '',
    name: '',
    shootDate: new Date().toISOString().slice(0, 10),
    videoCount: 10,
    namingMethod: 'ClientName',
    script: '',
  });

  const [scriptEditOpen, setScriptEditOpen] = useState(false);
  const [scriptDraft, setScriptDraft] = useState('');

  const [editBatchOpen, setEditBatchOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<{ id: string; name: string; shoot_date: string; client_id: string } | null>(null);

  const handleOpenEditBatch = (b?: typeof selectedBatch) => {
    const target = b || selectedBatch;
    if (!target) return;
    setEditingBatch({
      id: target.id,
      name: target.name,
      shoot_date: target.shoot_date || '',
      client_id: target.client_id,
    });
    setEditBatchOpen(true);
  };

  const handleSaveEditBatch = async () => {
    if (!editingBatch || !editingBatch.name.trim()) return;
    await updateBatchflowBatch(editingBatch.id, {
      name: editingBatch.name.trim(),
      shoot_date: editingBatch.shoot_date,
      client_id: editingBatch.client_id,
    });
    setEditBatchOpen(false);
  };

  const [editVideoOpen, setEditVideoOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<{ id: string; name: string; script_number: number } | null>(null);

  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [newVideoName, setNewVideoName] = useState('');

  const reportRef = useRef<HTMLDivElement>(null);

  const statusPriorityPendingFirst: Record<BatchflowVideoStatus, number> = { Pending: 1, Edited: 2, Posted: 3 };
  const statusPriorityPostedFirst: Record<BatchflowVideoStatus, number> = { Posted: 1, Edited: 2, Pending: 3 };

  const currentBatchVideos = batchflowVideos.filter(v => v.batch_id === selectedBatch?.id);
  const sortedVideos = [...currentBatchVideos].sort((a, b) => {
    if (sortOrder === 'script_asc') return (a.script_number || 0) - (b.script_number || 0);
    if (sortOrder === 'script_desc') return (b.script_number || 0) - (a.script_number || 0);
    if (sortOrder === 'status_pending') {
      const diff = (statusPriorityPendingFirst[a.status] || 99) - (statusPriorityPendingFirst[b.status] || 99);
      if (diff !== 0) return diff;
      return (a.script_number || 0) - (b.script_number || 0);
    }
    if (sortOrder === 'status_posted') {
      const diff = (statusPriorityPostedFirst[a.status] || 99) - (statusPriorityPostedFirst[b.status] || 99);
      if (diff !== 0) return diff;
      return (a.script_number || 0) - (b.script_number || 0);
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  const pendingCount = currentBatchVideos.filter(v => v.status === 'Pending').length;
  const editedCount = currentBatchVideos.filter(v => v.status === 'Edited').length;
  const postedCount = currentBatchVideos.filter(v => v.status === 'Posted').length;

  const selectedClient = activeClients.find(c => c.id === selectedBatch?.client_id);

  const handleCreateBatch = async () => {
    if (!newBatchForm.clientId || !newBatchForm.name.trim()) return;

    const batch = await addBatchflowBatch({
      client_id: newBatchForm.clientId,
      name: newBatchForm.name.trim(),
      shoot_date: newBatchForm.shootDate,
      script: newBatchForm.script,
      videoCount: newBatchForm.videoCount,
      namingMethod: newBatchForm.namingMethod,
    });

    if (batch) {
      setSelectedBatchId(batch.id);
    }
    setNewBatchOpen(false);
  };

  const handleCycleStatus = async (v: BatchflowVideo) => {
    if (!canEdit) return;
    const order: BatchflowVideoStatus[] = ['Pending', 'Edited', 'Posted'];
    const curIdx = order.indexOf(v.status);
    const nextStatus = order[(curIdx + 1) % order.length];
    await updateBatchflowVideoStatus(v.id, nextStatus);
  };

  const handleSaveScript = async () => {
    if (!selectedBatch) return;
    await updateBatchflowBatch(selectedBatch.id, { script: scriptDraft });
    setScriptEditOpen(false);
  };

  const handleExportPNG = async () => {
    if (!reportRef.current || !selectedBatch) return;
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#080C14',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${selectedBatch.name}_Report.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    }
  };

  const handleExportPDF = () => {
    if (!selectedBatch) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2; // 182mm

    const pCount = currentBatchVideos.filter(v => v.status === 'Pending').length;
    const eCount = currentBatchVideos.filter(v => v.status === 'Edited').length;
    const postedCount = currentBatchVideos.filter(v => v.status === 'Posted').length;
    const totalCount = currentBatchVideos.length;

    const clientColorHex = selectedClient?.color || '#6366F1';
    const [cr, cg, cb] = hexToRgb(clientColorHex);

    // --- Top Dark Header Banner ---
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, pageWidth, 38, 'F');

    // Top accent bar
    doc.setFillColor(cr, cg, cb);
    doc.rect(0, 0, pageWidth, 3.5, 'F');

    // Header Subtitle / Tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184); // #94A3B8
    doc.text('BATCHFLOW PRODUCTION REPORT', margin, 12);

    // Batch Name Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    const titleText = doc.splitTextToSize(selectedBatch.name, 115)[0] || selectedBatch.name;
    doc.text(titleText, margin, 21);

    // Client pill / tag on right
    const clientName = selectedClient?.name || 'Unassigned Client';
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    const clientTag = `CLIENT: ${clientName.toUpperCase()}`;
    const tagWidth = doc.getTextWidth(clientTag) + 8;
    const tagX = pageWidth - margin - tagWidth;
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.roundedRect(tagX, 11, tagWidth, 7, 1.5, 1.5, 'F');
    doc.setTextColor(cr, cg, cb);
    doc.text(clientTag, tagX + 4, 15.7);

    // Shoot Date on header right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const shootDateStr = selectedBatch.shoot_date ? `Shoot Date: ${selectedBatch.shoot_date}` : 'Shoot Date: Not specified';
    doc.text(shootDateStr, pageWidth - margin, 26, { align: 'right' });

    // Subtitle / generated timestamp
    const dateStr = `Exported on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    doc.text(dateStr, margin, 29);

    // --- Executive KPI Metric Cards (4 cards) ---
    const cardY = 44;
    const cardGap = 3.5;
    const cardWidth = (contentWidth - cardGap * 3) / 4; // ~42.8mm
    const cardHeight = 22;

    const kpis = [
      { label: 'TOTAL VIDEOS', val: totalCount, pct: '100%', bg: [248, 250, 252], border: [226, 232, 240], text: [15, 23, 42] },
      { label: 'PENDING EDIT', val: pCount, pct: totalCount > 0 ? `${Math.round((pCount / totalCount) * 100)}%` : '0%', bg: [254, 243, 199], border: [253, 230, 138], text: [180, 83, 9] },
      { label: 'EDITED', val: eCount, pct: totalCount > 0 ? `${Math.round((eCount / totalCount) * 100)}%` : '0%', bg: [219, 234, 254], border: [191, 219, 254], text: [29, 78, 216] },
      { label: 'POSTED', val: postedCount, pct: totalCount > 0 ? `${Math.round((postedCount / totalCount) * 100)}%` : '0%', bg: [209, 250, 229], border: [167, 243, 208], text: [4, 120, 87] },
    ];

    kpis.forEach((kpi, i) => {
      const kX = margin + i * (cardWidth + cardGap);
      // Card background
      doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
      doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(kX, cardY, cardWidth, cardHeight, 2, 2, 'FD');

      // Caption
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // #64748B
      doc.text(kpi.label, kX + 3.5, cardY + 5.5);

      // Number
      doc.setFontSize(13);
      doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
      doc.text(String(kpi.val), kX + 3.5, cardY + 13);

      // Percentage Pill / Subtext
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${kpi.pct} of batch`, kX + 3.5, cardY + 18.5);
    });

    // --- Table Section ---
    let curY = 72;

    const drawTableHeader = (yPos: number) => {
      doc.setFillColor(30, 41, 59); // #1E293B
      doc.rect(margin, yPos, contentWidth, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(241, 245, 249); // #F1F5F9
      doc.text('Script no.', margin + 3, yPos + 5.2);
      doc.text('VIDEO TITLE', margin + 26, yPos + 5.2);
      doc.text('STATUS', margin + 120, yPos + 5.2);
      doc.text('PIPELINE DATE', margin + 152, yPos + 5.2);
    };

    drawTableHeader(curY);
    curY += 8;

    sortedVideos.forEach((v, index) => {
      const rowHeight = 9.5;
      if (curY + rowHeight > pageHeight - 20) {
        doc.addPage();
        curY = 20;
        drawTableHeader(curY);
        curY += 8;
      }

      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(248, 250, 252); // #F8FAFC
      }
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.rect(margin, curY, contentWidth, rowHeight, 'FD');

      // Script no.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(String(v.script_number ?? '-'), margin + 7, curY + 6);

      // Video Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const title = v.name || `Video #${v.script_number || index + 1}`;
      const truncatedTitle = doc.splitTextToSize(title, 88)[0];
      doc.text(truncatedTitle, margin + 26, curY + 6);

      // Status Pill
      const pillX = margin + 120;
      const pillY = curY + 2;
      const pillW = 24;
      const pillH = 5.5;

      if (v.status === 'Posted') {
        doc.setFillColor(209, 250, 229);
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(4, 120, 87);
        doc.text('POSTED', pillX + pillW / 2, pillY + 3.8, { align: 'center' });
      } else if (v.status === 'Edited') {
        doc.setFillColor(219, 234, 254);
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(29, 78, 216);
        doc.text('EDITED', pillX + pillW / 2, pillY + 3.8, { align: 'center' });
      } else {
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(253, 230, 138);
        doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(180, 83, 9);
        doc.text('PENDING', pillX + pillW / 2, pillY + 3.8, { align: 'center' });
      }

      // Date / Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const dateText = v.status === 'Posted' && v.posted_date ? new Date(v.posted_date).toLocaleDateString() :
                       v.status === 'Edited' && v.edited_date ? new Date(v.edited_date).toLocaleDateString() :
                       selectedBatch.shoot_date ? `Shoot: ${selectedBatch.shoot_date}` : '-';
      doc.text(dateText, margin + 152, curY + 6);

      curY += rowHeight;
    });

    // Footer for all pages
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Trackrr Studio • Content Batch Management & Production Workflow', margin, pageHeight - 7);
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    }

    doc.save(`${selectedBatch.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Report.pdf`);
  };

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* FIXED AT TOP: Big Title & Thick KPI Card (Unscrollable) */}
      <Box
        sx={{
          flexShrink: 0,
          pb: 1.25,
        }}
      >
        <Card
          onDoubleClick={() => {
            if (canEdit && selectedBatch) handleOpenEditBatch();
          }}
          title={canEdit && selectedBatch ? 'Double-click to edit batch' : undefined}
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            borderRadius: 1,
            borderLeft: `5px solid ${selectedClient?.color || '#818CF8'}`,
            bgcolor: 'background.paper',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            cursor: canEdit && selectedBatch ? 'pointer' : 'default',
          }}
        >
          {/* Top Row: Batch Title, Client Tag, Shoot Date, Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 1.75 }}>
            <Box sx={{ minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
                  {selectedBatch ? selectedBatch.name : 'No Batch Selected'}
                </Typography>
                {selectedClient && (
                  <Chip
                    label={selectedClient.name}
                    size="small"
                    sx={{
                      bgcolor: `${selectedClient.color || '#818CF8'}20`,
                      color: selectedClient.color || '#818CF8',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                    }}
                  />
                )}
              </Box>
              {selectedBatch && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <CalendarMonthRoundedIcon sx={{ fontSize: 15 }} />
                  Shoot Date: <strong>{selectedBatch.shoot_date || 'Not set'}</strong> • {currentBatchVideos.length} Videos in pipeline
                </Typography>
              )}
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }} onDoubleClick={(e) => e.stopPropagation()}>
              {canEdit && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => {
                    setNewBatchForm({
                      clientId: activeClients[0]?.id || '',
                      name: '',
                      shootDate: new Date().toISOString().slice(0, 10),
                      videoCount: 10,
                      namingMethod: 'ClientName',
                      script: '',
                    });
                    setNewBatchOpen(true);
                  }}
                  sx={{ textTransform: 'none', borderRadius: 1, fontWeight: 700 }}
                >
                  New Batch
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<PictureAsPdfRoundedIcon />}
                onClick={handleExportPDF}
                disabled={!selectedBatch}
                sx={{ textTransform: 'none', borderRadius: 1, fontWeight: 600 }}
              >
                Export PDF
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadRoundedIcon />}
                onClick={handleExportPNG}
                disabled={!selectedBatch}
                sx={{ textTransform: 'none', borderRadius: 1, fontWeight: 600 }}
              >
                PNG
              </Button>
              {canEdit && selectedBatch && (
                <>
                  <Tooltip title="Edit Batch">
                    <IconButton size="small" onClick={() => handleOpenEditBatch()} sx={{ color: 'text.secondary' }}>
                      <EditRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Batch">
                    <IconButton
                      size="small"
                      onClick={async () => {
                        if (window.confirm(`Delete batch "${selectedBatch.name}"?`)) {
                          await deleteBatchflowBatch(selectedBatch.id);
                        }
                      }}
                      sx={{ color: '#F87171' }}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>

          {/* Bottom Row: BIG THICK KPI STATS BLOCK */}
          {selectedBatch ? (
            <>
              <Grid container spacing={1.5} alignItems="stretch">
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                      TOTAL VIDEOS
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: 'text.primary', mt: 0.25, lineHeight: 1 }}>
                      {currentBatchVideos.length}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, fontSize: '0.68rem' }}>
                      {currentBatchVideos.length} videos total
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#F59E0B', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                      PENDING
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#F59E0B', mt: 0.25, lineHeight: 1 }}>
                      {pendingCount}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, fontSize: '0.68rem' }}>
                      {currentBatchVideos.length > 0 ? Math.round((pendingCount / currentBatchVideos.length) * 100) : 0}% of batch
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#3B82F6', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                      EDITED
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#3B82F6', mt: 0.25, lineHeight: 1 }}>
                      {editedCount}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, fontSize: '0.68rem' }}>
                      {currentBatchVideos.length > 0 ? Math.round((editedCount / currentBatchVideos.length) * 100) : 0}% of batch
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#10B981', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                      POSTED
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 900, color: '#10B981', mt: 0.25, lineHeight: 1 }}>
                      {postedCount}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, fontSize: '0.68rem' }}>
                      {currentBatchVideos.length > 0 ? Math.round((postedCount / currentBatchVideos.length) * 100) : 0}% completed
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Progress bar */}
              <Box sx={{ mt: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>Production Completion</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#10B981' }}>
                    {currentBatchVideos.length > 0 ? Math.round((postedCount / currentBatchVideos.length) * 100) : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={currentBatchVideos.length > 0 ? Math.round((postedCount / currentBatchVideos.length) * 100) : 0}
                  sx={{
                    height: 5,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiLinearProgress-bar': { bgcolor: selectedClient?.color || '#10B981', borderRadius: 1 },
                  }}
                />
              </Box>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
              No batch active. Create a new batch or select an existing one below.
            </Typography>
          )}
        </Card>
      </Box>

      {/* 3-COLUMN WORKSTATION LAYOUT WITH SEPARATE SCROLLING */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 1.5,
          overflow: 'hidden',
        }}
      >
        {/* Column 1: Batches Selector (Compact Left Column) */}
        <Box
          sx={{
            width: { xs: '100%', md: 260, lg: 280 },
            flexShrink: 0,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Card sx={{ p: 1.75, borderRadius: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25, flexShrink: 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Batches ({activeBatches.length})
              </Typography>
              {canEdit && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                  onClick={() => {
                    setNewBatchForm({
                      clientId: activeClients[0]?.id || '',
                      name: '',
                      shootDate: new Date().toISOString().slice(0, 10),
                      videoCount: 10,
                      namingMethod: 'ClientName',
                      script: '',
                    });
                    setNewBatchOpen(true);
                  }}
                  sx={{ fontSize: '0.72rem', py: 0.25, px: 1, textTransform: 'none', fontWeight: 700 }}
                >
                  New
                </Button>
              )}
            </Box>

            {/* Separately scrollable Batches List - ONLY scrolls if content requires it */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                pr: 0.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                '&::-webkit-scrollbar': { width: 5 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
              }}
            >
              {activeBatches.map(b => {
                const client = activeClients.find(c => c.id === b.client_id);
                const bVids = batchflowVideos.filter(v => v.batch_id === b.id);
                const isSelected = selectedBatch?.id === b.id;

                return (
                  <Box
                    key={b.id}
                    onClick={() => setSelectedBatchId(b.id)}
                    onDoubleClick={() => {
                      if (canEdit) handleOpenEditBatch(b);
                    }}
                    title={canEdit ? 'Double-click to edit batch' : undefined}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(255,255,255,0.05)',
                      borderLeft: `4px solid ${client?.color || '#818CF8'}`,
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: isSelected ? 'primary.light' : 'text.primary' }}>
                        {b.name}
                      </Typography>
                      <Chip label={client?.name || 'Client'} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: `${client?.color || '#818CF8'}20`, color: client?.color || '#818CF8' }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                      {b.shoot_date || 'No shoot date'} • {bVids.length} videos
                    </Typography>
                  </Box>
                );
              })}

              {activeBatches.length === 0 && (
                <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center', py: 3, display: 'block' }}>
                  No batches yet. Click "New" above to start!
                </Typography>
              )}
            </Box>
          </Card>
        </Box>

        {/* Column 2: Video Pipeline (Middle Column) */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Card sx={{ p: 1.75, borderRadius: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Videos Toolbar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25, flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Video Pipeline ({currentBatchVideos.length})
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Select
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value as any)}
                  size="small"
                  sx={{ fontSize: '0.72rem', height: 28, borderRadius: 1 }}
                >
                  <MenuItem value="script_asc">Script # (1-10)</MenuItem>
                  <MenuItem value="script_desc">Script # (10-1)</MenuItem>
                  <MenuItem value="status_pending">Status: Pending First</MenuItem>
                  <MenuItem value="status_posted">Status: Posted First</MenuItem>
                  <MenuItem value="name_asc">Name (A-Z)</MenuItem>
                </Select>

                {canEdit && selectedBatch && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
                    onClick={() => {
                      setNewVideoName(`${selectedClient?.name || 'Video'} ${currentBatchVideos.length + 1}`);
                      setAddVideoOpen(true);
                    }}
                    sx={{ textTransform: 'none', borderRadius: 1, height: 28, fontSize: '0.72rem', fontWeight: 700 }}
                  >
                    Add Video
                  </Button>
                )}
              </Box>
            </Box>

            {/* Separately scrollable Video Cards List - ONLY scrolls if content requires it */}
            <Box
              ref={reportRef}
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                pr: 0.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                '&::-webkit-scrollbar': { width: 5 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
              }}
            >
              {sortedVideos.map(v => {
                const cardStyle = VIDEO_CARD_STYLES[v.status] || VIDEO_CARD_STYLES.Pending;
                const st = STATUS_COLORS[v.status] || STATUS_COLORS.Pending;

                return (
                  <Card
                    key={v.id}
                    onDoubleClick={() => {
                      if (canEdit) {
                        setEditingVideo({ id: v.id, name: v.name, script_number: v.script_number });
                        setEditVideoOpen(true);
                      }
                    }}
                    title={canEdit ? 'Double-click to edit video' : undefined}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      cursor: canEdit ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1.25,
                      bgcolor: cardStyle.bgcolor,
                      border: cardStyle.border,
                      borderLeft: cardStyle.borderLeft,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        transform: 'translateX(2px)',
                        boxShadow: `0 4px 16px ${cardStyle.glow}`,
                      },
                    }}
                  >
                    {/* Video Info */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 160, flex: 1 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1,
                          bgcolor: cardStyle.badgeBg,
                          color: cardStyle.badgeColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          flexShrink: 0,
                          transition: 'all 0.2s ease',
                        }}
                      >
                        #{v.script_number}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                          {v.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', display: 'block' }}>
                          {v.status === 'Posted' && v.posted_date ? `Posted: ${new Date(v.posted_date).toLocaleDateString()}` :
                           v.status === 'Edited' && v.edited_date ? `Edited: ${new Date(v.edited_date).toLocaleDateString()}` :
                           'Ready for editing'}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Status Toggle Button & Actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} onDoubleClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Click to cycle status: Pending -> Edited -> Posted">
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCycleStatus(v);
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          disabled={!canEdit}
                          sx={{
                            textTransform: 'uppercase',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            letterSpacing: '0.05em',
                            px: 1.5,
                            py: 0.4,
                            borderRadius: 1,
                            bgcolor: st.bg,
                            color: st.text,
                            border: `1px solid ${st.border}`,
                            '&:hover': { bgcolor: st.bg, opacity: 0.9 },
                          }}
                        >
                          {v.status}
                        </Button>
                      </Tooltip>

                      {canEdit && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} onDoubleClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingVideo({ id: v.id, name: v.name, script_number: v.script_number });
                              setEditVideoOpen(true);
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            <EditRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete video "${v.name}"?`)) {
                                await deleteBatchflowVideo(v.id);
                              }
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: '#F87171' }} />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Card>
                );
              })}

              {sortedVideos.length === 0 && (
                <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {selectedBatch ? 'No videos in this batch yet. Click "Add Video" above to create one.' : 'Select a batch to view its videos.'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Box>

        {/* Column 3: Master Script (Permanent Right Column) */}
        <Box
          sx={{
            width: { xs: '100%', md: 320, lg: 360 },
            flexShrink: 0,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Card sx={{ p: 1.75, borderRadius: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Script Header & Toolbar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <DescriptionRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Master Script
                </Typography>
              </Box>

              {canEdit && selectedBatch && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
                  onClick={() => {
                    setScriptDraft(selectedBatch?.script || '');
                    setScriptEditOpen(true);
                  }}
                  sx={{ textTransform: 'none', borderRadius: 1, height: 28, fontSize: '0.72rem', fontWeight: 700 }}
                >
                  Edit Script
                </Button>
              )}
            </Box>

            {/* Separately scrollable Script Content - ONLY scrolls if content requires it */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                pr: 0.5,
                '&::-webkit-scrollbar': { width: 5 },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
              }}
            >
              <FormattedScriptViewer text={selectedBatch?.script || ''} />
            </Box>
          </Card>
        </Box>
      </Box>

      {/* New Batch Dialog */}
      <Dialog open={newBatchOpen} onClose={() => setNewBatchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Shoot Batch</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Client</InputLabel>
            <Select
              label="Client"
              value={newBatchForm.clientId}
              onChange={e => setNewBatchForm(prev => ({ ...prev, clientId: e.target.value }))}
            >
              {activeClients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Batch Name"
            placeholder="e.g. April 2026 Shoot, Reels Batch 1"
            fullWidth
            value={newBatchForm.name}
            onChange={e => setNewBatchForm(prev => ({ ...prev, name: e.target.value }))}
            autoFocus
          />

          <TextField
            label="Shoot Date"
            type="date"
            fullWidth
            value={newBatchForm.shootDate}
            onChange={e => setNewBatchForm(prev => ({ ...prev, shootDate: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />

          <Divider sx={{ my: 0.5 }} />

          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.light' }}>
            Auto-Video Generation
          </Typography>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Number of Videos"
              type="number"
              sx={{ width: 140 }}
              value={newBatchForm.videoCount}
              onChange={e => setNewBatchForm(prev => ({ ...prev, videoCount: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Naming Style</InputLabel>
              <Select
                label="Naming Style"
                value={newBatchForm.namingMethod}
                onChange={e => setNewBatchForm(prev => ({ ...prev, namingMethod: e.target.value }))}
              >
                <MenuItem value="ClientName">Client Name (e.g. Client 1, Client 2)</MenuItem>
                <MenuItem value="Video">Simple (e.g. Video 1, Video 2)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TextField
            label="Master Script (Optional)"
            placeholder="Paste your shoot script here. E.g.
script 1
1. Intro hook
2. Key points
script 2
..."
            multiline
            rows={5}
            fullWidth
            value={newBatchForm.script}
            onChange={e => setNewBatchForm(prev => ({ ...prev, script: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewBatchOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateBatch} disabled={!newBatchForm.clientId || !newBatchForm.name.trim()}>
            Create Batch & Generate Videos
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Script Dialog */}
      <Dialog open={scriptEditOpen} onClose={() => setScriptEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Master Script</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
            Tip: Use <strong>script 1</strong>, <strong>script 2</strong> to create split sections, and <strong>**bold**</strong> for emphasis.
          </Alert>
          <TextField
            multiline
            rows={14}
            fullWidth
            value={scriptDraft}
            onChange={e => setScriptDraft(e.target.value)}
            placeholder="Paste or write your full script here..."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScriptEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveScript}>Save Script</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Batch Dialog */}
      <Dialog open={editBatchOpen} onClose={() => setEditBatchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Shoot Batch</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Client</InputLabel>
            <Select
              label="Client"
              value={editingBatch?.client_id || ''}
              onChange={e => setEditingBatch(prev => prev ? { ...prev, client_id: e.target.value } : null)}
            >
              {activeClients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Batch Name"
            placeholder="e.g. April 2026 Shoot"
            fullWidth
            value={editingBatch?.name || ''}
            onChange={e => setEditingBatch(prev => prev ? { ...prev, name: e.target.value } : null)}
            autoFocus
          />

          <TextField
            label="Shoot Date"
            type="date"
            fullWidth
            value={editingBatch?.shoot_date || ''}
            onChange={e => setEditingBatch(prev => prev ? { ...prev, shoot_date: e.target.value } : null)}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditBatchOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEditBatch}
            disabled={!editingBatch?.name.trim()}
          >
            Save Batch
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Video Dialog */}
      <Dialog open={editVideoOpen} onClose={() => setEditVideoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Video</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Video Title"
            fullWidth
            value={editingVideo?.name || ''}
            onChange={e => setEditingVideo(prev => prev ? { ...prev, name: e.target.value } : null)}
          />
          <TextField
            label="Script #"
            type="number"
            fullWidth
            value={editingVideo?.script_number || 1}
            onChange={e => setEditingVideo(prev => prev ? { ...prev, script_number: parseInt(e.target.value) || 1 } : null)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditVideoOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (editingVideo) {
                await updateBatchflowVideo(editingVideo.id, {
                  name: editingVideo.name.trim(),
                  script_number: editingVideo.script_number,
                });
                setEditVideoOpen(false);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Single Video Dialog */}
      <Dialog open={addVideoOpen} onClose={() => setAddVideoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add Video to Batch</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label="Video Title"
            fullWidth
            value={newVideoName}
            onChange={e => setNewVideoName(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddVideoOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (selectedBatch && newVideoName.trim()) {
                await addBatchflowVideo({
                  batch_id: selectedBatch.id,
                  name: newVideoName.trim(),
                  script_number: currentBatchVideos.length + 1,
                });
                setAddVideoOpen(false);
              }
            }}
            disabled={!newVideoName.trim()}
          >
            Add Video
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
