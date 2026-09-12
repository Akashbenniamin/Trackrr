export interface VideoMetadataResult {
  postedDate?: string | null;
  postedDateTime?: string | null;
  title?: string;
  author?: string;
  creatorHandle?: string;
  thumbnailUrl?: string;
  likesCount?: string | null;
  commentsCount?: string | null;
  viewsCount?: string | null;
  caption?: string | null;
  provider: 'instagram' | 'youtube' | 'other';
  rawHtml?: string;
  error?: string;
  usedOfficialMetaApi?: boolean;
}

export interface MetaApiCredentials {
  metaAppId?: string;
  metaClientToken?: string;
  metaUserToken?: string;
  metaIgUserId?: string;
}

/**
 * Clean URL of tracking parameters (?igsh=..., ?utm_source=..., etc.)
 */
export function cleanVideoUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.trim().split('?')[0];
  }
}

/**
 * Identify the provider from video URL
 */
export function detectVideoProvider(url: string): 'instagram' | 'youtube' | 'other' {
  const lower = url.toLowerCase();
  if (lower.includes('instagram.com/') || lower.includes('instagr.am/')) {
    return 'instagram';
  }
  if (lower.includes('youtube.com/') || lower.includes('youtu.be/')) {
    return 'youtube';
  }
  return 'other';
}

/**
 * Get Meta access token from options, env variables, or localStorage
 */
export function getMetaAccessToken(credentials?: MetaApiCredentials): string | null {
  if (credentials?.metaAppId && credentials?.metaClientToken) {
    return `${credentials.metaAppId.trim()}|${credentials.metaClientToken.trim()}`;
  }

  const envAppId = import.meta.env.VITE_META_APP_ID;
  const envClientToken = import.meta.env.VITE_META_CLIENT_TOKEN;
  if (envAppId && envClientToken) {
    return `${envAppId.trim()}|${envClientToken.trim()}`;
  }

  const storedToken = localStorage.getItem('trackrr_meta_access_token');
  if (storedToken?.trim()) {
    return storedToken.trim();
  }

  return null;
}

/**
 * Get Meta user access token from options, env variables, or localStorage
 */
export function getMetaUserToken(credentials?: MetaApiCredentials): string | null {
  if (credentials?.metaUserToken?.trim()) {
    return credentials.metaUserToken.trim();
  }

  const envUserToken = import.meta.env.VITE_META_USER_TOKEN;
  if (envUserToken?.trim()) {
    return envUserToken.trim();
  }

  const storedToken = localStorage.getItem('trackrr_meta_user_token');
  if (storedToken?.trim()) {
    return storedToken.trim();
  }

  return null;
}

/**
 * Parse Instagram description string into likes, comments, creator handle, date, and clean caption.
 * Format: "122 likes, 0 comments - leoholidays.in on July 22, 2026: “Every Tamil festival...”"
 */
export function parseInstagramDescription(text?: string | null) {
  if (!text) return {};

  const likesMatch = text.match(/([\d,KMkm.]+)\s+likes/i);
  const likesCount = likesMatch ? likesMatch[1] : null;

  const commentsMatch = text.match(/([\d,KMkm.]+)\s+comments/i);
  const commentsCount = commentsMatch ? commentsMatch[1] : null;

  const viewsMatch = text.match(/([\d,KMkm.]+)\s+(?:views|plays)/i);
  const viewsCount = viewsMatch ? viewsMatch[1] : null;

  const handleDateMatch = text.match(/-\s+([^\s]+)\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}):/i);
  const creatorHandle = handleDateMatch ? handleDateMatch[1] : null;
  const dateStr = handleDateMatch ? handleDateMatch[2] : null;

  let caption: string | null = null;
  const quoteMatch = text.match(/[:：]\s*[“\"]([\s\S]*)[”\"]\.?$/);
  if (quoteMatch && quoteMatch[1]) {
    caption = quoteMatch[1].trim();
  } else {
    const colonIdx = text.indexOf(':');
    if (colonIdx !== -1) {
      caption = text.slice(colonIdx + 1).replace(/^[“\"]|[”\"]\.?$/g, '').trim();
    } else {
      caption = text.trim();
    }
  }

  return { likesCount, commentsCount, viewsCount, creatorHandle, dateStr, caption };
}

/**
 * Fetch video metadata via Meta oEmbed or YouTube oEmbed
 */
export async function fetchVideoMetadata(
  rawUrl: string,
  credentials?: MetaApiCredentials
): Promise<VideoMetadataResult> {
  const cleanUrl = cleanVideoUrl(rawUrl);
  const provider = detectVideoProvider(cleanUrl);

  if (!cleanUrl) {
    return { provider: 'other', error: 'Empty URL provided.' };
  }

  // --- 1. INSTAGRAM (Meta Official oEmbed + Graph API Insights + Fallback) ---
  if (provider === 'instagram') {
    const metaToken = getMetaAccessToken(credentials);
    const userToken = getMetaUserToken(credentials);

    let postedDate: string | null = null;
    let postedDateTime: string | null = null;
    let title: string | undefined = undefined;
    let author: string | undefined = undefined;
    let creatorHandle: string | undefined = undefined;
    let thumbnailUrl: string | undefined = undefined;
    let caption: string | null = null;
    let likesCount: string | null = null;
    let viewsCount: string | null = null;
    let commentsCount: string | null = null;
    let rawHtml: string | undefined = undefined;
    let usedOfficialMetaApi = false;
    let mediaId: string | null = null;

    // A. Meta Official oEmbed API (uses App ID | Client Token from Meta Dev Account)
    if (metaToken) {
      try {
        const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(cleanUrl)}&access_token=${metaToken}`;
        const response = await fetch(oembedUrl);

        if (response.ok) {
          const data = await response.json();
          usedOfficialMetaApi = true;
          title = data.title || undefined;
          author = data.author_name || undefined;
          creatorHandle = data.author_name || undefined;
          thumbnailUrl = data.thumbnail_url || undefined;
          caption = data.title || undefined;
          rawHtml = data.html;
          mediaId = data.media_id || null;

          if (data.html) {
            const timeMatch = data.html.match(/<time[^>]*datetime="([^"]+)"/i);
            if (timeMatch && timeMatch[1]) {
              postedDateTime = timeMatch[1];
              postedDate = timeMatch[1].split('T')[0];
            }
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('Meta oEmbed API error:', errData);
        }
      } catch (err) {
        console.warn('Network error calling Meta oEmbed API:', err);
      }
    }

    // B. Meta Graph API Insights (if User Token is available from Meta Dev Account)
    if (userToken && mediaId) {
      try {
        const fieldsUrl = `https://graph.facebook.com/v19.0/${mediaId}?fields=id,like_count,comments_count,video_view_count,insights.metric(plays,reach,views)&access_token=${encodeURIComponent(userToken)}`;
        const gResp = await fetch(fieldsUrl);
        if (gResp.ok) {
          const gData = await gResp.json();
          if (gData.like_count !== undefined) likesCount = String(gData.like_count);
          if (gData.comments_count !== undefined) commentsCount = String(gData.comments_count);
          if (gData.video_view_count !== undefined) viewsCount = String(gData.video_view_count);
          if (gData.insights?.data) {
            for (const item of gData.insights.data) {
              if ((item.name === 'plays' || item.name === 'views') && item.values?.[0]?.value !== undefined) {
                viewsCount = String(item.values[0].value);
                break;
              }
            }
          }
        } else {
          // Direct insights query
          const insUrl = `https://graph.facebook.com/v19.0/${mediaId}/insights?metric=plays&access_token=${encodeURIComponent(userToken)}`;
          const insResp = await fetch(insUrl);
          if (insResp.ok) {
            const insData = await insResp.json();
            const val = insData?.data?.[0]?.values?.[0]?.value;
            if (val !== undefined && val !== null) {
              viewsCount = String(val);
            }
          }
        }
      } catch (err) {
        console.warn('Meta Graph API media insights error:', err);
      }
    }

    // C. Check cached recent posts in localStorage
    try {
      const allKeys = Object.keys(localStorage);
      for (const k of allKeys) {
        if (k.startsWith('trackrr_recent_ig_')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const posts = JSON.parse(raw);
            if (Array.isArray(posts)) {
              const match = posts.find((p: any) => cleanVideoUrl(p.permalink) === cleanUrl);
              if (match) {
                if (!viewsCount && match.viewsCount) {
                  viewsCount = String(match.viewsCount).replace(/views?/i, '').trim();
                }
                if (!likesCount && match.likesCount) {
                  likesCount = String(match.likesCount).replace(/likes?/i, '').trim();
                }
                if (!postedDate && match.postedDate) {
                  postedDate = match.postedDate;
                }
                break;
              }
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // D. Fetch public metadata resolver (Microlink) if likes, date, or caption are missing
    if (!likesCount || !postedDate || !caption) {
      try {
        const fallbackUrl = `https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}`;
        const fbResponse = await fetch(fallbackUrl);
        if (fbResponse.ok) {
          const fbData = await fbResponse.json();
          const d = fbData?.data;
          const descText = d?.description || d?.title || '';
          const parsed = parseInstagramDescription(descText);

          if (!postedDate) {
            if (d?.date) {
              postedDate = String(d.date).split('T')[0];
            } else if (parsed.dateStr) {
              const parsedD = new Date(parsed.dateStr);
              if (!isNaN(parsedD.getTime())) {
                postedDate = parsedD.toISOString().slice(0, 10);
              }
            }
          }
          if (!postedDateTime && d?.date) {
            postedDateTime = d.date;
          }
          if (!title) {
            title = d?.title || (parsed.caption ? parsed.caption.slice(0, 80) : undefined);
          }
          if (!author) {
            author = d?.author || d?.publisher || undefined;
          }
          if (!creatorHandle) {
            creatorHandle = parsed.creatorHandle || d?.author || undefined;
          }
          if (!thumbnailUrl) {
            thumbnailUrl = d?.image?.url || undefined;
          }
          if (!likesCount && parsed.likesCount) {
            likesCount = String(parsed.likesCount).replace(/likes?/i, '').trim();
          }
          if (!commentsCount && parsed.commentsCount) {
            commentsCount = parsed.commentsCount;
          }
          if (!viewsCount && parsed.viewsCount) {
            viewsCount = String(parsed.viewsCount).replace(/views?/i, '').trim();
          }
          if (!caption) {
            caption = parsed.caption || d?.description || null;
          }
        }
      } catch (err) {
        console.warn('Fallback resolver error:', err);
      }
    }

    if (postedDate || caption || author || likesCount || viewsCount) {
      return {
        postedDate,
        postedDateTime,
        title,
        author,
        creatorHandle,
        thumbnailUrl,
        caption,
        viewsCount: viewsCount ? String(viewsCount).replace(/views?/i, '').trim() : null,
        likesCount: likesCount ? String(likesCount).replace(/likes?/i, '').trim() : null,
        commentsCount: commentsCount || null,
        provider: 'instagram',
        rawHtml,
        usedOfficialMetaApi,
      };
    }

    return {
      provider: 'instagram',
      error: 'Could not extract metadata from this Instagram URL. Please verify the post or reel is public.',
    };
  }

  // --- 2. YOUTUBE (Open oEmbed API + CORS-Enabled Live View Count) ---
  if (provider === 'youtube') {
    try {
      const vidMatch = cleanUrl.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      const vid = vidMatch ? vidMatch[1] : null;

      let viewsCount: string | null = null;
      let postedDate: string | null = null;
      let title: string | undefined = undefined;
      let author: string | undefined = undefined;
      let thumbnailUrl: string | undefined = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : undefined;

      // 1. Fetch oEmbed for basic details (title, author, thumbnail)
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
        const oeResp = await fetch(oembedUrl);
        if (oeResp.ok) {
          const oeData = await oeResp.json();
          title = oeData.title || title;
          author = oeData.author_name || author;
          thumbnailUrl = oeData.thumbnail_url || thumbnailUrl;
        }
      } catch {
        // ignore oEmbed error
      }

      // 2. Fetch live views & upload date from CORS-enabled streaming instances
      if (vid) {
        const instances = [
          `https://api.piped.private.coffee/streams/${vid}`,
          `https://piped-api.garudalinux.org/streams/${vid}`,
          `https://inv.nadeko.net/api/v1/videos/${vid}`,
          `https://invidious.jing.rocks/api/v1/videos/${vid}`,
        ];
        for (const ep of instances) {
          try {
            const resp = await fetch(ep, { signal: AbortSignal.timeout(2500) });
            if (resp.ok) {
              const d = await resp.json();
              const rawV = d.views ?? d.viewCount;
              if (rawV !== undefined && rawV !== null) {
                const num = typeof rawV === 'number' ? rawV : parseInt(String(rawV).replace(/[^0-9]/g, ''), 10);
                if (!isNaN(num)) {
                  if (num >= 1_000_000_000) {
                    const formatted = (num / 1_000_000_000).toFixed(1);
                    viewsCount = formatted.endsWith('.0') ? `${formatted.slice(0, -2)}B` : `${formatted}B`;
                  } else if (num >= 1_000_000) {
                    const formatted = (num / 1_000_000).toFixed(1);
                    viewsCount = formatted.endsWith('.0') ? `${formatted.slice(0, -2)}M` : `${formatted}M`;
                  } else if (num >= 1_000) {
                    const formatted = (num / 1_000).toFixed(1);
                    viewsCount = formatted.endsWith('.0') ? `${formatted.slice(0, -2)}K` : `${formatted}K`;
                  } else {
                    viewsCount = String(num);
                  }
                  if (!postedDate && (d.uploadDate || d.published)) {
                    postedDate = String(d.uploadDate || d.published).split('T')[0];
                  }
                  if (!title && d.title) title = d.title;
                  if (!author && (d.uploader || d.author)) author = d.uploader || d.author;
                  break;
                }
              }
            }
          } catch {
            // try next endpoint
          }
        }
      }

      if (title || viewsCount) {
        return {
          title,
          author,
          creatorHandle: author,
          thumbnailUrl,
          caption: title,
          postedDate,
          viewsCount,
          provider: 'youtube',
        };
      }
    } catch (err) {
      console.warn('YouTube oEmbed error:', err);
    }

    return {
      provider: 'youtube',
      error: 'Could not fetch YouTube video details.',
    };
  }

  return {
    provider: 'other',
    error: 'Unsupported platform for automatic metadata extraction.',
  };
}

export interface InstagramRecentPost {
  id?: string;
  permalink: string;
  thumbnailUrl?: string;
  postedDate?: string;
  postedDateTime?: string;
  caption?: string;
  likesCount?: string | number | null;
  commentsCount?: string | number | null;
  mediaType?: string;
}

export interface RecentPostsResult {
  posts: InstagramRecentPost[];
  source: 'business_discovery' | 'cache' | 'empty';
  error?: string;
  accountName?: string;
  profilePicUrl?: string;
}

export function cleanInstagramHandle(handle: string): string {
  let h = handle.trim();
  if (h.startsWith('@')) h = h.slice(1);
  if (h.includes('instagram.com/')) {
    try {
      const u = new URL(h.startsWith('http') ? h : `https://${h}`);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0]) h = parts[0];
    } catch {
      // ignore
    }
  }
  return h.replace(/[^a-zA-Z0-9._]/g, '');
}

export function openInstagramReelsPopup(handle: string) {
  const clean = cleanInstagramHandle(handle);
  if (!clean) return null;
  const url = `https://www.instagram.com/${clean}/reels/`;
  const width = 450;
  const height = 750;
  const left = window.screen.width ? (window.screen.width - width) / 2 : 100;
  const top = window.screen.height ? (window.screen.height - height) / 2 : 100;
  return window.open(
    url,
    `ig_reels_${clean}`,
    `width=${width},height=${height},top=${top},left=${left},status=no,menubar=no,toolbar=no,location=no`
  );
}

export function getStoredRecentPosts(handle: string): InstagramRecentPost[] {
  const clean = cleanInstagramHandle(handle);
  if (!clean) return [];
  try {
    const raw = localStorage.getItem(`trackrr_recent_ig_${clean}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveRecentPostsForHandle(handle: string, posts: InstagramRecentPost[]) {
  const clean = cleanInstagramHandle(handle);
  if (!clean) return;
  try {
    localStorage.setItem(`trackrr_recent_ig_${clean}`, JSON.stringify(posts.slice(0, 10)));
  } catch {
    // ignore
  }
}

export function addRecentPostForHandle(handle: string, post: InstagramRecentPost) {
  const clean = cleanInstagramHandle(handle);
  if (!clean) return;
  const existing = getStoredRecentPosts(clean);
  // Dedup by permalink
  const filtered = existing.filter(p => cleanVideoUrl(p.permalink) !== cleanVideoUrl(post.permalink));
  const updated = [post, ...filtered].slice(0, 6);
  saveRecentPostsForHandle(clean, updated);
  return updated;
}

export async function fetchClientRecentInstagramPosts(
  rawHandle: string,
  credentials?: MetaApiCredentials & { igUserId?: string; userToken?: string }
): Promise<RecentPostsResult> {
  const cleanHandle = cleanInstagramHandle(rawHandle);
  if (!cleanHandle) {
    return { posts: [], source: 'empty', error: 'Invalid or empty Instagram handle.' };
  }

  // Stored cache for immediate fallback or speed
  const cached = getStoredRecentPosts(cleanHandle);

  const metaToken = credentials?.userToken || getMetaAccessToken(credentials);
  const igUserId = credentials?.igUserId || localStorage.getItem('trackrr_meta_ig_user_id') || 'me';

  if (metaToken) {
    try {
      const fields = `business_discovery.username(${cleanHandle}){id,name,username,profile_picture_url,media.limit(3){id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,like_count,comments_count}}`;
      const url = `https://graph.facebook.com/v19.0/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${metaToken}`;
      const resp = await fetch(url);

      if (resp.ok) {
        const data = await resp.json();
        const disc = data?.business_discovery;
        const mediaList = disc?.media?.data || [];

        const posts: InstagramRecentPost[] = mediaList.map((m: any) => {
          let dateStr: string | undefined = undefined;
          if (m.timestamp) {
            dateStr = m.timestamp.split('T')[0];
          }
          return {
            id: m.id,
            permalink: m.permalink || `https://www.instagram.com/reel/${m.id}/`,
            thumbnailUrl: m.thumbnail_url || m.media_url || undefined,
            postedDate: dateStr,
            postedDateTime: m.timestamp || undefined,
            caption: m.caption || undefined,
            likesCount: m.like_count !== undefined ? String(m.like_count) : null,
            commentsCount: m.comments_count !== undefined ? String(m.comments_count) : null,
            mediaType: m.media_type,
          };
        });

        if (posts.length > 0) {
          saveRecentPostsForHandle(cleanHandle, posts);
          return {
            posts,
            source: 'business_discovery',
            accountName: disc.name || disc.username,
            profilePicUrl: disc.profile_picture_url,
          };
        }
      } else {
        const errJson = await resp.json().catch(() => ({}));
        console.warn('Meta Business Discovery API error:', errJson);
        const errMsg = errJson?.error?.message || 'Meta Business Discovery API request failed.';
        if (cached.length > 0) {
          return { posts: cached, source: 'cache', error: errMsg };
        }
        return { posts: [], source: 'empty', error: errMsg };
      }
    } catch (err: any) {
      console.warn('Network error calling Meta Business Discovery:', err);
      if (cached.length > 0) {
        return { posts: cached, source: 'cache', error: err?.message };
      }
    }
  }

  if (cached.length > 0) {
    return {
      posts: cached,
      source: 'cache',
      error: 'Meta Graph API credentials not configured. Showing cached/saved recent videos.',
    };
  }

  return {
    posts: [],
    source: 'empty',
    error: 'Meta Business Discovery API requires an Instagram Creator/Business account token. Use the 1-Click Live Reels Feed (Popup) to browse and copy links directly.',
  };
}

/**
 * Cleanly separates views and likes from video record, fixing cases where like count was stored in views.
 */
export function extractViewsAndLikes(video: { views?: string | number | null; likes?: string | number | null }) {
  let rawViews = video.views != null ? String(video.views).trim() : '';
  let rawLikes = video.likes != null ? String(video.likes).trim() : '';

  // If views was previously stored as "105 likes" or similar
  if (rawViews.toLowerCase().includes('like')) {
    if (!rawLikes) {
      rawLikes = rawViews.replace(/likes?/i, '').trim();
    }
    rawViews = '';
  }

  // Clean likes to only be the number string (strip "likes", "like")
  if (rawLikes) {
    rawLikes = rawLikes.replace(/likes?/i, '').trim();
  }

  // Clean views to strip "views", "view"
  if (rawViews) {
    rawViews = rawViews.replace(/views?/i, '').trim();
  }

  return {
    views: rawViews || null,
    likes: rawLikes || null,
  };
}
