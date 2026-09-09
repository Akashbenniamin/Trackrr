import { useState, useRef } from 'react';
import {
  Box, Card, Typography, Button, TextField, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid,
  Select, MenuItem, InputLabel, FormControl, Divider, Tooltip,
  Tabs, Tab, Paper, Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useApp } from '../../contexts/AppContext';
import type { BatchflowVideo, BatchflowVideoStatus } from '../../types';

const STATUS_COLORS: Record<BatchflowVideoStatus, { bg: string; text: string; border: string }> = {
  Pending: { bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.4)' },
  Edited: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.4)' },
  Posted: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.4)' },
};

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
          sx={{ textTransform: 'none', fontSize: '0.75rem', borderRadius: 2 }}
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
              borderRadius: 2.5,
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

  const [activeTab, setActiveTab] = useState<'videos' | 'script'>('videos');
  const [sortOrder, setSortOrder] = useState<'script_asc' | 'script_desc' | 'name_asc'>('script_asc');

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

  const [editVideoOpen, setEditVideoOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<{ id: string; name: string; script_number: number } | null>(null);

  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [newVideoName, setNewVideoName] = useState('');

  const reportRef = useRef<HTMLDivElement>(null);

  const currentBatchVideos = batchflowVideos.filter(v => v.batch_id === selectedBatch?.id);
  const sortedVideos = [...currentBatchVideos].sort((a, b) => {
    if (sortOrder === 'script_asc') return (a.script_number || 0) - (b.script_number || 0);
    if (sortOrder === 'script_desc') return (b.script_number || 0) - (a.script_number || 0);
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

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
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(selectedBatch.name, 14, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Client: ${selectedClient?.name || 'N/A'}`, 14, 28);
    doc.text(`Shoot Date: ${selectedBatch.shoot_date || 'N/A'}`, 14, 34);

    const pCount = currentBatchVideos.filter(v => v.status === 'Pending').length;
    const eCount = currentBatchVideos.filter(v => v.status === 'Edited').length;
    const postedCount = currentBatchVideos.filter(v => v.status === 'Posted').length;
    doc.text(`Total Videos: ${currentBatchVideos.length} | Pending: ${pCount} | Edited: ${eCount} | Posted: ${postedCount}`, 14, 42);

    doc.line(14, 46, 196, 46);

    let y = 54;
    doc.setFont('helvetica', 'bold');
    doc.text('Script #', 14, y);
    doc.text('Video Title', 40, y);
    doc.text('Status', 140, y);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;

    doc.setFont('helvetica', 'normal');
    sortedVideos.forEach(v => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(v.script_number || '-'), 14, y);
      doc.text(v.name || 'Untitled', 40, y);
      doc.text(v.status, 140, y);
      y += 7;
    });

    doc.save(`${selectedBatch.name}_Report.pdf`);
  };

  return (
    <Box sx={{ pb: 4 }}>
      {/* Top Header & New Batch Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            Batches & Shoot Cycles
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            Manage shoot days, master scripts, auto-generated video pipeline, and reports.
          </Typography>
        </Box>
        {canEdit && (
          <Button
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
            sx={{ borderRadius: 2.5, px: 2.5 }}
          >
            New Batch
          </Button>
        )}
      </Box>

      {/* Main Grid: Batch Selector & Detail Area */}
      <Grid container spacing={2.5}>
        {/* Left Column: Batch Selector */}
        <Grid size={{ xs: 12, md: 4, lg: 3.5 }}>
          <Card sx={{ p: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
              All Batches ({activeBatches.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {activeBatches.map(b => {
                const client = activeClients.find(c => c.id === b.client_id);
                const bVids = batchflowVideos.filter(v => v.batch_id === b.id);
                const isSelected = selectedBatch?.id === b.id;

                return (
                  <Box
                    key={b.id}
                    onClick={() => setSelectedBatchId(b.id)}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(255,255,255,0.05)',
                      borderLeft: `4px solid ${client?.color || '#818CF8'}`,
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: isSelected ? 'primary.light' : 'text.primary' }}>
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
                  No batches yet. Click "New Batch" above to start!
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Right Column: Selected Batch Details, Script & Videos */}
        <Grid size={{ xs: 12, md: 8, lg: 8.5 }}>
          {selectedBatch ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} ref={reportRef}>
              {/* Batch Banner Card */}
              <Card sx={{ p: 2.5, borderLeft: `6px solid ${selectedClient?.color || '#818CF8'}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5 }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>{selectedBatch.name}</Typography>
                      <Chip
                        label={selectedClient?.name || 'Client'}
                        size="small"
                        sx={{ bgcolor: `${selectedClient?.color || '#818CF8'}20`, color: selectedClient?.color || '#818CF8', fontWeight: 700 }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <CalendarMonthRoundedIcon sx={{ fontSize: 14 }} /> Shoot Date: {selectedBatch.shoot_date || 'Not set'} • {currentBatchVideos.length} Total Videos
                    </Typography>
                  </Box>

                  {/* Export & Actions */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadRoundedIcon />}
                      onClick={handleExportPNG}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      PNG Report
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PictureAsPdfRoundedIcon />}
                      onClick={handleExportPDF}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      PDF
                    </Button>
                    {canEdit && (
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
                    )}
                  </Box>
                </Box>

                {/* Video Pipeline Quick Bar */}
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Pending', count: currentBatchVideos.filter(v => v.status === 'Pending').length, color: '#F59E0B' },
                    { label: 'Edited', count: currentBatchVideos.filter(v => v.status === 'Edited').length, color: '#3B82F6' },
                    { label: 'Posted', count: currentBatchVideos.filter(v => v.status === 'Posted').length, color: '#10B981' },
                  ].map(s => (
                    <Chip
                      key={s.label}
                      label={`${s.label}: ${s.count}`}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        bgcolor: `${s.color}15`,
                        color: s.color,
                        border: `1px solid ${s.color}30`,
                      }}
                    />
                  ))}
                </Box>
              </Card>

              {/* View Switcher Tabs (Videos vs Script) */}
              <Card sx={{ p: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                    <Tab label={`Videos (${currentBatchVideos.length})`} value="videos" icon={<MovieRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
                    <Tab label="Master Script" value="script" icon={<DescriptionRoundedIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
                  </Tabs>

                  {activeTab === 'videos' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SortRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Select
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value as any)}
                        size="small"
                        sx={{ fontSize: '0.75rem', height: 32 }}
                      >
                        <MenuItem value="script_asc">Script # (1-10)</MenuItem>
                        <MenuItem value="script_desc">Script # (10-1)</MenuItem>
                        <MenuItem value="name_asc">Name A-Z</MenuItem>
                      </Select>
                      {canEdit && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<AddRoundedIcon />}
                          onClick={() => {
                            setNewVideoName(`${selectedClient?.name || 'Video'} ${currentBatchVideos.length + 1}`);
                            setAddVideoOpen(true);
                          }}
                          sx={{ textTransform: 'none', borderRadius: 2, height: 32 }}
                        >
                          Add Video
                        </Button>
                      )}
                    </Box>
                  )}

                  {activeTab === 'script' && canEdit && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<EditRoundedIcon />}
                      onClick={() => {
                        setScriptDraft(selectedBatch.script || '');
                        setScriptEditOpen(true);
                      }}
                      sx={{ textTransform: 'none', borderRadius: 2, height: 32 }}
                    >
                      Edit Script
                    </Button>
                  )}
                </Box>
              </Card>

              {/* Tab 1: Video Pipeline List */}
              {activeTab === 'videos' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {sortedVideos.map(v => {
                    const st = STATUS_COLORS[v.status] || STATUS_COLORS.Pending;

                    return (
                      <Card
                        key={v.id}
                        sx={{
                          p: 1.75,
                          borderRadius: 2.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 1.5,
                          transition: 'transform 0.15s ease',
                          '&:hover': { transform: 'translateX(2px)' },
                        }}
                      >
                        {/* Video Info */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 200, flex: 1 }}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 1.5,
                              bgcolor: 'rgba(255,255,255,0.06)',
                              color: 'text.secondary',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              flexShrink: 0,
                            }}
                          >
                            #{v.script_number}
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Tooltip title="Click to cycle status: Pending -> Edited -> Posted">
                            <Button
                              size="small"
                              onClick={() => handleCycleStatus(v)}
                              disabled={!canEdit}
                              sx={{
                                textTransform: 'uppercase',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                letterSpacing: '0.05em',
                                px: 1.75,
                                py: 0.5,
                                borderRadius: 2,
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
                            <>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingVideo({ id: v.id, name: v.name, script_number: v.script_number });
                                  setEditVideoOpen(true);
                                }}
                              >
                                <EditRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={async () => {
                                  if (window.confirm(`Delete video "${v.name}"?`)) {
                                    await deleteBatchflowVideo(v.id);
                                  }
                                }}
                              >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: '#F87171' }} />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </Card>
                    );
                  })}

                  {sortedVideos.length === 0 && (
                    <Card sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        No videos generated yet. Click "Add Video" above or generate when creating a batch.
                      </Typography>
                    </Card>
                  )}
                </Box>
              )}

              {/* Tab 2: Formatted Master Script */}
              {activeTab === 'script' && (
                <Card sx={{ p: 2.5 }}>
                  <FormattedScriptViewer text={selectedBatch.script || ''} />
                </Card>
              )}
            </Box>
          ) : (
            <Card sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>No Batch Selected</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Select a batch on the left or create your first batch to start tracking.
              </Typography>
            </Card>
          )}
        </Grid>
      </Grid>

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
