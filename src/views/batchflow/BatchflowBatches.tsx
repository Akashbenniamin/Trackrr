import { useState, useRef } from 'react';
import {
  Box, Card, Typography, Button, TextField, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, InputLabel, FormControl, Divider, Tooltip,
  Paper, Alert, LinearProgress, Menu, CircularProgress, Snackbar,
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
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { registerOkineFont } from '../../lib/okineFont';
import { useApp } from '../../contexts/AppContext';
import { usePersistedState } from '../../lib/usePersistedState';
import { fetchVideoMetadata, cleanVideoUrl, extractViewsAndLikes, type VideoMetadataResult } from '../../lib/videoMetadata';
import type { BatchflowBatch, BatchflowVideo, BatchflowVideoStatus } from '../../types';

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
function FormattedScriptViewer({
  text,
  highlightedScriptNum,
}: {
  text: string;
  highlightedScriptNum?: number | null;
}) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!text || !text.trim()) {
    return (
      <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic', py: 3, textAlign: 'center' }}>
        No script written for this batch yet. Click the edit icon above to paste or write your master script.
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {sections.map((section, sIdx) => {
        const lines = section.trim().split('\n');
        const firstLine = lines[0];
        const match = firstLine.match(/^(script\s*[-\s]?\s*(\d+))(.*)/i);
        const scriptNum = match ? parseInt(match[2], 10) : null;
        const isHighlighted = scriptNum !== null && highlightedScriptNum === scriptNum;
        const sectionId = `sec-${sIdx}`;

        return (
          <Paper
            key={sIdx}
            id={scriptNum !== null ? `script-sec-${scriptNum}` : undefined}
            elevation={0}
            sx={{
              borderRadius: 1,
              overflow: 'hidden',
              border: isHighlighted ? '1.5px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: isHighlighted ? '0 0 0 2px rgba(129,140,248,0.4), 0 0 16px rgba(129,140,248,0.3)' : undefined,
              bgcolor: isHighlighted ? 'rgba(129,140,248,0.06)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
    canEdit, activeWorkspace, settings,
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
  const [highlightedScriptNum, setHighlightedScriptNum] = useState<number | null>(null);
  const [copiedFullScript, setCopiedFullScript] = useState(false);

  const handleJumpToScript = (scriptNum?: number | null) => {
    if (!scriptNum) return;
    setHighlightedScriptNum(scriptNum);
    setTimeout(() => {
      const target = document.getElementById(`script-sec-${scriptNum}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    setTimeout(() => {
      setHighlightedScriptNum(null);
    }, 2500);
  };

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

  const [statusFilter, setStatusFilter] = useState<'ALL' | BatchflowVideoStatus>('ALL');

  const [editVideoOpen, setEditVideoOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<{
    id: string;
    name: string;
    script_number: number | string;
    description?: string | null;
    video_url?: string;
    posted_date?: string;
    status?: BatchflowVideoStatus;
    views?: string | number | null;
    likes?: string | number | null;
  } | null>(null);
  const [editingMetaLoading, setEditingMetaLoading] = useState(false);
  const [editingMetaResult, setEditingMetaResult] = useState<VideoMetadataResult | null>(null);

  const [postedLinkDialogOpen, setPostedLinkDialogOpen] = useState(false);
  const [postedTargetVideo, setPostedTargetVideo] = useState<BatchflowVideo | null>(null);
  const [postedVideoUrl, setPostedVideoUrl] = useState('');
  const [postedViews, setPostedViews] = useState('');
  const [postedLikes, setPostedLikes] = useState('');
  const [postedCustomDate, setPostedCustomDate] = useState(new Date().toISOString().slice(0, 10));
  const [postedMetaLoading, setPostedMetaLoading] = useState(false);
  const [postedMetaResult, setPostedMetaResult] = useState<VideoMetadataResult | null>(null);

  const [syncingPDF, setSyncingPDF] = useState(false);
  const [syncingAllPDF, setSyncingAllPDF] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);
  const [syncSnackbar, setSyncSnackbar] = useState<string | null>(null);

  const handleFetchPostedMetadata = async (urlInput?: string) => {
    const raw = (urlInput !== undefined ? urlInput : postedVideoUrl).trim();
    if (!raw) return;

    const cleaned = cleanVideoUrl(raw);
    setPostedVideoUrl(cleaned);
    setPostedMetaLoading(true);
    setPostedMetaResult(null);

    try {
      const res = await fetchVideoMetadata(cleaned, {
        metaAppId: settings.meta_app_id,
        metaClientToken: settings.meta_client_token,
        metaUserToken: settings.meta_user_token,
        metaIgUserId: settings.meta_ig_user_id,
      });
      setPostedMetaResult(res);

      if (res.postedDate) {
        setPostedCustomDate(res.postedDate);
      }
      if (res.viewsCount) {
        setPostedViews(String(res.viewsCount).replace(/views?/i, '').trim());
      }
      if (res.likesCount) {
        setPostedLikes(String(res.likesCount).replace(/likes?/i, '').trim());
      }
    } catch (err: any) {
      setPostedMetaResult({
        provider: 'other',
        error: err?.message || 'Failed to fetch video details',
      });
    } finally {
      setPostedMetaLoading(false);
    }
  };

  const handleFetchEditingMetadata = async (urlInput?: string) => {
    if (!editingVideo) return;
    const raw = (urlInput !== undefined ? urlInput : (editingVideo.video_url || '')).trim();
    if (!raw) return;

    const cleaned = cleanVideoUrl(raw);
    setEditingVideo(prev => prev ? { ...prev, video_url: cleaned } : null);
    setEditingMetaLoading(true);
    setEditingMetaResult(null);

    try {
      const res = await fetchVideoMetadata(cleaned, {
        metaAppId: settings.meta_app_id,
        metaClientToken: settings.meta_client_token,
        metaUserToken: settings.meta_user_token,
        metaIgUserId: settings.meta_ig_user_id,
      });
      setEditingMetaResult(res);

      if (res.postedDate) {
        setEditingVideo(prev => prev ? { ...prev, posted_date: res.postedDate || undefined } : null);
      }
      if (res.viewsCount) {
        const cleanV = String(res.viewsCount).replace(/views?/i, '').trim();
        setEditingVideo(prev => prev ? { ...prev, views: cleanV } : null);
      }
      if (res.likesCount) {
        const cleanL = String(res.likesCount).replace(/likes?/i, '').trim();
        setEditingVideo(prev => prev ? { ...prev, likes: cleanL } : null);
      }
    } catch (err: any) {
      setEditingMetaResult({
        provider: 'other',
        error: err?.message || 'Failed to fetch video details',
      });
    } finally {
      setEditingMetaLoading(false);
    }
  };

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    video: BatchflowVideo;
  } | null>(null);

  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [newVideoName, setNewVideoName] = useState('');
  const [newVideoScriptNum, setNewVideoScriptNum] = useState<number | string>(1);
  const [newVideoDescription, setNewVideoDescription] = useState('');
  const addVideoFormRef = useRef<HTMLDivElement>(null);
  const addVideoSaveBtnRef = useRef<HTMLButtonElement>(null);

  const handleAddSingleVideo = async () => {
    if (!selectedBatch || !newVideoName.trim()) return;
    const sNum = typeof newVideoScriptNum === 'number'
      ? newVideoScriptNum
      : (newVideoScriptNum === '' ? 0 : (parseInt(String(newVideoScriptNum), 10) || 0));

    await addBatchflowVideo({
      batch_id: selectedBatch.id,
      name: newVideoName.trim(),
      script_number: Math.max(0, sNum),
      description: newVideoDescription.trim() || null,
    });
    setAddVideoOpen(false);
  };

  const handleAddVideoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (selectedBatch && newVideoName.trim()) {
        handleAddSingleVideo();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (!addVideoFormRef.current) return;

      // Find all non-locked (enabled, editable, visible) input and textarea elements
      const allInputs = Array.from(
        addVideoFormRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input:not([disabled]):not([readonly]):not([type="hidden"]), textarea:not([disabled]):not([readonly])'
        )
      ).filter(el => el.offsetParent !== null && !el.disabled && !el.readOnly);

      const activeEl = document.activeElement as HTMLElement;
      const currentIndex = allInputs.findIndex(el => el === activeEl || el.contains(activeEl));

      if (currentIndex >= 0 && currentIndex < allInputs.length - 1) {
        const nextEl = allInputs[currentIndex + 1];
        nextEl.focus();
        if ('select' in nextEl && typeof nextEl.select === 'function') {
          nextEl.select();
        }
      } else {
        // Jump to the save/final button
        if (addVideoSaveBtnRef.current && !addVideoSaveBtnRef.current.disabled) {
          addVideoSaveBtnRef.current.focus();
        } else if (allInputs[0]) {
          allInputs[0].focus();
        }
      }
    }
  };

  const reportRef = useRef<HTMLDivElement>(null);

  const statusPriorityPendingFirst: Record<BatchflowVideoStatus, number> = { Pending: 1, Edited: 2, Posted: 3 };
  const statusPriorityPostedFirst: Record<BatchflowVideoStatus, number> = { Posted: 1, Edited: 2, Pending: 3 };

  const currentBatchVideos = batchflowVideos.filter(v => v.batch_id === selectedBatch?.id);
  const sortedVideos = [...currentBatchVideos].sort((a, b) => {
    if (sortOrder === 'script_asc') return (a.script_number ?? 0) - (b.script_number ?? 0);
    if (sortOrder === 'script_desc') return (b.script_number ?? 0) - (a.script_number ?? 0);
    if (sortOrder === 'status_pending') {
      const diff = (statusPriorityPendingFirst[a.status] || 99) - (statusPriorityPendingFirst[b.status] || 99);
      if (diff !== 0) return diff;
      return (a.script_number ?? 0) - (b.script_number ?? 0);
    }
    if (sortOrder === 'status_posted') {
      const diff = (statusPriorityPostedFirst[a.status] || 99) - (statusPriorityPostedFirst[b.status] || 99);
      if (diff !== 0) return diff;
      return (a.script_number ?? 0) - (b.script_number ?? 0);
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  const filteredVideos = sortedVideos.filter(v => statusFilter === 'ALL' || v.status === statusFilter);

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
    if (nextStatus === 'Posted') {
      const extracted = extractViewsAndLikes(v);
      setPostedTargetVideo(v);
      setPostedVideoUrl(v.video_url || '');
      setPostedViews(extracted.views || '');
      setPostedLikes(extracted.likes || '');
      setPostedCustomDate(v.posted_date ? v.posted_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setPostedMetaResult(null);
      setPostedMetaLoading(false);
      setPostedLinkDialogOpen(true);
      return;
    }
    await updateBatchflowVideoStatus(v.id, nextStatus);
  };

  const handleSavePostedLink = async (skip = false) => {
    if (!postedTargetVideo) return;
    const urlToSave = skip ? null : (postedVideoUrl.trim() ? cleanVideoUrl(postedVideoUrl.trim()) : null);
    const dateToSave = postedCustomDate.trim() || new Date().toISOString().slice(0, 10);
    const viewsToSave = skip ? null : (postedViews.trim() || postedMetaResult?.viewsCount || null);
    const likesToSave = skip ? null : (postedLikes.trim() || postedMetaResult?.likesCount || null);

    if (postedTargetVideo.status !== 'Posted') {
      await updateBatchflowVideoStatus(postedTargetVideo.id, 'Posted', urlToSave, dateToSave, viewsToSave, likesToSave);
    } else {
      await updateBatchflowVideo(postedTargetVideo.id, {
        video_url: skip ? null : urlToSave,
        posted_date: dateToSave.includes('T') ? dateToSave : `${dateToSave}T12:00:00.000Z`,
        views: viewsToSave,
        likes: likesToSave,
      });
    }
    setPostedLinkDialogOpen(false);
    setPostedTargetVideo(null);
    setPostedVideoUrl('');
    setPostedViews('');
    setPostedLikes('');
    setPostedMetaResult(null);
  };

  const handleCancelPostedLink = () => {
    setPostedLinkDialogOpen(false);
    setPostedTargetVideo(null);
    setPostedVideoUrl('');
    setPostedViews('');
    setPostedLikes('');
    setPostedMetaResult(null);
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

  const drawCardWatermark = (
    doc: jsPDF,
    type: 'TOTAL' | 'PENDING' | 'EDITED' | 'POSTED',
    cx: number,
    cy: number,
    size: number,
    color: [number, number, number],
    angleDeg: number = -16
  ) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setFillColor(color[0], color[1], color[2]);
    const s = size;

    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const rot = (x: number, y: number): [number, number] => {
      const dx = x - cx;
      const dy = y - cy;
      return [cx + dx * cosA - dy * sinA, cy + dx * sinA + dy * cosA];
    };

    if (type === 'TOTAL') {
      const w = s * 1.1;
      const h = s * 0.78;
      const p0 = rot(cx - w / 2, cy - h / 2);
      const p1 = rot(cx + w / 2, cy - h / 2);
      const p2 = rot(cx + w / 2, cy + h / 2);
      const p3 = rot(cx - w / 2, cy + h / 2);

      doc.setLineWidth(1.35);
      doc.lines(
        [
          [p1[0] - p0[0], p1[1] - p0[1]],
          [p2[0] - p1[0], p2[1] - p1[1]],
          [p3[0] - p2[0], p3[1] - p2[1]],
        ],
        p0[0],
        p0[1],
        [1, 1],
        'D',
        true
      );

      doc.setLineWidth(1.5);
      const s1 = rot(cx, cy + h / 2);
      const s2 = rot(cx, cy + h / 2 + 1.4);
      doc.line(s1[0], s1[1], s2[0], s2[1]);
      const b1 = rot(cx - s * 0.28, cy + h / 2 + 1.4);
      const b2 = rot(cx + s * 0.28, cy + h / 2 + 1.4);
      doc.line(b1[0], b1[1], b2[0], b2[1]);

      const tw = s * 0.28;
      const th = s * 0.32;
      const tx = cx - tw / 3;
      const t0 = rot(tx, cy - th / 2);
      const t1 = rot(tx, cy + th / 2);
      const t2 = rot(tx + tw, cy);
      doc.triangle(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1], 'FD');
    } else if (type === 'PENDING') {
      const r = s * 0.42;
      doc.setLineWidth(1.35);
      doc.circle(cx, cy, r, 'D');
      doc.circle(cx, cy, 0.9, 'F');
      const hEnd = rot(cx, cy - r * 0.58);
      doc.setLineWidth(1.5);
      doc.line(cx, cy, hEnd[0], hEnd[1]);
      const mEnd = rot(cx + r * 0.5, cy);
      doc.line(cx, cy, mEnd[0], mEnd[1]);
    } else if (type === 'EDITED') {
      const draw4Star = (sx: number, sy: number, starR: number) => {
        const inner = starR * 0.28;
        const pts = [
          rot(sx, sy - starR),
          rot(sx + inner, sy - inner),
          rot(sx + starR, sy),
          rot(sx + inner, sy + inner),
          rot(sx, sy + starR),
          rot(sx - inner, sy + inner),
          rot(sx - starR, sy),
          rot(sx - inner, sy - inner),
        ];
        const rel = pts.map((p, i) =>
          i === 0 ? [0, 0] : [p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]]
        );
        doc.lines(rel.slice(1), pts[0][0], pts[0][1], [1, 1], 'FD', true);
      };
      doc.setLineWidth(0.85);
      draw4Star(cx - s * 0.08, cy + s * 0.05, s * 0.4);
      draw4Star(cx + s * 0.3, cy - s * 0.24, s * 0.22);
    } else if (type === 'POSTED') {
      const r = s * 0.42;
      doc.setLineWidth(1.35);
      doc.circle(cx, cy, r, 'D');
      const p1 = rot(cx - r * 0.4, cy + r * 0.02);
      const p2 = rot(cx - r * 0.06, cy + r * 0.34);
      const p3 = rot(cx + r * 0.44, cy - r * 0.3);
      doc.setLineWidth(1.85);
      doc.line(p1[0], p1[1], p2[0], p2[1]);
      doc.line(p2[0], p2[1], p3[0], p3[1]);
    }
  };

  const renderBatchReport = (
    doc: jsPDF,
    batch: BatchflowBatch,
    client: typeof activeClients[0] | undefined,
    videos: BatchflowVideo[],
    isFirstPage = true,
    viewsMap?: Map<string, string>,
    likesMap?: Map<string, string>
  ) => {
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 14;
    const contentWidth = pageWidth - margin * 2; // 182mm

    if (!isFirstPage) {
      doc.addPage();
    }

    registerOkineFont(doc);

    const pCount = videos.filter(v => v.status === 'Pending').length;
    const eCount = videos.filter(v => v.status === 'Edited').length;
    const pPostedCount = videos.filter(v => v.status === 'Posted').length;
    const totalCount = videos.length;

    const clientColorHex = client?.color || '#6366F1';
    const [cr, cg, cb] = hexToRgb(clientColorHex);

    // --- Top Dark Header Banner ---
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, pageWidth, 35, 'F');

    // Top accent bar in client's color
    doc.setFillColor(cr, cg, cb);
    doc.rect(0, 0, pageWidth, 3.5, 'F');

    // Workspace name above client name
    const wsName = (activeWorkspace?.name || 'Workspace').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(129, 140, 248);
    doc.text(wsName, margin, 11.5);

    // Client Name as Large Main Title (Thick and bigger in Okine Bold)
    const clientName = client?.name || 'Unassigned Client';
    doc.setFont('Okine', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    const clientTitle = doc.splitTextToSize(clientName, 115)[0] || clientName;
    doc.text(clientTitle, margin, 21.5);

    // Subtitle / generated timestamp
    const dateStr = `Exported on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(dateStr, margin, 28);

    // Right Tag: Batch Name in dark pill without "Client:" or "Batch:" prefix
    const batchTag = batch.name.toUpperCase();
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    const tagWidth = doc.getTextWidth(batchTag) + 12;
    const tagX = pageWidth - margin - tagWidth;
    doc.setFillColor(30, 41, 59); // #1E293B
    doc.roundedRect(tagX, 9.5, tagWidth, 7.5, 1.5, 1.5, 'F');
    doc.setTextColor(cr, cg, cb);
    doc.text(batchTag, tagX + 6, 14.8);

    // Shoot Date on header right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const shootDateStr = batch.shoot_date ? `Shoot Date: ${batch.shoot_date}` : 'Shoot Date: Not specified';
    doc.text(shootDateStr, pageWidth - margin, 23.5, { align: 'right' });

    // --- Executive KPI Metric Cards (4 cards) - Bottom-Left Watermarks & Standout Okine Numbers ---
    const cardY = 39;
    const cardGap = 3.5;
    const cardWidth = (contentWidth - cardGap * 3) / 4; // ~42.875mm
    const cardHeight = 26;
    const cardCenterY = cardY + cardHeight / 2;

    const kpis: Array<{
      label: string;
      val: number;
      bg: [number, number, number];
      border: [number, number, number];
      text: [number, number, number];
      dot: [number, number, number];
      badgeBg: [number, number, number];
      wmColor: [number, number, number];
      icon: 'TOTAL' | 'PENDING' | 'EDITED' | 'POSTED';
    }> = [
      {
        label: 'TOTAL',
        val: totalCount,
        bg: [248, 250, 252],
        border: [226, 232, 240],
        text: [15, 23, 42],
        dot: [100, 116, 139],
        badgeBg: [226, 232, 240],
        wmColor: [210, 220, 235],
        icon: 'TOTAL',
      },
      {
        label: 'PENDING',
        val: pCount,
        bg: [254, 243, 199],
        border: [253, 230, 138],
        text: [180, 83, 9],
        dot: [217, 119, 6],
        badgeBg: [254, 215, 170],
        wmColor: [248, 205, 120],
        icon: 'PENDING',
      },
      {
        label: 'EDITED',
        val: eCount,
        bg: [239, 246, 255],
        border: [191, 219, 254],
        text: [29, 78, 216],
        dot: [37, 99, 235],
        badgeBg: [191, 219, 254],
        wmColor: [185, 212, 252],
        icon: 'EDITED',
      },
      {
        label: 'POSTED',
        val: pPostedCount,
        bg: [236, 253, 245],
        border: [167, 243, 208],
        text: [4, 120, 87],
        dot: [5, 150, 105],
        badgeBg: [167, 243, 208],
        wmColor: [160, 230, 195],
        icon: 'POSTED',
      },
    ];

    kpis.forEach((kpi, i) => {
      const kX = margin + i * (cardWidth + cardGap);

      // 1. Card Container
      doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
      doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(kX, cardY, cardWidth, cardHeight, 2.0, 2.0, 'FD');

      // 2. Faded Watermark Icon in bottom-left corner with rotation:
      // ~20% of the icon extends outside the bottom-left corner, strictly clipped to the card boundaries
      doc.saveGraphicsState();
      doc.roundedRect(kX, cardY, cardWidth, cardHeight, 2.0, 2.0, null as any);
      doc.clip();
      doc.discardPath();

      const s = 18;
      const wmX = kX + 5.5;
      const wmY = cardY + cardHeight - 5.5;
      drawCardWatermark(doc, kpi.icon, wmX, wmY, s, kpi.wmColor, -16);

      // Linear fade effect at the bottom of the card
      const fadeSteps = 6;
      const fadeH = 6;
      const startFadeY = cardY + cardHeight - fadeH;
      for (let sIdx = 0; sIdx < fadeSteps; sIdx++) {
        const alpha = ((sIdx + 1) / fadeSteps) * 0.45;
        const stripY = startFadeY + (sIdx * fadeH) / fadeSteps;
        const stripH = fadeH / fadeSteps + 0.1;
        doc.setGState(new (doc as any).GState({ opacity: alpha }));
        doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
        doc.rect(kX, stripY, cardWidth, stripH, 'F');
      }
      doc.restoreGraphicsState();

      // Re-stroke crisp card border so watermark edges are cleanly bounded
      doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
      doc.setLineWidth(0.35);
      doc.roundedRect(kX, cardY, cardWidth, cardHeight, 2.0, 2.0, 'S');

      // 3. Status Indicator Dot + Label at top-left
      const dotX = kX + 5.2;
      const dotY = cardY + 6.0;
      doc.setFillColor(kpi.badgeBg[0], kpi.badgeBg[1], kpi.badgeBg[2]);
      doc.circle(dotX, dotY, 2.0, 'F');
      doc.setFillColor(kpi.dot[0], kpi.dot[1], kpi.dot[2]);
      doc.circle(dotX, dotY, 1.0, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
      doc.text(kpi.label, dotX + 3.8, dotY, { baseline: 'middle' });

      // 4. Large Standout Number in Okine Bold on the Right (2.3x larger = 44pt), Centered Vertically
      doc.setFont('Okine', 'bold');
      const numFontSize = kpi.val >= 100 ? 30 : kpi.val >= 10 ? 38 : 44;
      doc.setFontSize(numFontSize);
      doc.setTextColor(kpi.text[0], kpi.text[1], kpi.text[2]);
      const numX = kX + cardWidth - 4.5;
      doc.text(String(kpi.val), numX, cardCenterY + 1.0, { align: 'right', baseline: 'middle' });
    });

    // --- Table Section: Aligned Headers & Columns ---
    let curY = 69;

    const drawTableHeader = (yPos: number) => {
      doc.setFillColor(30, 41, 59); // #1E293B
      doc.rect(margin, yPos, contentWidth, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(241, 245, 249); // #F1F5F9
      doc.text('SL NO.', margin + 3, yPos + 5.5);
      doc.text('VIDEO TITLE', margin + 15, yPos + 5.5);
      doc.text('VIEWS', margin + 80, yPos + 5.5);
      doc.text('LIKES', margin + 101, yPos + 5.5);
      doc.text('SCRIPT NO.', margin + 118, yPos + 5.5);
      doc.text('STATUS', margin + 144, yPos + 5.5, { align: 'center' });
      doc.text('PIPELINE DATE', margin + 158, yPos + 5.5);
    };

    drawTableHeader(curY);
    curY += 8;

    const bSortedVideos = [...videos].sort((a, b) => (a.script_number || 0) - (b.script_number || 0));

    bSortedVideos.forEach((v, index) => {
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

      // Col 1: SL NO.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(String(index + 1), margin + 3, curY + 6.0);

      // Col 2: Video Title (clickable if video_url exists)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const title = v.name || `Video #${v.script_number ?? index + 1}`;
      const truncatedTitle = doc.splitTextToSize(title, 60)[0];
      doc.text(truncatedTitle, margin + 15, curY + 6.0);
      if (v.video_url) {
        doc.link(margin + 15, curY + 1.5, 60, 6.5, { url: v.video_url });
      }

      const vExtracted = extractViewsAndLikes(v);

      // Col 3: Views
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const vViews = (viewsMap?.get(v.id) && viewsMap.get(v.id)?.trim() !== '')
        ? viewsMap.get(v.id)!.trim()
        : vExtracted.views;
      if (vViews) {
        doc.setTextColor(15, 23, 42);
        doc.text(vViews, margin + 80, curY + 6.0);
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('-', margin + 80, curY + 6.0);
      }

      // Col 4: Likes (Soft red number only)
      const vLikes = (likesMap?.get(v.id) && likesMap.get(v.id)?.trim() !== '')
        ? likesMap.get(v.id)!.trim()
        : vExtracted.likes;
      if (vLikes) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(239, 68, 68); // Soft red (#EF4444)
        doc.text(vLikes, margin + 101, curY + 6.0);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('-', margin + 101, curY + 6.0);
      }

      // Col 5: SCRIPT NO.
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(v.script_number === 0 ? '-' : String(v.script_number ?? '-'), margin + 118, curY + 6.0);

      // Col 6: Status Pill (Clickable if video_url exists)
      const pillX = margin + 134;
      const pillY = curY + 2.0;
      const pillW = 20;
      const pillH = 5.5;

      if (v.status === 'Posted') {
        doc.setFillColor(209, 250, 229);
        doc.setDrawColor(167, 243, 208);
        doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(4, 120, 87);
        doc.text('POSTED', pillX + pillW / 2, pillY + 3.8, { align: 'center' });
        if (v.video_url) {
          doc.link(pillX, pillY, pillW, pillH, { url: v.video_url });
        }
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

      // Col 7: Date / Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const dateText = v.status === 'Posted' && v.posted_date ? new Date(v.posted_date).toLocaleDateString() :
                       v.status === 'Edited' && v.edited_date ? new Date(v.edited_date).toLocaleDateString() :
                       batch.shoot_date ? `Shoot: ${batch.shoot_date}` : '-';
      doc.text(dateText, margin + 158, curY + 6.0);

      curY += rowHeight;
    });
  };

  const syncVideosMetadata = async (videosToSync: BatchflowVideo[]): Promise<{
    viewsMap: Map<string, string>;
    likesMap: Map<string, string>;
    updatedCount: number;
  }> => {
    const viewsMap = new Map<string, string>();
    const likesMap = new Map<string, string>();
    let updatedCount = 0;

    await Promise.all(
      videosToSync.map(async (v) => {
        const { views: existingViews, likes: existingLikes } = extractViewsAndLikes(v);
        if (existingViews) {
          viewsMap.set(v.id, existingViews);
        }
        if (existingLikes) {
          likesMap.set(v.id, existingLikes);
        }

        if (v.video_url) {
          try {
            const metaPromise = fetchVideoMetadata(v.video_url, {
              metaAppId: settings.meta_app_id,
              metaClientToken: settings.meta_client_token,
              metaUserToken: settings.meta_user_token,
              metaIgUserId: settings.meta_ig_user_id,
            });
            const meta = await Promise.race([
              metaPromise,
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
            ]);

            if (meta) {
              const updates: Partial<BatchflowVideo> = {};

              // 1. Live Likes update: always refresh with latest live count from the link
              if (meta.likesCount) {
                const cleanL = String(meta.likesCount).replace(/likes?/i, '').trim();
                likesMap.set(v.id, cleanL);
                if (cleanL !== existingLikes) {
                  updates.likes = cleanL;
                }
              }

              // 2. Views update: if provider provides views (e.g. YouTube), update; otherwise preserve manual views
              if (meta.viewsCount) {
                const cleanV = String(meta.viewsCount).replace(/views?/i, '').trim();
                viewsMap.set(v.id, cleanV);
                if (cleanV !== existingViews) {
                  updates.views = cleanV;
                }
              } else if (existingViews) {
                viewsMap.set(v.id, existingViews);
              }

              // 3. Posted date: auto-fill from post if not set
              if (meta.postedDate && !v.posted_date) {
                updates.posted_date = meta.postedDate.includes('T') ? meta.postedDate : `${meta.postedDate}T12:00:00.000Z`;
              }

              if (Object.keys(updates).length > 0) {
                updatedCount++;
                await updateBatchflowVideo(v.id, updates).catch(() => {});
              }
            }
          } catch (err) {
            console.warn(`Could not sync video ${v.id}:`, err);
          }
        }
      })
    );

    return { viewsMap, likesMap, updatedCount };
  };

  const handleSyncBatchLinks = async () => {
    if (!selectedBatch) return;
    const vidsWithUrls = currentBatchVideos.filter(v => v.video_url);
    if (vidsWithUrls.length === 0) {
      setSyncSnackbar('No videos with links in this batch to sync.');
      return;
    }

    setManualSyncing(true);
    try {
      const { updatedCount } = await syncVideosMetadata(vidsWithUrls);
      setSyncSnackbar(
        updatedCount > 0
          ? `Refreshed live metrics for ${updatedCount} video(s)!`
          : `All ${vidsWithUrls.length} video link(s) are already up to date!`
      );
    } catch {
      setSyncSnackbar('Failed to sync some video links.');
    } finally {
      setManualSyncing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedBatch) return;
    setSyncingPDF(true);

    try {
      // 1. Automatically refresh live stats from links before rendering PDF
      const { viewsMap, likesMap } = await syncVideosMetadata(currentBatchVideos);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      renderBatchReport(doc, selectedBatch, selectedClient, currentBatchVideos, true, viewsMap, likesMap);

      const margin = 14;
      const pageWidth = 210;
      const pageHeight = 297;
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
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setSyncingPDF(false);
    }
  };

  const handleExportAllBatchesPDF = async () => {
    if (activeBatches.length === 0) return;
    setSyncingAllPDF(true);

    try {
      // 1. Automatically refresh live stats from links across all active batches before rendering PDF
      const allActiveVideos = batchflowVideos.filter(v => activeBatches.some(b => b.id === v.batch_id));
      const { viewsMap, likesMap } = await syncVideosMetadata(allActiveVideos);

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      activeBatches.forEach((b, idx) => {
        const client = activeClients.find(c => c.id === b.client_id);
        const bVids = batchflowVideos.filter(v => v.batch_id === b.id);
        renderBatchReport(doc, b, client, bVids, idx === 0, viewsMap, likesMap);
      });

      const margin = 14;
      const pageWidth = 210;
      const pageHeight = 297;
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Trackrr Studio • Consolidated Batches Production Report', margin, pageHeight - 7);
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      }

      doc.save(`Trackrr_All_Batches_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('All batches PDF export error:', err);
    } finally {
      setSyncingAllPDF(false);
    }
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
      {/* 3-COLUMN WORKSTATION LAYOUT - STARTS AT THE VERY TOP */}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Export All Batches to Single PDF (Auto-syncs live links)">
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleExportAllBatchesPDF}
                      disabled={activeBatches.length === 0 || syncingAllPDF}
                      sx={{
                        p: 0.5,
                        color: syncingAllPDF ? 'primary.light' : 'text.secondary',
                        '&:hover': { color: 'primary.light', bgcolor: 'rgba(255,255,255,0.06)' },
                      }}
                    >
                      {syncingAllPDF ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <PictureAsPdfRoundedIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
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
                      borderRadius: 1.25,
                      cursor: 'pointer',
                      bgcolor: isSelected ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid rgba(129,140,248,0.45)' : '1px solid rgba(255,255,255,0.06)',
                      borderLeft: `4px solid ${client?.color || '#818CF8'}`,
                      boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.25)' : 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        bgcolor: isSelected ? 'rgba(129,140,248,0.16)' : 'rgba(255,255,255,0.06)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {/* Top Row: Client Name (Bigger, Thicker, Signature Color) & Video Count Chip */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="subtitle2"
                          noWrap
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            letterSpacing: '-0.01em',
                            color: client?.color || '#818CF8',
                          }}
                        >
                          {client?.name || 'Client'}
                        </Typography>
                        <Chip
                          label={`${bVids.length} ${bVids.length === 1 ? 'vid' : 'vids'}`}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            bgcolor: isSelected ? 'rgba(129,140,248,0.25)' : 'rgba(255,255,255,0.06)',
                            color: isSelected ? 'primary.light' : 'text.secondary',
                            border: '1px solid',
                            borderColor: isSelected ? 'rgba(129,140,248,0.35)' : 'rgba(255,255,255,0.06)',
                          }}
                        />
                      </Box>

                      {/* Second Row: Batch Name (Smaller, secondary) */}
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          color: isSelected ? 'text.primary' : 'text.secondary',
                          lineHeight: 1.25,
                        }}
                      >
                        {b.name}
                      </Typography>

                      {/* Third Row: Shoot date */}
                      {b.shoot_date ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                          <CalendarMonthRoundedIcon sx={{ fontSize: 13, color: 'text.disabled', opacity: 0.8 }} />
                          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled', fontWeight: 500 }}>
                            {b.shoot_date}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled', fontStyle: 'italic', mt: 0.25 }}>
                          No shoot date
                        </Typography>
                      )}
                    </Box>
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

        {/* Column 2: Video Pipeline & Batch Overview (Middle Column) */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            overflow: 'hidden',
          }}
        >
          {/* Top Card: Batch Title & Minimal Modern KPI Counters */}
          <Box sx={{ flexShrink: 0 }}>
            <Card
              onDoubleClick={() => {
                if (canEdit && selectedBatch) handleOpenEditBatch();
              }}
              title={canEdit && selectedBatch ? 'Double-click to edit batch' : undefined}
              sx={{
                p: { xs: 1.5, sm: 1.75 },
                borderRadius: 1.25,
                bgcolor: 'background.paper',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                cursor: canEdit && selectedBatch ? 'pointer' : 'default',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Subtle top accent line using client's color */}
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, bgcolor: selectedClient?.color || 'primary.main', opacity: 0.8 }} />

              {/* Top Row: Batch Title, Client Tag, Shoot Date, Action Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 1.5 }}>
                <Box sx={{ minWidth: 160, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', fontSize: { xs: '1.15rem', sm: '1.3rem' } }}>
                      {selectedBatch ? selectedBatch.name : 'No Batch Selected'}
                    </Typography>
                    {selectedClient && (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Chip
                          label={selectedClient.name}
                          size="small"
                          sx={{
                            bgcolor: `${selectedClient.color || '#818CF8'}18`,
                            color: selectedClient.color || '#818CF8',
                            border: `1px solid ${selectedClient.color || '#818CF8'}35`,
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            height: 22,
                          }}
                        />
                        {selectedClient.instagram_id && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const handle = (selectedClient.instagram_id || '').replace(/^@/, '').trim();
                              window.open(`https://www.instagram.com/${handle}/reels/`, '_blank', 'noopener,noreferrer');
                            }}
                            startIcon={<InstagramIcon sx={{ fontSize: 13, color: '#E1306C' }} />}
                            sx={{
                              height: 22,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'none',
                              px: 0.9,
                              py: 0,
                              borderRadius: 1,
                              borderColor: 'rgba(225, 48, 108, 0.35)',
                              color: '#F43F5E',
                              bgcolor: 'rgba(225, 48, 108, 0.08)',
                              lineHeight: 1,
                              '&:hover': {
                                borderColor: '#E1306C',
                                bgcolor: 'rgba(225, 48, 108, 0.18)',
                              },
                            }}
                          >
                            View Page
                          </Button>
                        )}
                      </Box>
                    )}
                  </Box>
                  {selectedBatch && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.4, fontSize: '0.74rem' }}>
                      <CalendarMonthRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      Shoot Date: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{selectedBatch.shoot_date || 'Not set'}</strong> • {currentBatchVideos.length} Videos in pipeline
                    </Typography>
                  )}
                </Box>

                {/* Action Buttons: Minimal & Modern */}
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }} onDoubleClick={(e) => e.stopPropagation()}>
                  <Tooltip title="Auto-sync live likes and views from video URLs">
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={manualSyncing ? <CircularProgress size={13} sx={{ color: '#E1306C' }} /> : <SyncRoundedIcon sx={{ fontSize: 15 }} />}
                        onClick={handleSyncBatchLinks}
                        disabled={!selectedBatch || manualSyncing || syncingPDF}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 1,
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          height: 30,
                          px: 1.25,
                          borderColor: manualSyncing ? '#E1306C' : 'rgba(255,255,255,0.12)',
                          color: manualSyncing ? '#E1306C' : 'text.primary',
                          '&:hover': {
                            borderColor: 'rgba(225, 48, 108, 0.5)',
                            bgcolor: 'rgba(225, 48, 108, 0.08)',
                          },
                        }}
                      >
                        {manualSyncing ? 'Syncing...' : 'Sync Links'}
                      </Button>
                    </span>
                  </Tooltip>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={syncingPDF ? <CircularProgress size={13} sx={{ color: 'inherit' }} /> : <PictureAsPdfRoundedIcon sx={{ fontSize: 15 }} />}
                    onClick={handleExportPDF}
                    disabled={!selectedBatch || syncingPDF || manualSyncing}
                    sx={{ textTransform: 'none', borderRadius: 1, fontWeight: 600, fontSize: '0.75rem', height: 30, px: 1.25, borderColor: 'rgba(255,255,255,0.12)' }}
                  >
                    {syncingPDF ? 'Syncing...' : 'PDF'}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon sx={{ fontSize: 15 }} />}
                    onClick={handleExportPNG}
                    disabled={!selectedBatch}
                    sx={{ textTransform: 'none', borderRadius: 1, fontWeight: 600, fontSize: '0.75rem', height: 30, px: 1.25, borderColor: 'rgba(255,255,255,0.12)' }}
                  >
                    PNG
                  </Button>
                  {canEdit && selectedBatch && (
                    <>
                      <Tooltip title="Edit Batch">
                        <IconButton size="small" onClick={() => handleOpenEditBatch()} sx={{ color: 'text.secondary', p: 0.6, bgcolor: 'rgba(255,255,255,0.04)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                          <EditRoundedIcon sx={{ fontSize: 16 }} />
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
                          sx={{ color: '#F87171', p: 0.6, bgcolor: 'rgba(248,113,113,0.08)', '&:hover': { bgcolor: 'rgba(248,113,113,0.16)' } }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>

              {/* 4 Minimal Modern KPI Counter Cards */}
              {selectedBatch ? (
                <>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                      gap: 1.25,
                      mt: 1.25,
                    }}
                  >
                    {/* TOTAL */}
                    <Box
                      onClick={() => setStatusFilter('ALL')}
                      title={statusFilter === 'ALL' ? 'Showing all videos' : 'Click to show all videos'}
                      sx={{
                        p: { xs: 1.25, sm: 1.5 },
                        px: { xs: 1.5, sm: 2 },
                        borderRadius: 1.25,
                        cursor: 'pointer',
                        bgcolor: statusFilter === 'ALL' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.025)',
                        border: statusFilter === 'ALL' ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: statusFilter === 'ALL' ? '0 0 14px rgba(255, 255, 255, 0.12)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        minHeight: { xs: 56, sm: 62 },
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.06)',
                          borderColor: 'rgba(255, 255, 255, 0.35)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: 'rgba(255, 255, 255, 0.08)',
                            color: 'text.primary',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <VideoLibraryRoundedIcon sx={{ fontSize: 17 }} />
                        </Box>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            letterSpacing: '0.08em',
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                          }}
                        >
                          TOTAL
                        </Typography>
                      </Box>

                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                          lineHeight: 1,
                          color: 'text.primary',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {currentBatchVideos.length}
                      </Typography>
                    </Box>

                    {/* PENDING */}
                    <Box
                      onClick={() => setStatusFilter(prev => prev === 'Pending' ? 'ALL' : 'Pending')}
                      title={statusFilter === 'Pending' ? 'Filtered by Pending (Click to reset)' : 'Click to filter by Pending'}
                      sx={{
                        p: { xs: 1.25, sm: 1.5 },
                        px: { xs: 1.5, sm: 2 },
                        borderRadius: 1.25,
                        cursor: 'pointer',
                        bgcolor: statusFilter === 'Pending' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(245, 158, 11, 0.04)',
                        border: statusFilter === 'Pending' ? '1.5px solid #F59E0B' : '1px solid rgba(245, 158, 11, 0.25)',
                        boxShadow: statusFilter === 'Pending' ? '0 0 16px rgba(245, 158, 11, 0.3)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        minHeight: { xs: 56, sm: 62 },
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(245, 158, 11, 0.09)',
                          borderColor: 'rgba(245, 158, 11, 0.55)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: 'rgba(245, 158, 11, 0.16)',
                            color: '#F59E0B',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <AccessTimeRoundedIcon sx={{ fontSize: 18 }} />
                        </Box>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            letterSpacing: '0.08em',
                            color: '#F59E0B',
                            textTransform: 'uppercase',
                          }}
                        >
                          PENDING
                        </Typography>
                      </Box>

                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                          lineHeight: 1,
                          color: '#F59E0B',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {pendingCount}
                      </Typography>
                    </Box>

                    {/* EDITED */}
                    <Box
                      onClick={() => setStatusFilter(prev => prev === 'Edited' ? 'ALL' : 'Edited')}
                      title={statusFilter === 'Edited' ? 'Filtered by Edited (Click to reset)' : 'Click to filter by Edited'}
                      sx={{
                        p: { xs: 1.25, sm: 1.5 },
                        px: { xs: 1.5, sm: 2 },
                        borderRadius: 1.25,
                        cursor: 'pointer',
                        bgcolor: statusFilter === 'Edited' ? 'rgba(59, 130, 246, 0.14)' : 'rgba(59, 130, 246, 0.04)',
                        border: statusFilter === 'Edited' ? '1.5px solid #3B82F6' : '1px solid rgba(59, 130, 246, 0.25)',
                        boxShadow: statusFilter === 'Edited' ? '0 0 16px rgba(59, 130, 246, 0.3)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        minHeight: { xs: 56, sm: 62 },
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(59, 130, 246, 0.09)',
                          borderColor: 'rgba(59, 130, 246, 0.55)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: 'rgba(59, 130, 246, 0.16)',
                            color: '#3B82F6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <AutoFixHighRoundedIcon sx={{ fontSize: 17 }} />
                        </Box>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            letterSpacing: '0.08em',
                            color: '#3B82F6',
                            textTransform: 'uppercase',
                          }}
                        >
                          EDITED
                        </Typography>
                      </Box>

                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                          lineHeight: 1,
                          color: '#3B82F6',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {editedCount}
                      </Typography>
                    </Box>

                    {/* POSTED */}
                    <Box
                      onClick={() => setStatusFilter(prev => prev === 'Posted' ? 'ALL' : 'Posted')}
                      title={statusFilter === 'Posted' ? 'Filtered by Posted (Click to reset)' : 'Click to filter by Posted'}
                      sx={{
                        p: { xs: 1.25, sm: 1.5 },
                        px: { xs: 1.5, sm: 2 },
                        borderRadius: 1.25,
                        cursor: 'pointer',
                        bgcolor: statusFilter === 'Posted' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.04)',
                        border: statusFilter === 'Posted' ? '1.5px solid #10B981' : '1px solid rgba(16, 185, 129, 0.25)',
                        boxShadow: statusFilter === 'Posted' ? '0 0 16px rgba(16, 185, 129, 0.3)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        minHeight: { xs: 56, sm: 62 },
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(16, 185, 129, 0.09)',
                          borderColor: 'rgba(16, 185, 129, 0.55)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: 'rgba(16, 185, 129, 0.16)',
                            color: '#10B981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <CheckCircleRoundedIcon sx={{ fontSize: 17 }} />
                        </Box>
                        <Typography
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            letterSpacing: '0.08em',
                            color: '#10B981',
                            textTransform: 'uppercase',
                          }}
                        >
                          POSTED
                        </Typography>
                      </Box>

                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                          lineHeight: 1,
                          color: '#10B981',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {postedCount}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Production Progress Bar */}
                  <Box sx={{ mt: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Production Completion
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.72rem', color: '#10B981' }}>
                        {currentBatchVideos.length > 0 ? Math.round((postedCount / currentBatchVideos.length) * 100) : 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={currentBatchVideos.length > 0 ? Math.round((postedCount / currentBatchVideos.length) * 100) : 0}
                      sx={{
                        height: 4,
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

          {/* Video Pipeline Card: Takes remaining height, scrolls separately, cards NEVER squeezed */}
          <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 1.75, borderRadius: 1 }}>
            {/* Videos Toolbar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25, flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Video Pipeline ({filteredVideos.length}{statusFilter !== 'ALL' ? ` of ${currentBatchVideos.length}` : ''})
                </Typography>
                {statusFilter !== 'ALL' && (
                  <Chip
                    size="small"
                    label={`Filter: ${statusFilter}`}
                    onDelete={() => setStatusFilter('ALL')}
                    sx={{
                      height: 22,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      bgcolor: STATUS_COLORS[statusFilter]?.bg,
                      color: STATUS_COLORS[statusFilter]?.text,
                      border: `1px solid ${STATUS_COLORS[statusFilter]?.border}`,
                    }}
                  />
                )}
              </Box>

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
                      const nextNum = currentBatchVideos.length + 1;
                      setNewVideoName(`${selectedClient?.name || 'Video'} ${nextNum}`);
                      setNewVideoScriptNum(nextNum);
                      setNewVideoDescription('');
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
              {filteredVideos.map(v => {
                const cardStyle = VIDEO_CARD_STYLES[v.status] || VIDEO_CARD_STYLES.Pending;
                const st = STATUS_COLORS[v.status] || STATUS_COLORS.Pending;

                return (
                  <Card
                    key={v.id}
                    onDoubleClick={() => {
                      if (canEdit) {
                        setEditingVideo({
                          id: v.id,
                          name: v.name,
                          script_number: v.script_number,
                          description: v.description || '',
                          video_url: v.video_url || '',
                          posted_date: v.posted_date ? v.posted_date.slice(0, 10) : '',
                          status: v.status,
                          views: v.views || null,
                          likes: v.likes || null,
                        });
                        setEditingMetaResult(null);
                        setEditingMetaLoading(false);
                        setEditVideoOpen(true);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ mouseX: e.clientX + 2, mouseY: e.clientY - 6, video: v });
                    }}
                    title={canEdit ? 'Double-click to edit • Right-click for video options' : undefined}
                    sx={{
                      flexShrink: 0,
                      minHeight: { xs: 50, sm: 54 },
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
                      <Tooltip title={v.script_number > 0 ? `Jump to Script #${v.script_number}` : 'No script attached (#0)'}>
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            if (v.script_number > 0) {
                              handleJumpToScript(v.script_number);
                            }
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
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
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: v.script_number > 0 ? 'pointer' : 'default',
                            userSelect: 'none',
                            '&:hover': v.script_number > 0 ? {
                              transform: 'scale(1.12)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                              filter: 'brightness(1.25)',
                            } : {},
                          }}
                        >
                          #{v.script_number}
                        </Box>
                      </Tooltip>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                            {v.name}
                          </Typography>
                          {v.video_url && (() => {
                            const isIg = v.video_url.toLowerCase().includes('instagram.com') || v.video_url.toLowerCase().includes('instagr.am');
                            return (
                              <Tooltip title={`Open ${isIg ? 'Instagram' : 'Video'}: ${v.video_url}`}>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(v.video_url!, '_blank', 'noopener,noreferrer');
                                  }}
                                  onDoubleClick={(e) => e.stopPropagation()}
                                  sx={{
                                    p: 0.35,
                                    color: isIg ? '#E1306C' : '#38BDF8',
                                    bgcolor: isIg ? 'rgba(225, 48, 108, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                                    border: '1px solid',
                                    borderColor: isIg ? 'rgba(225, 48, 108, 0.3)' : 'rgba(56, 189, 248, 0.3)',
                                    borderRadius: 1,
                                    '&:hover': {
                                      bgcolor: isIg ? 'rgba(225, 48, 108, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                                    },
                                  }}
                                >
                                  {isIg ? <InstagramIcon sx={{ fontSize: 13 }} /> : <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
                                </IconButton>
                              </Tooltip>
                            );
                          })()}
                        </Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', display: 'block' }}>
                          {v.status === 'Posted' && v.posted_date ? `Posted: ${new Date(v.posted_date).toLocaleDateString()}` :
                           v.status === 'Edited' && v.edited_date ? `Edited: ${new Date(v.edited_date).toLocaleDateString()}` :
                           'Ready for editing'}
                        </Typography>
                        {v.description && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.72rem',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              mt: 0.25,
                            }}
                            title={v.description}
                          >
                            {v.description}
                          </Typography>
                        )}
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
                              setEditingVideo({
                                id: v.id,
                                name: v.name,
                                script_number: v.script_number,
                                description: v.description || '',
                                video_url: v.video_url || '',
                                posted_date: v.posted_date ? v.posted_date.slice(0, 10) : '',
                                status: v.status,
                                views: v.views || null,
                                likes: v.likes || null,
                              });
                              setEditingMetaResult(null);
                              setEditingMetaLoading(false);
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

              {currentBatchVideos.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {selectedBatch ? 'No videos in this batch yet. Click "Add Video" above to create one.' : 'Select a batch to view its videos.'}
                  </Typography>
                </Box>
              ) : filteredVideos.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    No videos with "{statusFilter}" status in this batch.
                  </Typography>
                  <Button size="small" variant="text" onClick={() => setStatusFilter('ALL')} sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}>
                    Show all videos
                  </Button>
                </Box>
              ) : null}
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

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Tooltip title={copiedFullScript ? 'Copied Full Script!' : 'Copy Entire Script'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!selectedBatch?.script}
                      onClick={() => {
                        if (selectedBatch?.script) {
                          navigator.clipboard.writeText(selectedBatch.script);
                          setCopiedFullScript(true);
                          setTimeout(() => setCopiedFullScript(false), 2000);
                        }
                      }}
                      sx={{
                        width: 28,
                        height: 28,
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 1,
                        color: copiedFullScript ? '#34D399' : 'text.secondary',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary' },
                      }}
                    >
                      {copiedFullScript ? <CheckRoundedIcon sx={{ fontSize: 15 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 15 }} />}
                    </IconButton>
                  </span>
                </Tooltip>

                {canEdit && selectedBatch && (
                  <Tooltip title="Edit Script">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setScriptDraft(selectedBatch?.script || '');
                        setScriptEditOpen(true);
                      }}
                      sx={{
                        width: 28,
                        height: 28,
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 1,
                        color: 'text.secondary',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary' },
                      }}
                    >
                      <EditRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
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
              <FormattedScriptViewer text={selectedBatch?.script || ''} highlightedScriptNum={highlightedScriptNum} />
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
            size="small"
            value={editingVideo?.name || ''}
            onChange={e => setEditingVideo(prev => prev ? { ...prev, name: e.target.value } : null)}
          />
          <TextField
            label="Script #"
            type="number"
            fullWidth
            size="small"
            value={editingVideo?.script_number !== undefined ? editingVideo.script_number : ''}
            onChange={e => {
              const val = e.target.value;
              setEditingVideo(prev => prev ? {
                ...prev,
                script_number: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)
              } : null);
            }}
            slotProps={{ htmlInput: { min: 0 } }}
            helperText="Set to 0 if this video has no script"
          />
          <TextField
            label="Description (Optional)"
            placeholder="Key hook, notes, or talking points..."
            fullWidth
            size="small"
            value={editingVideo?.description || ''}
            onChange={e => setEditingVideo(prev => prev ? { ...prev, description: e.target.value } : null)}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="Video URL (Optional)"
              placeholder="https://instagram.com/... or https://youtube.com/..."
              fullWidth
              size="small"
              value={editingVideo?.video_url || ''}
              onChange={e => setEditingVideo(prev => prev ? { ...prev, video_url: e.target.value } : null)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (pasted && (pasted.includes('instagram.com') || pasted.includes('youtu'))) {
                  setTimeout(() => {
                    handleFetchEditingMetadata(pasted);
                  }, 50);
                }
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleFetchEditingMetadata()}
              disabled={editingMetaLoading || !editingVideo?.video_url?.trim()}
              sx={{
                whiteSpace: 'nowrap',
                minWidth: 95,
                height: 40,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                borderColor: 'rgba(225, 48, 108, 0.4)',
                color: '#E1306C',
                '&:hover': {
                  borderColor: '#E1306C',
                  bgcolor: 'rgba(225, 48, 108, 0.08)',
                },
              }}
            >
              {editingMetaLoading ? <CircularProgress size={16} sx={{ color: '#E1306C' }} /> : 'Auto-Fetch'}
            </Button>
          </Box>

          {editingMetaResult && (
            <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {editingMetaResult.postedDate ? (
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleRoundedIcon sx={{ fontSize: 15 }} />
                  Detected Date: {editingMetaResult.postedDate} ({editingMetaResult.usedOfficialMetaApi ? 'Official Meta API' : 'Fallback'})
                </Typography>
              ) : (
                <Typography variant="caption" sx={{ color: '#F59E0B' }}>
                  {editingMetaResult.error || 'No date found for this URL.'}
                </Typography>
              )}
              {(editingMetaResult.likesCount || editingMetaResult.viewsCount) && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  {editingMetaResult.likesCount && (
                    <Chip
                      label={`${editingMetaResult.likesCount} Likes`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, color: '#EF4444', bgcolor: 'rgba(239, 68, 68, 0.1)' }}
                    />
                  )}
                  {editingMetaResult.viewsCount && (
                    <Chip
                      label={`${editingMetaResult.viewsCount} Views`}
                      size="small"
                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, color: '#3B82F6', bgcolor: 'rgba(59, 130, 246, 0.1)' }}
                    />
                  )}
                </Box>
              )}
            </Box>
          )}

          <TextField
            label="Posted Date"
            type="date"
            fullWidth
            size="small"
            value={editingVideo?.posted_date || ''}
            onChange={e => setEditingVideo(prev => prev ? { ...prev, posted_date: e.target.value } : null)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Date shown on video card & PDF export"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditVideoOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (editingVideo) {
                const clean = editingVideo.video_url?.trim() ? cleanVideoUrl(editingVideo.video_url.trim()) : null;
                const dateVal = editingVideo.posted_date?.trim()
                  ? (editingVideo.posted_date.includes('T') ? editingVideo.posted_date : `${editingVideo.posted_date}T12:00:00.000Z`)
                  : undefined;
                const rawScriptNum = editingVideo.script_number;
                const scriptNum = typeof rawScriptNum === 'number'
                  ? Math.max(0, rawScriptNum)
                  : (rawScriptNum === '' ? 0 : Math.max(0, parseInt(String(rawScriptNum), 10) || 0));
                await updateBatchflowVideo(editingVideo.id, {
                  name: editingVideo.name.trim(),
                  script_number: scriptNum,
                  description: editingVideo.description?.trim() || null,
                  video_url: clean,
                  views: editingVideo.views != null && String(editingVideo.views).trim() !== '' ? String(editingVideo.views).trim() : null,
                  likes: editingVideo.likes != null && String(editingVideo.likes).trim() !== '' ? String(editingVideo.likes).trim() : null,
                  ...(dateVal ? { posted_date: dateVal } : {}),
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
        <DialogContent
          ref={addVideoFormRef}
          onKeyDown={handleAddVideoKeyDown}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
        >
          <TextField
            label="Video Title"
            fullWidth
            size="small"
            value={newVideoName}
            onChange={e => setNewVideoName(e.target.value)}
            autoFocus
          />
          <TextField
            label="Script Number"
            type="number"
            fullWidth
            size="small"
            value={newVideoScriptNum}
            onChange={e => {
              const val = e.target.value;
              if (val === '') {
                setNewVideoScriptNum('');
              } else {
                const n = parseInt(val, 10);
                setNewVideoScriptNum(isNaN(n) ? 0 : Math.max(0, n));
              }
            }}
            helperText="Enter 0 if this video has no script"
            slotProps={{ htmlInput: { min: 0 } }}
          />
          <TextField
            label="Description (Optional)"
            placeholder="Key hook, notes, or talking points..."
            fullWidth
            size="small"
            value={newVideoDescription}
            onChange={e => setNewVideoDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddVideoOpen(false)}>Cancel</Button>
          <Button
            ref={addVideoSaveBtnRef}
            variant="contained"
            onClick={handleAddSingleVideo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSingleVideo();
              }
            }}
            disabled={!newVideoName.trim()}
          >
            Add Video
          </Button>
        </DialogActions>
      </Dialog>

      {/* Optional Video Link Dialog (when setting to Posted or editing link) */}
      <Dialog
        open={postedLinkDialogOpen}
        onClose={handleCancelPostedLink}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <InstagramIcon sx={{ color: '#E1306C' }} />
          {postedTargetVideo?.status === 'Posted' ? 'Edit Video Link & Date' : 'Add Video Link & Date'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
              Video: <strong>{postedTargetVideo?.name}</strong> (#{postedTargetVideo?.script_number})
            </Typography>
            <Chip
              label={postedTargetVideo?.status || 'Posted'}
              size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', lineHeight: 1.4 }}>
            Paste the Instagram Reel, post, or video URL. Trackrr can automatically extract the publication date via Meta oEmbed API!
          </Typography>

          {selectedClient?.instagram_id && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const handle = (selectedClient?.instagram_id || '').replace(/^@/, '').trim();
                window.open(`https://www.instagram.com/${handle}/reels/`, '_blank', 'noopener,noreferrer');
              }}
              startIcon={<InstagramIcon sx={{ fontSize: 13, color: '#E1306C' }} />}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderColor: 'rgba(225, 48, 108, 0.35)',
                color: '#F43F5E',
                bgcolor: 'rgba(225, 48, 108, 0.06)',
                height: 24,
                px: 1,
                borderRadius: 1,
                '&:hover': {
                  borderColor: '#E1306C',
                  bgcolor: 'rgba(225, 48, 108, 0.15)',
                },
              }}
            >
              View Reels Page (@{selectedClient.instagram_id.replace('@', '')})
            </Button>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                label="Video URL"
                placeholder="https://instagram.com/reel/... or youtube.com/..."
                fullWidth
                size="small"
                value={postedVideoUrl}
                onChange={(e) => setPostedVideoUrl(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted && (pasted.includes('instagram.com') || pasted.includes('youtu'))) {
                    setTimeout(() => {
                      handleFetchPostedMetadata(pasted);
                    }, 50);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSavePostedLink(false);
                  }
                }}
                autoFocus
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleFetchPostedMetadata()}
                disabled={postedMetaLoading || !postedVideoUrl.trim()}
                sx={{
                  whiteSpace: 'nowrap',
                  minWidth: 100,
                  height: 40,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  borderColor: 'rgba(225, 48, 108, 0.4)',
                  color: '#E1306C',
                  '&:hover': {
                    borderColor: '#E1306C',
                    bgcolor: 'rgba(225, 48, 108, 0.08)',
                  },
                }}
              >
                {postedMetaLoading ? (
                  <CircularProgress size={16} sx={{ color: '#E1306C' }} />
                ) : (
                  <>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 15, mr: 0.5 }} />
                    Auto-Fetch
                  </>
                )}
              </Button>
            </Box>

            {/* Metadata Fetch Status / Preview */}
            {postedMetaLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5 }}>
                <CircularProgress size={14} sx={{ color: '#E1306C' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Fetching post details from Meta oEmbed...
                </Typography>
              </Box>
            )}

            {postedMetaResult && (
              <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                {postedMetaResult.postedDate ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <CheckCircleRoundedIcon sx={{ color: '#10B981', fontSize: 16 }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: '#10B981' }}>
                        Date Detected: {postedMetaResult.postedDate}
                      </Typography>
                      <Chip
                        label={postedMetaResult.usedOfficialMetaApi ? 'Official Meta API' : 'Fallback'}
                        size="small"
                        color={postedMetaResult.usedOfficialMetaApi ? 'success' : 'default'}
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                      />
                    </Box>
                    {postedMetaResult.author && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        Posted by <strong>@{postedMetaResult.author}</strong>
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: '#F59E0B', display: 'block', fontSize: '0.72rem' }}>
                    {postedMetaResult.error || 'Could not auto-extract publication date. Please pick a date below.'}
                  </Typography>
                )}
                {(postedMetaResult.likesCount || postedMetaResult.viewsCount) && (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
                    {postedMetaResult.likesCount && (
                      <Chip
                        label={`${postedMetaResult.likesCount} Likes`}
                        size="small"
                        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, color: '#EF4444', bgcolor: 'rgba(239, 68, 68, 0.1)' }}
                      />
                    )}
                    {postedMetaResult.viewsCount && (
                      <Chip
                        label={`${postedMetaResult.viewsCount} Views`}
                        size="small"
                        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, color: '#3B82F6', bgcolor: 'rgba(59, 130, 246, 0.1)' }}
                      />
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>

          <TextField
            label="Posted Date"
            type="date"
            fullWidth
            size="small"
            value={postedCustomDate}
            onChange={(e) => setPostedCustomDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Auto-detected from Instagram or manually adjustable"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={handleCancelPostedLink}
              sx={{ textTransform: 'none', color: 'text.disabled' }}
            >
              Cancel
            </Button>
            {postedTargetVideo?.status !== 'Posted' && (
              <Button
                onClick={() => handleSavePostedLink(true)}
                sx={{ textTransform: 'none', color: 'text.secondary' }}
              >
                Skip Link
              </Button>
            )}
          </Box>
          <Button
            variant="contained"
            onClick={() => handleSavePostedLink(false)}
            sx={{
              bgcolor: '#10B981',
              '&:hover': { bgcolor: '#059669' },
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5,
            }}
          >
            {postedTargetVideo?.status === 'Posted' ? 'Save Changes' : 'Save & Post'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Context Menu (Right-Click) */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.paper',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              minWidth: 200,
              py: 0.5,
            },
          },
        }}
      >
        {contextMenu?.video.video_url && (
          <MenuItem
            onClick={() => {
              if (contextMenu?.video.video_url) {
                window.open(contextMenu.video.video_url, '_blank', 'noopener,noreferrer');
              }
              setContextMenu(null);
            }}
            sx={{ gap: 1.25, fontSize: '0.85rem', fontWeight: 700, color: '#38BDF8' }}
          >
            <OpenInNewRoundedIcon sx={{ fontSize: 18 }} />
            Go to Video
          </MenuItem>
        )}

        {contextMenu?.video.video_url && (
          <MenuItem
            onClick={() => {
              if (contextMenu?.video.video_url) {
                navigator.clipboard.writeText(contextMenu.video.video_url);
              }
              setContextMenu(null);
            }}
            sx={{ gap: 1.25, fontSize: '0.85rem' }}
          >
            <ContentCopyRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            Copy Video Link
          </MenuItem>
        )}

        {canEdit && (
          <MenuItem
            onClick={() => {
              if (contextMenu?.video) {
                const v = contextMenu.video;
                setPostedTargetVideo(v);
                setPostedVideoUrl(v.video_url || '');
                setPostedViews(v.views ? String(v.views) : '');
                setPostedCustomDate(v.posted_date ? v.posted_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
                setPostedMetaResult(null);
                setPostedMetaLoading(false);
                setPostedLinkDialogOpen(true);
              }
              setContextMenu(null);
            }}
            sx={{ gap: 1.25, fontSize: '0.85rem' }}
          >
            <LinkRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            {contextMenu?.video.video_url ? 'Edit Video Link & Date' : 'Add Video Link & Date'}
          </MenuItem>
        )}

        <Divider sx={{ my: 0.5 }} />

        {canEdit && (
          <MenuItem
            onClick={() => {
              if (contextMenu?.video) {
                const v = contextMenu.video;
                setEditingVideo({
                  id: v.id,
                  name: v.name,
                  script_number: v.script_number,
                  description: v.description || '',
                  video_url: v.video_url || '',
                  posted_date: v.posted_date ? v.posted_date.slice(0, 10) : '',
                  status: v.status,
                  views: v.views || null,
                  likes: v.likes || null,
                });
                setEditingMetaResult(null);
                setEditingMetaLoading(false);
                setEditVideoOpen(true);
              }
              setContextMenu(null);
            }}
            sx={{ gap: 1.25, fontSize: '0.85rem' }}
          >
            <EditRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            Edit Video
          </MenuItem>
        )}

        {canEdit && (
          <MenuItem
            onClick={async () => {
              if (contextMenu?.video) {
                const v = contextMenu.video;
                if (window.confirm(`Delete video "${v.name}"?`)) {
                  await deleteBatchflowVideo(v.id);
                }
              }
              setContextMenu(null);
            }}
            sx={{ gap: 1.25, fontSize: '0.85rem', color: '#F87171' }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
            Delete Video
          </MenuItem>
        )}
      </Menu>

      {/* Live Sync Status Feedback Toast */}
      <Snackbar
        open={Boolean(syncSnackbar)}
        autoHideDuration={3000}
        onClose={() => setSyncSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSyncSnackbar(null)}
          severity="info"
          sx={{
            width: '100%',
            bgcolor: '#1E293B',
            color: '#F1F5F9',
            border: '1px solid rgba(255,255,255,0.1)',
            fontWeight: 600,
            fontSize: '0.82rem',
            '& .MuiAlert-icon': { color: '#38BDF8' }
          }}
        >
          {syncSnackbar}
        </Alert>
      </Snackbar>
    </Box>
  );
}
