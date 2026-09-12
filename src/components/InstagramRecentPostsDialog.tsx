import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  Box, IconButton, Tooltip, Chip, CircularProgress, TextField,
  Card,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import AddLinkRoundedIcon from '@mui/icons-material/AddLinkRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { useApp } from '../contexts/AppContext';
import {
  cleanInstagramHandle,
  openInstagramReelsPopup,
  fetchClientRecentInstagramPosts,
  getStoredRecentPosts,
  addRecentPostForHandle,
  fetchVideoMetadata,
  cleanVideoUrl,
  type InstagramRecentPost,
} from '../lib/videoMetadata';
import type { BatchflowVideo } from '../types';

interface InstagramRecentPostsDialogProps {
  open: boolean;
  onClose: () => void;
  handle: string;
  clientName?: string;
  clientColor?: string;
  onSelectVideoUrl?: (url: string, date?: string) => void;
  existingVideos?: BatchflowVideo[];
}

export default function InstagramRecentPostsDialog({
  open,
  onClose,
  handle,
  clientName,
  onSelectVideoUrl,
  existingVideos,
}: InstagramRecentPostsDialogProps) {
  const { settings } = useApp();
  const cleanHandle = cleanInstagramHandle(handle || '');

  const [posts, setPosts] = useState<InstagramRecentPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [handleCopied, setHandleCopied] = useState(false);

  // Quick link extractor bar
  const [quickUrl, setQuickUrl] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const loadPosts = async (forceRefresh = false) => {
    if (!cleanHandle) {
      setPosts([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // Initial check from localStorage cache
    const stored = getStoredRecentPosts(cleanHandle);
    if (stored.length > 0 && !forceRefresh) {
      setPosts(stored.slice(0, 3));
    }

    try {
      const res = await fetchClientRecentInstagramPosts(cleanHandle, {
        metaAppId: settings.meta_app_id,
        metaClientToken: settings.meta_client_token,
        userToken: settings.meta_user_token,
        igUserId: settings.meta_ig_user_id,
      });

      if (res.posts && res.posts.length > 0) {
        setPosts(res.posts.slice(0, 3));
        setErrorMessage(null);
      } else {
        // If API returned nothing or error, see if we have videos already in the workspace
        let fallbackPosts: InstagramRecentPost[] = stored;
        if (fallbackPosts.length === 0 && existingVideos && existingVideos.length > 0) {
          const workspacePosted = existingVideos
            .filter(v => v.status === 'Posted' && v.video_url && v.video_url.includes('instagram.com'))
            .map(v => ({
              id: v.id,
              permalink: v.video_url!,
              postedDate: v.posted_date ? v.posted_date.slice(0, 10) : undefined,
              postedDateTime: v.posted_date || undefined,
              caption: v.name,
            }));
          if (workspacePosted.length > 0) {
            fallbackPosts = workspacePosted;
          }
        }

        if (fallbackPosts.length > 0) {
          setPosts(fallbackPosts.slice(0, 3));
          setErrorMessage(res.error || null);
        } else {
          setPosts([]);
          setErrorMessage(res.error || 'No recent videos found. Use the Live Reels button below to view all reels.');
        }
      }
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

      const updated = addRecentPostForHandle(cleanHandle, newPost);
      if (updated) {
        setPosts(updated.slice(0, 3));
      }
      setQuickUrl('');
    } catch (err: any) {
      setQuickError(err?.message || 'Failed to extract video details.');
    } finally {
      setQuickLoading(false);
    }
  };

  return (
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

        {/* Header row: Last 3 Videos title & refresh */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'text.secondary' }}>
              Last 3 Posted Videos
            </Typography>
            <Chip
              label={`${posts.length} Available`}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(255,255,255,0.06)' }}
            />
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

        {/* Video Cards (The Last 3 Posts) */}
        {posts.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            {posts.map((post, idx) => (
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
                    borderColor: 'rgba(225, 48, 108, 0.4)',
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
                      alt="Thumbnail"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.2s ease',
                        '&:hover': { transform: 'scale(1.05)' },
                      }}
                      onError={(e: any) => {
                        e.currentTarget.style.display = 'none';
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
                      bgcolor: 'rgba(0, 0, 0, 0.25)',
                      transition: 'background 0.2s ease',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.05)' },
                    }}
                  >
                    <PlayCircleOutlineRoundedIcon sx={{ fontSize: 26, color: '#fff', opacity: 0.9 }} />
                  </Box>

                  {/* Index badge */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      bgcolor: 'rgba(0, 0, 0, 0.7)',
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
            ))}
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
  );
}
