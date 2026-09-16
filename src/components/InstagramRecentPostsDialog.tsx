import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  Box, IconButton, Tooltip, Chip, CircularProgress, TextField,
  Card, Snackbar, Alert,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import { useApp } from '../contexts/AppContext';
import {
  cleanInstagramHandle,
  openInstagramReelsPopup,
  fetchClientRecentInstagramPosts,
  getStoredRecentPosts,
  addRecentPostForHandle,
  fetchVideoMetadata,
  cleanVideoUrl,
  extractDateFromVideoUrl,
  extractInstagramShortcode,
  extractDateFromInstagramShortcode,
  type InstagramRecentPost,
} from '../lib/videoMetadata';
import type { BatchflowVideo } from '../types';

interface InstagramRecentPostsDialogProps {
  open: boolean;
  onClose: () => void;
  handle: string;
  clientName?: string;
  clientColor?: string;
  clientId?: string;
  onSelectVideoUrl?: (url: string, date?: string) => void;
  existingVideos?: BatchflowVideo[];
}

export default function InstagramRecentPostsDialog({
  open,
  onClose,
  handle,
  clientName,
  clientId,
  onSelectVideoUrl,
  existingVideos,
}: InstagramRecentPostsDialogProps) {
  const { settings, batchflowBatches, batchflowVideos, batchflowClients, updateBatchflowVideoStatus } = useApp();
  const cleanHandle = cleanInstagramHandle(handle || '');

  const [posts, setPosts] = useState<InstagramRecentPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [handleCopied, setHandleCopied] = useState(false);

  // Link to Video states
  const [linkingPost, setLinkingPost] = useState<InstagramRecentPost | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkSuccessToast, setLinkSuccessToast] = useState<string | null>(null);

  // View mode: Show Last 3 vs All Videos
  const [showAllVideos, setShowAllVideos] = useState(false);

  // Quick link extractor bar
  const [quickUrl, setQuickUrl] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Sort from latest to oldest
  const sortByDateDesc = (items: InstagramRecentPost[]): InstagramRecentPost[] => {
    return [...items].sort((a, b) => {
      const getTimestamp = (p: InstagramRecentPost): number => {
        if (p.postedDateTime) {
          const t = new Date(p.postedDateTime).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        if (p.permalink) {
          const sc = extractInstagramShortcode(p.permalink);
          if (sc) {
            const d = extractDateFromInstagramShortcode(sc);
            if (d) return d.getTime();
          }
        }
        if (p.postedDate) {
          const t = new Date(p.postedDate).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        return 0;
      };

      const tA = getTimestamp(a);
      const tB = getTimestamp(b);
      if (tA && tB && tA !== tB) return tB - tA; // descending (latest first)
      if (tB) return 1;
      if (tA) return -1;
      return 0;
    });
  };

  const enrichMissingThumbnails = async (items: InstagramRecentPost[]) => {
    let changed = false;
    const updated = [...items];

    await Promise.all(
      updated.map(async (p, i) => {
        if (!p.thumbnailUrl && p.permalink) {
          const clean = cleanVideoUrl(p.permalink);
          const cached = clean ? (localStorage.getItem(`trackrr_thumb_${clean}`) || localStorage.getItem(`trackrr_thumb_${p.permalink}`)) : null;
          if (cached) {
            updated[i] = { ...p, thumbnailUrl: cached };
            changed = true;
          } else {
            try {
              const meta = await fetchVideoMetadata(clean, {
                metaAppId: settings.meta_app_id,
                metaClientToken: settings.meta_client_token,
                metaUserToken: settings.meta_user_token,
                metaIgUserId: settings.meta_ig_user_id,
                clientHandle: cleanHandle,
              });
              if (meta && meta.thumbnailUrl) {
                updated[i] = {
                  ...p,
                  thumbnailUrl: meta.thumbnailUrl,
                  likesCount: meta.likesCount || p.likesCount,
                };
                changed = true;
                try { localStorage.setItem(`trackrr_thumb_${clean}`, meta.thumbnailUrl); } catch {}
                try { localStorage.setItem(`trackrr_thumb_${p.permalink}`, meta.thumbnailUrl); } catch {}
              }
            } catch {}
          }
        }
      })
    );

    if (changed) {
      setPosts(sortByDateDesc(updated));
    }
  };

  const loadPosts = async (forceRefresh = false) => {
    if (!cleanHandle) {
      setPosts([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // Initial check from localStorage cache & workspace posted videos
    const stored = getStoredRecentPosts(cleanHandle);
    const initialMap = new Map<string, InstagramRecentPost>();
    const addInitial = (item: InstagramRecentPost) => {
      if (!item.permalink) return;
      const clean = cleanVideoUrl(item.permalink);
      const shortcode = extractInstagramShortcode(item.permalink);
      const key = shortcode ? `sc_${shortcode.toLowerCase()}` : `url_${clean}`;
      if (!initialMap.has(key)) initialMap.set(key, { ...item });
    };

    (existingVideos || [])
      .filter(v => v.status === 'Posted' && v.video_url && v.video_url.includes('instagram.com'))
      .forEach(v => {
        const clean = cleanVideoUrl(v.video_url!);
        const cachedThumb = clean ? (localStorage.getItem(`trackrr_thumb_${clean}`) || localStorage.getItem(`trackrr_thumb_${v.video_url}`)) : null;
        const urlDate = extractDateFromVideoUrl(v.video_url!);
        const effectiveDate = v.posted_date ? v.posted_date.slice(0, 10) : (urlDate || undefined);
        addInitial({
          id: v.id,
          permalink: v.video_url!,
          thumbnailUrl: cachedThumb || undefined,
          postedDate: effectiveDate,
          postedDateTime: v.posted_date || (urlDate ? `${urlDate}T12:00:00.000Z` : undefined),
          caption: v.name,
          likesCount: v.likes ? String(v.likes) : null,
        });
      });
    stored.forEach(addInitial);

    const initialList = Array.from(initialMap.values());
    if (initialList.length > 0 && !forceRefresh) {
      const sortedInitial = sortByDateDesc(initialList);
      setPosts(sortedInitial);
      enrichMissingThumbnails(sortedInitial);
    }

    try {
      const res = await fetchClientRecentInstagramPosts(cleanHandle, {
        metaAppId: settings.meta_app_id,
        metaClientToken: settings.meta_client_token,
        userToken: settings.meta_user_token,
        igUserId: settings.meta_ig_user_id,
      });

      // Build workspace posted videos list
      const workspacePosted: InstagramRecentPost[] = (existingVideos || [])
        .filter(v => v.status === 'Posted' && v.video_url && v.video_url.includes('instagram.com'))
        .map(v => {
          const clean = cleanVideoUrl(v.video_url!);
          const cachedThumb = clean ? (localStorage.getItem(`trackrr_thumb_${clean}`) || localStorage.getItem(`trackrr_thumb_${v.video_url}`)) : null;
          const urlDate = extractDateFromVideoUrl(v.video_url!);
          const effectiveDate = v.posted_date ? v.posted_date.slice(0, 10) : (urlDate || undefined);
          return {
            id: v.id,
            permalink: v.video_url!,
            thumbnailUrl: cachedThumb || undefined,
            postedDate: effectiveDate,
            postedDateTime: v.posted_date || (urlDate ? `${urlDate}T12:00:00.000Z` : undefined),
            caption: v.name,
            likesCount: v.likes ? String(v.likes) : null,
          };
        });

      // Combine all sources: API posts, stored posts, and workspace posted videos
      const mergedMap = new Map<string, InstagramRecentPost>();

      const addOrMerge = (item: InstagramRecentPost) => {
        if (!item.permalink) return;
        const clean = cleanVideoUrl(item.permalink);
        const shortcode = extractInstagramShortcode(item.permalink);
        const key = shortcode ? `sc_${shortcode.toLowerCase()}` : `url_${clean}`;

        const existing = mergedMap.get(key);
        if (!existing) {
          mergedMap.set(key, { ...item });
        } else {
          // Merge best available data
          mergedMap.set(key, {
            ...existing,
            ...item,
            thumbnailUrl: item.thumbnailUrl || existing.thumbnailUrl,
            likesCount: item.likesCount || existing.likesCount,
            commentsCount: item.commentsCount || existing.commentsCount,
            postedDate: item.postedDate || existing.postedDate,
            postedDateTime: item.postedDateTime || existing.postedDateTime,
            caption: item.caption || existing.caption,
          });
        }
      };

      // 1. Workspace posted videos (high priority for accurate title & link)
      workspacePosted.forEach(addOrMerge);
      // 2. Stored cache (Quick extractions)
      stored.forEach(addOrMerge);
      // 3. Official API posts
      (res.posts || []).forEach(addOrMerge);

      const allMerged = Array.from(mergedMap.values());

      if (allMerged.length === 0) {
        setPosts([]);
        setErrorMessage(res.error || 'No posted videos found for this client. Use Quick Reel Extractor below or Live Reels to add.');
        return;
      }

      setErrorMessage(null);
      const sorted = sortByDateDesc(allMerged);
      setPosts(sorted);
      enrichMissingThumbnails(sorted);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error checking recent posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setQuickUrl('');
      setQuickError(null);
      loadPosts();
    }
  }, [open, cleanHandle]);

  const handleCopyUrl = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyHandle = () => {
    navigator.clipboard.writeText(`@${cleanHandle}`);
    setHandleCopied(true);
    setTimeout(() => setHandleCopied(false), 2000);
  };

  const handleOpenLiveReels = () => {
    openInstagramReelsPopup(cleanHandle);
  };

  const handleExtractQuickUrl = async () => {
    if (!quickUrl.trim()) return;
    setQuickLoading(true);
    setQuickError(null);

    try {
      const clean = cleanVideoUrl(quickUrl.trim());
      const meta = await fetchVideoMetadata(clean, {
        metaAppId: settings.meta_app_id,
        metaClientToken: settings.meta_client_token,
        metaUserToken: settings.meta_user_token,
        metaIgUserId: settings.meta_ig_user_id,
        clientHandle: cleanHandle,
      });

      if (meta.error && !meta.title && !meta.thumbnailUrl && !meta.caption) {
        setQuickError(meta.error);
        return;
      }

      const newPost: InstagramRecentPost = {
        permalink: clean,
        thumbnailUrl: meta.thumbnailUrl,
        postedDate: meta.postedDate || new Date().toISOString().slice(0, 10),
        postedDateTime: meta.postedDateTime || undefined,
        caption: meta.caption || meta.title,
        likesCount: meta.likesCount,
        commentsCount: meta.commentsCount,
      };

      if (meta.thumbnailUrl) {
        try { localStorage.setItem(`trackrr_thumb_${clean}`, meta.thumbnailUrl); } catch {}
        try { localStorage.setItem(`trackrr_thumb_${newPost.permalink}`, meta.thumbnailUrl); } catch {}
      }

      const updated = addRecentPostForHandle(cleanHandle, newPost);
      if (updated) {
        const sorted = sortByDateDesc(updated);
        setPosts(sorted);
        enrichMissingThumbnails(sorted);
      }
      setQuickUrl('');
    } catch (err: any) {
      setQuickError(err?.message || 'Failed to extract video details.');
    } finally {
      setQuickLoading(false);
    }
  };

  // Candidate videos for linking (Pending or Edited from this client's batches)
  const resolvedClientId =
    clientId ||
    batchflowClients.find(
      c => cleanInstagramHandle(c.instagram_id || '') === cleanHandle
    )?.id;

  const clientBatches = batchflowBatches.filter(b => b.client_id === resolvedClientId);
  const clientBatchMap = new Map(clientBatches.map(b => [b.id, b]));

  // Helper to find if a post is already linked to a workspace video for this client
  const getMatchingLinkedVideo = (post: InstagramRecentPost): BatchflowVideo | undefined => {
    if (!post.permalink) return undefined;
    const postClean = cleanVideoUrl(post.permalink);
    const postShortcode = extractInstagramShortcode(post.permalink);

    return batchflowVideos.find(v => {
      // Check if video belongs to this client's batches
      if (resolvedClientId) {
        const batch = clientBatchMap.get(v.batch_id);
        if (!batch || batch.client_id !== resolvedClientId) return false;
      }
      if (!v.video_url) return false;
      const vClean = cleanVideoUrl(v.video_url);
      if (vClean && postClean && vClean === postClean) return true;
      if (postShortcode) {
        const vShortcode = extractInstagramShortcode(v.video_url);
        if (vShortcode && vShortcode.toLowerCase() === postShortcode.toLowerCase()) return true;
      }
      return false;
    });
  };

  const candidateVideos = batchflowVideos
    .filter(v => clientBatchMap.has(v.batch_id) && (v.status === 'Pending' || v.status === 'Edited'))
    .sort((a, b) => {
      const batchA = clientBatchMap.get(a.batch_id)?.name || '';
      const batchB = clientBatchMap.get(b.batch_id)?.name || '';
      const cmp = batchA.localeCompare(batchB);
      if (cmp !== 0) return cmp;
      return (a.script_number || 0) - (b.script_number || 0);
    });

  const handleConfirmLink = async (targetVideo: BatchflowVideo) => {
    if (!linkingPost) return;
    setIsLinking(true);
    try {
      const reelDate =
        linkingPost.postedDateTime ||
        linkingPost.postedDate ||
        (linkingPost.permalink ? extractDateFromVideoUrl(linkingPost.permalink) : null);
      const clean = cleanVideoUrl(linkingPost.permalink);

      if (linkingPost.thumbnailUrl && clean) {
        try { localStorage.setItem(`trackrr_thumb_${clean}`, linkingPost.thumbnailUrl); } catch {}
        try { localStorage.setItem(`trackrr_thumb_${linkingPost.permalink}`, linkingPost.thumbnailUrl); } catch {}
      }
      if (linkingPost.caption && clean) {
        try { localStorage.setItem(`trackrr_caption_${clean}`, linkingPost.caption); } catch {}
      }

      await updateBatchflowVideoStatus(
        targetVideo.id,
        'Posted',
        linkingPost.permalink,
        reelDate,
        null,
        linkingPost.likesCount || null
      );

      setLinkSuccessToast(`Linked reel to "${targetVideo.name}" and marked as Posted!`);
      setLinkingPost(null);
      loadPosts(true);
    } catch (err: any) {
      console.error('Error linking reel to video:', err);
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <>
      <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0F172A',
          backgroundImage: 'none',
          borderRadius: 2,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        },
      }}
    >
      {/* Top Instagram Brand Accent Bar */}
      <Box
        sx={{
          height: 4,
          width: '100%',
          background: 'linear-gradient(90deg, #F58529, #DD2A7B, #8134AF, #515BD4)',
        }}
      />

      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(221, 42, 123, 0.35)',
              }}
            >
              <InstagramIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                  {clientName || `@${cleanHandle}`}
                </Typography>
                <Chip
                  label={`@${cleanHandle}`}
                  size="small"
                  onClick={handleCopyHandle}
                  icon={handleCopied ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />}
                  sx={{
                    bgcolor: 'rgba(225, 48, 108, 0.12)',
                    color: '#F43F5E',
                    border: '1px solid rgba(225, 48, 108, 0.3)',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(225, 48, 108, 0.22)' },
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.2 }}>
                Recent Instagram Videos & Live Reels Inspector
              </Typography>
            </Box>
          </Box>

          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 1 }}>
        {/* Option 3: Primary 1-Click Action Bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            p: 1.5,
            mb: 2,
            borderRadius: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Live Reels Popout Inspector
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Instant mobile viewer popup with zero login hurdles or API restrictions.
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="small"
            onClick={handleOpenLiveReels}
            startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              background: 'linear-gradient(135deg, #E1306C, #FD1D1D, #F56040)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.78rem',
              textTransform: 'none',
              px: 1.75,
              py: 0.75,
              borderRadius: 1,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(225, 48, 108, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #C13584, #E1306C, #FD1D1D)',
              },
            }}
          >
            Open Live Reels
          </Button>
        </Box>

        {/* Header row: Title, count, view toggle & refresh */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'text.secondary' }}>
              {showAllVideos ? `All Posted Videos (${posts.length})` : (posts.length > 3 ? 'Last 3 Posted Videos' : 'Posted Videos')}
            </Typography>
            <Chip
              label={`${posts.length} Available`}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)' }}
            />
            {posts.length > 3 && (
              <Button
                size="small"
                onClick={() => setShowAllVideos(!showAllVideos)}
                endIcon={showAllVideos ? <KeyboardArrowUpRoundedIcon sx={{ fontSize: 14 }} /> : <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#38BDF8',
                  p: 0,
                  minWidth: 0,
                  ml: 0.5,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                {showAllVideos ? 'Show Top 3' : `View All (${posts.length})`}
              </Button>
            )}
          </Box>

          <Tooltip title="Refresh recent posts">
            <span>
              <IconButton size="small" onClick={() => loadPosts(true)} disabled={loading} sx={{ color: 'text.secondary' }}>
                {loading ? <CircularProgress size={16} color="inherit" /> : <RefreshRoundedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Loading state */}
        {loading && posts.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1.5 }}>
            <CircularProgress size={32} sx={{ color: '#E1306C' }} />
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
              Querying client posts via Meta Graph API...
            </Typography>
          </Box>
        )}

        {/* Video Cards */}
        {posts.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            {(showAllVideos ? posts : posts.slice(0, 3)).map((post, idx) => {
              const linkedVideo = getMatchingLinkedVideo(post);
              const linkedBatch = linkedVideo ? clientBatchMap.get(linkedVideo.batch_id) : undefined;

              return (
                <Card
                  key={post.id || post.permalink || idx}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    p: 1.25,
                    bgcolor: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 1.5,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                    '&:hover': {
                      borderColor: linkedVideo ? 'rgba(16, 185, 129, 0.4)' : 'rgba(225, 48, 108, 0.4)',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                    },
                  }}
                >
                  {/* Thumbnail / Media Container */}
                  <Box
                    onClick={() => window.open(post.permalink, '_blank')}
                    sx={{
                      width: 76,
                      height: 104,
                      flexShrink: 0,
                      borderRadius: 1,
                      bgcolor: 'rgba(0, 0, 0, 0.4)',
                      overflow: 'hidden',
                      position: 'relative',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {post.thumbnailUrl ? (
                      <Box
                        component="img"
                        src={post.thumbnailUrl}
                        referrerPolicy="no-referrer"
                        alt="Thumbnail"
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.2s ease',
                          '&:hover': { transform: 'scale(1.05)' },
                        }}
                        onError={(e: any) => {
                          const currentSrc: string = e.currentTarget.src || '';
                          if (post.thumbnailUrl && !currentSrc.includes('images.weserv.nl') && !currentSrc.startsWith('data:')) {
                            e.currentTarget.src = `https://images.weserv.nl/?url=${encodeURIComponent(post.thumbnailUrl)}&w=160&h=220&fit=cover&output=jpg`;
                          } else {
                            e.currentTarget.style.display = 'none';
                          }
                        }}
                      />
                    ) : null}

                    {/* Play icon overlay */}
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: post.thumbnailUrl ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.4)',
                        transition: 'background 0.2s ease',
                        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.08)' },
                      }}
                    >
                      <PlayCircleOutlineRoundedIcon sx={{ fontSize: 26, color: '#fff', opacity: 0.9, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
                    </Box>

                    {/* Index badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        bgcolor: 'rgba(0, 0, 0, 0.75)',
                        px: 0.6,
                        py: 0.1,
                        borderRadius: 0.5,
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        color: '#fff',
                      }}
                    >
                      #{idx + 1}
                    </Box>
                  </Box>

                  {/* Content details */}
                  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box>
                      {/* Date and stats header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        {post.postedDate && (
                          <Chip
                            icon={<AccessTimeRoundedIcon sx={{ fontSize: 13, color: '#10B981' }} />}
                            label={post.postedDate}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(16, 185, 129, 0.12)',
                              color: '#34D399',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                            }}
                          />
                        )}

                        {/* Linked vs Not Linked Status Pill */}
                        {linkedVideo ? (
                          <Tooltip title={`Linked to ${linkedBatch?.name || 'Batch'} • Script #${linkedVideo.script_number}: ${linkedVideo.name}`}>
                            <Chip
                              icon={<CheckCircleRoundedIcon sx={{ fontSize: 13, color: '#10B981 !important' }} />}
                              label={`Linked: #${linkedVideo.script_number} ${linkedVideo.name}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.66rem',
                                fontWeight: 800,
                                bgcolor: 'rgba(16, 185, 129, 0.14)',
                                color: '#34D399',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                maxWidth: 190,
                                '& .MuiChip-label': {
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                },
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Chip
                            label="Not Linked"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              bgcolor: 'rgba(239, 68, 68, 0.08)',
                              color: '#F87171',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                            }}
                          />
                        )}

                        {post.likesCount && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: '#F43F5E', fontSize: '0.72rem', fontWeight: 700 }}>
                            <FavoriteRoundedIcon sx={{ fontSize: 13 }} />
                            {post.likesCount}
                          </Box>
                        )}

                        {post.commentsCount && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: '#60A5FA', fontSize: '0.72rem', fontWeight: 700 }}>
                            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />
                            {post.commentsCount}
                          </Box>
                        )}
                      </Box>

                      {/* Caption snippet */}
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.76rem',
                          color: post.caption ? 'text.secondary' : 'text.disabled',
                          fontStyle: post.caption ? 'normal' : 'italic',
                          lineHeight: 1.35,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: 1,
                        }}
                      >
                        {post.caption || 'No caption available for this reel.'}
                      </Typography>
                    </Box>

                    {/* Actions row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleCopyUrl(post.permalink, idx)}
                        startIcon={
                          copiedIndex === idx ? (
                            <CheckRoundedIcon sx={{ fontSize: 14, color: '#34D399' }} />
                          ) : (
                            <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
                          )
                        }
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.72rem',
                          height: 26,
                          px: 1,
                          borderRadius: 1,
                          borderColor: copiedIndex === idx ? '#34D399' : 'rgba(255,255,255,0.15)',
                          color: copiedIndex === idx ? '#34D399' : 'text.primary',
                        }}
                      >
                        {copiedIndex === idx ? 'Copied!' : 'Copy Link'}
                      </Button>

                      <Button
                        size="small"
                        variant="text"
                        onClick={() => window.open(post.permalink, '_blank')}
                        startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.72rem',
                          height: 26,
                          px: 1,
                          color: 'text.secondary',
                          '&:hover': { color: 'primary.light' },
                        }}
                      >
                        Open
                      </Button>

                      {linkedVideo ? (
                        <Tooltip title={`Currently linked to "${linkedVideo.name}". Click to change or relink.`}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setLinkingPost(post)}
                            startIcon={<CheckRoundedIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              textTransform: 'none',
                              fontSize: '0.72rem',
                              height: 26,
                              px: 1.25,
                              borderRadius: 1,
                              borderColor: 'rgba(16, 185, 129, 0.5)',
                              color: '#34D399',
                              bgcolor: 'rgba(16, 185, 129, 0.08)',
                              fontWeight: 700,
                              '&:hover': {
                                bgcolor: 'rgba(16, 185, 129, 0.18)',
                                borderColor: '#10B981',
                              },
                            }}
                          >
                            Linked ✓
                          </Button>
                        </Tooltip>
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => setLinkingPost(post)}
                          startIcon={<AddLinkRoundedIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.72rem',
                            height: 26,
                            px: 1.25,
                            borderRadius: 1,
                            background: 'linear-gradient(135deg, #10B981, #059669)',
                            color: '#fff',
                            fontWeight: 700,
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #059669, #047857)',
                            },
                          }}
                        >
                          Link to Video
                        </Button>
                      )}

                      {onSelectVideoUrl && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            onSelectVideoUrl(post.permalink, post.postedDate);
                            onClose();
                          }}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.72rem',
                            height: 26,
                            px: 1.25,
                            borderRadius: 1,
                            bgcolor: 'primary.main',
                            fontWeight: 700,
                          }}
                        >
                          Use as Video Link
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Card>
              );
            })}

            {/* View More / View Less Button */}
            {posts.length > 3 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5, mb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setShowAllVideos(!showAllVideos)}
                  startIcon={showAllVideos ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#38BDF8',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    bgcolor: 'rgba(56, 189, 248, 0.04)',
                    borderRadius: 1.5,
                    py: 0.5,
                    px: 2,
                    '&:hover': {
                      bgcolor: 'rgba(56, 189, 248, 0.1)',
                      borderColor: 'rgba(56, 189, 248, 0.5)',
                    },
                  }}
                >
                  {showAllVideos ? 'Show Only Last 3 Videos' : `View All ${posts.length} Posted Videos (+${posts.length - 3} more)`}
                </Button>
              </Box>
            )}
          </Box>
        ) : !loading ? (
          <Box
            sx={{
              p: 2.5,
              mb: 2,
              textAlign: 'center',
              borderRadius: 2,
              bgcolor: 'rgba(225, 48, 108, 0.04)',
              border: '1px solid rgba(225, 48, 108, 0.25)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(225, 48, 108, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
                color: '#E1306C',
              }}
            >
              <InstagramIcon sx={{ fontSize: 28 }} />
            </Box>

            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
              Live Reels Inspector
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', maxWidth: 420, mx: 'auto', mb: 2, lineHeight: 1.5 }}>
              View this creator's live reels feed in a dedicated popup window with zero login hurdles, and easily copy reel links directly into your pipeline.
            </Typography>

            <Button
              variant="contained"
              size="medium"
              onClick={handleOpenLiveReels}
              startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{
                background: 'linear-gradient(135deg, #E1306C, #FD1D1D, #F56040)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.84rem',
                textTransform: 'none',
                px: 3,
                py: 1,
                borderRadius: 1.5,
                boxShadow: '0 6px 20px rgba(225, 48, 108, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #C13584, #E1306C, #FD1D1D)',
                },
                mb: 2,
              }}
            >
              Launch Live Reels Popup
            </Button>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                textAlign: 'left',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#38BDF8', display: 'block', mb: 0.5 }}>
                💡 Quick 2-Step Flow:
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.5, fontSize: '0.74rem' }}>
                1. Click <strong>Launch Live Reels Popup</strong> above (opens a clean phone-sized reels window).
                <br />
                2. Right-click or copy the link of any reel, then paste it in the <strong>Quick Reel Extractor</strong> below to auto-fetch its thumbnail, publication date, likes, and comments into this panel!
              </Typography>
            </Box>
          </Box>
        ) : null}

        {/* Quick Link Extractor / Add from Popout */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: '#A855F7' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>
              Quick Reel Extractor (Paste link from Live Popout)
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Paste reel link (e.g. instagram.com/reel/...)"
              value={quickUrl}
              onChange={e => setQuickUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleExtractQuickUrl();
                }
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '0.78rem',
                  height: 32,
                  bgcolor: 'rgba(0, 0, 0, 0.25)',
                },
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleExtractQuickUrl}
              disabled={quickLoading || !quickUrl.trim()}
              startIcon={quickLoading ? <CircularProgress size={14} color="inherit" /> : <AddLinkRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: 1,
                px: 1.5,
                whiteSpace: 'nowrap',
                height: 32,
              }}
            >
              {quickLoading ? 'Extracting...' : 'Add Video'}
            </Button>
          </Box>

          {quickError && (
            <Typography variant="caption" sx={{ color: '#F87171', display: 'block', mt: 0.75, fontSize: '0.72rem' }}>
              {quickError}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
          Instagram Reels & Metadata Inspector
        </Typography>
        <Button onClick={onClose} size="small" variant="outlined" sx={{ borderRadius: 1, textTransform: 'none', fontSize: '0.75rem', px: 2 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>

    {/* Link Reel to Video Modal */}
    <Dialog
      open={Boolean(linkingPost)}
      onClose={() => !isLinking && setLinkingPost(null)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0F172A',
          backgroundImage: 'none',
          borderRadius: 2,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        },
      }}
    >
      <Box
        sx={{
          height: 4,
          width: '100%',
          background: 'linear-gradient(90deg, #10B981, #059669, #047857)',
        }}
      />

      <DialogTitle sx={{ p: 2.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <AddLinkRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>
                Link Reel to Video
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Select a Pending or Edited video for {clientName || `@${cleanHandle}`}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setLinkingPost(null)} disabled={isLinking} sx={{ color: 'text.secondary' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, pt: 0.5 }}>
        {/* Selected Reel Info Banner */}
        {linkingPost && (
          <Card
            sx={{
              display: 'flex',
              gap: 1.5,
              p: 1.25,
              mb: 2.5,
              bgcolor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 1.5,
            }}
          >
            {/* Thumbnail */}
            <Box
              sx={{
                width: 52,
                height: 72,
                flexShrink: 0,
                borderRadius: 1,
                bgcolor: 'rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {linkingPost.thumbnailUrl ? (
                <Box
                  component="img"
                  src={linkingPost.thumbnailUrl}
                  referrerPolicy="no-referrer"
                  alt="Reel thumbnail"
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e: any) => {
                    const currentSrc: string = e.currentTarget.src || '';
                    if (linkingPost.thumbnailUrl && !currentSrc.includes('images.weserv.nl') && !currentSrc.startsWith('data:')) {
                      e.currentTarget.src = `https://images.weserv.nl/?url=${encodeURIComponent(linkingPost.thumbnailUrl)}&w=120&h=160&fit=cover&output=jpg`;
                    } else {
                      e.currentTarget.style.display = 'none';
                    }
                  }}
                />
              ) : (
                <PlayCircleOutlineRoundedIcon sx={{ fontSize: 24, color: '#fff', opacity: 0.7 }} />
              )}
            </Box>

            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Reel to be linked
                </Typography>
                {linkingPost.postedDate && (
                  <Chip
                    icon={<AccessTimeRoundedIcon sx={{ fontSize: 12, color: '#10B981' }} />}
                    label={linkingPost.postedDate}
                    size="small"
                    sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(16, 185, 129, 0.12)', color: '#34D399' }}
                  />
                )}
                {linkingPost.likesCount && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: '#F43F5E', fontSize: '0.7rem', fontWeight: 700 }}>
                    <FavoriteRoundedIcon sx={{ fontSize: 12 }} />
                    {linkingPost.likesCount}
                  </Box>
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {linkingPost.caption || linkingPost.permalink}
              </Typography>
            </Box>
          </Card>
        )}

        {/* Currently Linked Alert */}
        {linkingPost && (() => {
          const curr = getMatchingLinkedVideo(linkingPost);
          const currBatch = curr ? clientBatchMap.get(curr.batch_id) : undefined;
          if (!curr) return null;
          return (
            <Alert
              severity="success"
              icon={<CheckCircleRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{
                mb: 2,
                bgcolor: 'rgba(16, 185, 129, 0.1)',
                color: '#E2E8F0',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.76rem',
                py: 0.5,
                '& .MuiAlert-icon': { color: '#34D399' },
              }}
            >
              This reel is already linked to <strong>{currBatch?.name}</strong> • <strong>Script #{curr.script_number} ({curr.name})</strong>. You can select another video below if you want to relink it.
            </Alert>
          );
        })()}

        {/* Heading */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
            Pending & Edited Videos ({candidateVideos.length})
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
            Click to link & mark as Posted
          </Typography>
        </Box>

        {/* Videos List */}
        {candidateVideos.length === 0 ? (
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              borderRadius: 1.5,
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
              No pending or edited videos found
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
              All videos in batches for this client are already posted, or no batches exist yet.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
            {candidateVideos.map(video => {
              const batch = clientBatchMap.get(video.batch_id);
              const isPending = video.status === 'Pending';

              return (
                <Box
                  key={video.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.25,
                    borderRadius: 1.25,
                    bgcolor: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    gap: 1.5,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(16, 185, 129, 0.4)',
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4, flexWrap: 'wrap' }}>
                      {batch?.name && (
                        <Chip
                          label={batch.name}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            bgcolor: 'rgba(255, 255, 255, 0.06)',
                            color: 'text.secondary',
                          }}
                        />
                      )}
                      <Chip
                        label={`Script #${video.script_number}`}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          bgcolor: 'rgba(255, 255, 255, 0.04)',
                          color: 'text.secondary',
                        }}
                      />
                      <Chip
                        label={video.status}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          bgcolor: isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: isPending ? '#FBBF24' : '#60A5FA',
                          border: `1px solid ${isPending ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                        }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {video.name}
                    </Typography>
                  </Box>

                  <Button
                    size="small"
                    variant="contained"
                    disabled={isLinking}
                    onClick={() => handleConfirmLink(video)}
                    startIcon={isLinking ? <CircularProgress size={13} color="inherit" /> : <CheckRoundedIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      height: 28,
                      px: 1.5,
                      borderRadius: 1,
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #059669, #047857)',
                      },
                    }}
                  >
                    Link & Post
                  </Button>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Button
          onClick={() => setLinkingPost(null)}
          size="small"
          variant="outlined"
          disabled={isLinking}
          sx={{ borderRadius: 1, textTransform: 'none', fontSize: '0.75rem', px: 2 }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>

    {/* Success Toast */}
    <Snackbar
      open={Boolean(linkSuccessToast)}
      autoHideDuration={4000}
      onClose={() => setLinkSuccessToast(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="success"
        onClose={() => setLinkSuccessToast(null)}
        variant="filled"
        sx={{ bgcolor: '#059669', color: '#fff', fontWeight: 600 }}
      >
        {linkSuccessToast}
      </Alert>
    </Snackbar>
    </>
  );
}
