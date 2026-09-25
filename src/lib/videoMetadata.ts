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
  viewsStatus?: 'available' | 'hidden_by_creator' | 'requires_user_token' | 'unsupported';
  metaApiError?: string;
}

export interface MetaApiCredentials {
  metaAppId?: string;
  metaClientToken?: string;
  metaUserToken?: string;
  metaIgUserId?: string;
  clientHandle?: string;
}

/**
 * Built-in default Meta App credentials for official Instagram API integration.
 */
export const DEFAULT_META_APP_ID = '1645469393673995';
export const DEFAULT_META_CLIENT_TOKEN = '0929768c61c7ff78983c6cded5a3bfb7';

/**
 * Format raw view or like count to clean shorthand (e.g. 14500 -> 14.5K)
 */
export function formatMetricCount(val: number | string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  let str = String(val).trim();
  if (!str || !/\d/.test(str)) return null; // CRITICAL: must contain at least one digit! Never return "M" or non-digit strings

  // Strip extraneous labels like "likes", "views", "plays"
  str = str.replace(/^(?:likes?|views?|plays?)\s*|\s*(?:likes?|views?|plays?)$/gi, '').trim();

  // If already formatted with suffix like 14.5K, 2.1M, 1B
  const suffixMatch = str.match(/^([0-9]+(?:[.,][0-9]+)?)\s*([kKmMbB])$/i);
  if (suffixMatch) {
    const numPart = suffixMatch[1].replace(',', '.');
    const unit = suffixMatch[2].toUpperCase();
    return `${numPart}${unit}`;
  }

  const cleanDigits = str.replace(/[^0-9]/g, '');
  if (!cleanDigits) return null;
  const num = parseInt(cleanDigits, 10);
  if (isNaN(num)) return null;

  if (num >= 1_000_000_000) {
    const formatted = (num / 1_000_000_000).toFixed(1);
    return formatted.endsWith('.0') ? `${formatted.slice(0, -2)}B` : `${formatted}B`;
  }
  if (num >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1);
    return formatted.endsWith('.0') ? `${formatted.slice(0, -2)}M` : `${formatted}M`;
  }
  if (num >= 1_000) {
    const formatted = (num / 1_000).toFixed(1);
    return formatted.endsWith('.0') ? `${formatted.slice(0, -2)}K` : `${formatted}K`;
  }
  return String(num);
}

/**
 * Extract shortcode from an Instagram URL (reel, post, or tv)
 */
export function extractInstagramShortcode(url: string): string | null {
  try {
    const m = url.match(/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Decode publication timestamp directly from an Instagram shortcode (Snowflake ID algorithm).
 * Instagram shortcodes are base64-like encoded media IDs where the upper 41 bits represent
 * (timestamp_in_ms - 1314220021000).
 */
export function extractDateFromInstagramShortcode(shortcode: string): Date | null {
  try {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = BigInt(0);
    for (let i = 0; i < shortcode.length; i++) {
      const char = shortcode[i];
      const val = BigInt(alphabet.indexOf(char));
      if (val === BigInt(-1)) return null;
      id = id * BigInt(64) + val;
    }
    const timestampMs = Number((id >> BigInt(23)) + BigInt(1314220021000));
    const d = new Date(timestampMs);
    if (isNaN(d.getTime()) || d.getFullYear() < 2010 || d.getFullYear() > 2035) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Extract publication date directly from a video URL if possible (e.g. Instagram shortcodes).
 * Returns YYYY-MM-DD or null.
 */
export function extractDateFromVideoUrl(url?: string | null): string | null {
  if (!url) return null;
  const shortcode = extractInstagramShortcode(url);
  if (shortcode) {
    const d = extractDateFromInstagramShortcode(shortcode);
    if (d) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

/**
 * Clean Instagram caption by removing prepended author handles, "on Instagram" markers,
 * likes/comments description headers, HTML artifacts, and surrounding quotation marks.
 */
export function cleanInstagramCaption(rawCaption?: string | null, author?: string | null): string | null {
  if (!rawCaption) return null;
  let text = String(rawCaption);

  // Strip HTML anchors for usernames first if present (e.g. from embed HTML: <a class="CaptionUsername">creator</a>)
  text = text.replace(/<a[^>]*class="[^"]*(?:UsernameText|CaptionUsername)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
  text = text.replace(/<a[^>]*href="\/[a-zA-Z0-9._]+\/"[^>]*>[\s\S]*?<\/a>/gi, '');
  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Unescape common HTML entities
  text = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  text = text.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  // 1. Strip "X likes, Y comments - username on Date: “caption”"
  const ogPrefixMatch = text.match(/^(?:[\d,KMkm.]+\s+(?:likes?|views?|comments?)[,\s-]*)+[a-zA-Z0-9._]+\s+on\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*[:：]\s*/i);
  if (ogPrefixMatch) {
    text = text.slice(ogPrefixMatch[0].length);
  }

  // 2. Strip Meta oEmbed / OG prefix: e.g. "username on Instagram: \"caption\""
  text = text.replace(/^@?[a-zA-Z0-9._]+\s+on\s+Instagram\s*[:：]?\s*/i, '');

  // 3. If author/creatorHandle is known, strip it from the start (e.g. "author: caption" or "author caption")
  if (author && author.trim()) {
    const cleanAuthor = author.replace(/^@/, '').trim();
    if (cleanAuthor) {
      const authorRegex = new RegExp(`^@?${cleanAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：\\-–—]?\\s*`, 'i');
      text = text.replace(authorRegex, '');
    }
  }

  // 4. Strip any username prefix with colon or hyphen like "some_handle: caption" or "@some_handle - caption"
  text = text.replace(/^@?[a-zA-Z0-9._]{2,30}\s*[:：\-–—]\s*/, '');

  // 5. Strip username handles starting with @ followed by space: "@leoholidays.in Every Tamil..."
  text = text.replace(/^@[a-zA-Z0-9._]{2,30}\s+/, '');

  // 6. Strip domain-like or dotted/underscored handle at start: "leoholidays.in Every Tamil..."
  text = text.replace(/^[a-zA-Z0-9_-]*[._][a-zA-Z0-9._-]+\s+/, '');

  // 7. Strip surrounding quotes (curly or straight)
  text = text.replace(/^[“\"'«\s]+|[”\"'»\s]+$/g, '').trim();

  // If text is empty or just says "on Instagram" or similar artifact
  if (!text || /^on\s+Instagram$/i.test(text)) {
    return null;
  }

  return text;
}

/**
 * Extract the first few words of a video caption for display inside () brackets.
 */
export function getCaptionSnippet(caption?: string | null, maxWords = 5, author?: string | null): string | null {
  const cleaned = cleanInstagramCaption(caption, author);
  if (!cleaned) return null;
  const words = cleaned.split(' ').filter(w => w.trim().length > 0);
  if (words.length === 0) return null;
  const snippet = words.slice(0, maxWords).join(' ');
  return words.length > maxWords ? `${snippet}...` : snippet;
}

/**
 * Center-crops any image data URL to a 1:1 square canvas to eliminate stretching in PDF exports.
 */
export function cropImageToSquareDataUrl(dataUrl: string, size = 140): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(dataUrl);
  }
  return new Promise<string>((resolve) => {
    const img = new Image();
    if (!dataUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        let sx = 0, sy = 0, sWidth = w, sHeight = h;
        if (w > h) {
          sx = (w - h) / 2;
          sWidth = h;
        } else if (h > w) {
          sy = (h - w) / 2;
          sHeight = w;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Sanitizes any text string for jsPDF rendering:
 * - Strips emojis, astral plane unicode characters, and surrogate pairs that corrupt PDF font encoding.
 * - Standardizes dashes and curly quotes into clean ASCII.
 * - Strips characters that trigger spacing/kerning matrix corruption in PDF streams.
 */
export function sanitizePdfText(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    // Strip surrogate pairs (UTF-16 emojis)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    // Strip symbols, dingbats, variation selectors, astral pictographs
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    // Replace non-printable or unsupported characters outside ASCII / Latin-1
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert any image URL to a base64 data URL with CORS support.
 * Center-crops to 1:1 square so PDF and PNG exports are never stretched.
 * First tries direct fetch, then falls back to wsrv.nl & images.weserv.nl CORS proxies.
 */
export async function fetchImageBase64(url?: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image')) {
    return cropImageToSquareDataUrl(url, 200);
  }

  const tryFetchToDataUrl = async (targetUrl: string): Promise<string | null> => {
    try {
      const resp = await fetch(targetUrl, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const rawData = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (!rawData) return null;
      return cropImageToSquareDataUrl(rawData, 200);
    } catch {
      return null;
    }
  };

  // 1. Direct fetch (works for YouTube, Wikimedia, CORS-enabled CDNs)
  const direct = await tryFetchToDataUrl(url);
  if (direct) return direct;

  // 2. wsrv.nl proxy (URL must be stripped of http:// or https://)
  const strippedUrl = url.replace(/^https?:\/\//, '');
  try {
    const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(strippedUrl)}&w=200&h=200&fit=cover&output=jpg`;
    const proxied = await tryFetchToDataUrl(wsrvUrl);
    if (proxied) return proxied;
  } catch {}

  // 3. images.weserv.nl proxy fallback
  try {
    const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(strippedUrl)}&w=200&h=200&fit=cover&output=jpg`;
    const proxied = await tryFetchToDataUrl(weservUrl);
    if (proxied) return proxied;
  } catch {}

  // 4. HTMLImageElement canvas extraction via proxy
  try {
    const fromImage = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          let sx = 0, sy = 0, sWidth = w, sHeight = h;
          if (w > h) {
            sx = (w - h) / 2;
            sWidth = h;
          } else if (h > w) {
            sy = (h - w) / 2;
            sHeight = w;
          }
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, 200, 200);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = `https://wsrv.nl/?url=${encodeURIComponent(strippedUrl)}&w=200&h=200&fit=cover&output=jpg`;
    });
    if (fromImage) return fromImage;
  } catch {}

  return null;
}

/**
 * Extract username from an Instagram profile or post URL if present
 */
export function extractInstagramUsername(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[1] === 'reel' || parts[1] === 'reels' || parts[1] === 'p' || parts[1] === 'tv')) {
      return parts[0].replace(/[^a-zA-Z0-9._]/g, '');
    }
    return null;
  } catch {
    return null;
  }
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

export interface CachedVideoMeta {
  thumbnailUrl: string | null;
  caption: string | null;
  likes: string | null;
  views: string | null;
  postedDate: string | null;
}

/**
 * Searches localStorage (direct keys and trackrr_recent_ig_ posts) to recover
 * cached thumbnail, caption, likes, views, and postedDate for any video URL or shortcode.
 */
export function getCachedVideoMeta(url?: string | null): CachedVideoMeta {
  const res: CachedVideoMeta = {
    thumbnailUrl: null,
    caption: null,
    likes: null,
    views: null,
    postedDate: null,
  };
  if (!url) return res;

  const clean = cleanVideoUrl(url);
  const cleanNoSlash = clean.replace(/\/+$/, '');
  const shortcode = extractInstagramShortcode(url);

  // 1. YouTube thumbnail check
  const ytMatch = clean.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    res.thumbnailUrl = `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // 2. Direct key lookups in localStorage
  try {
    const keysToTry = [clean, cleanNoSlash, url];
    if (shortcode) {
      keysToTry.push(shortcode);
      keysToTry.push(`sc_${shortcode.toLowerCase()}`);
    }

    for (const k of keysToTry) {
      if (!res.thumbnailUrl) {
        const val = localStorage.getItem(`trackrr_thumb_${k}`);
        if (val) res.thumbnailUrl = val;
      }
      if (!res.caption) {
        const val = localStorage.getItem(`trackrr_caption_${k}`);
        if (val) res.caption = val;
      }
      if (!res.likes) {
        const val = localStorage.getItem(`trackrr_likes_${k}`);
        if (val) res.likes = formatMetricCount(val);
      }
      if (!res.views) {
        const val = localStorage.getItem(`trackrr_views_${k}`);
        if (val) res.views = formatMetricCount(val);
      }
    }
  } catch {}

  // 3. Scan trackrr_recent_ig_* in localStorage
  try {
    const allKeys = Object.keys(localStorage);
    for (const k of allKeys) {
      if (k.startsWith('trackrr_recent_ig_')) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const posts = JSON.parse(raw);
          if (Array.isArray(posts)) {
            const match = posts.find((p: any) => {
              if (shortcode && p.shortcode && p.shortcode.toLowerCase() === shortcode.toLowerCase()) return true;
              if (shortcode && p.permalink && extractInstagramShortcode(p.permalink)?.toLowerCase() === shortcode.toLowerCase()) return true;
              if (p.permalink) {
                const pClean = cleanVideoUrl(p.permalink).replace(/\/+$/, '');
                if (pClean === cleanNoSlash) return true;
              }
              if (shortcode && p.permalink?.includes(shortcode)) return true;
              return false;
            });
            if (match) {
              if (!res.thumbnailUrl && match.thumbnailUrl) res.thumbnailUrl = match.thumbnailUrl;
              if (!res.caption && match.caption) res.caption = match.caption;
              if (!res.likes && match.likesCount) res.likes = formatMetricCount(match.likesCount);
              if (!res.views && match.viewsCount) res.views = formatMetricCount(match.viewsCount);
              if (!res.postedDate && (match.postedDateTime || match.postedDate)) {
                res.postedDate = match.postedDateTime || match.postedDate;
              }
              if (res.thumbnailUrl && res.caption && res.likes) break;
            }
          }
        }
      }
    }
  } catch {}

  return res;
}

/**
 * Persists thumbnail, caption, likes, and views into localStorage under clean, cleanNoSlash,
 * raw URL, and shortcode variants for maximum retrieval resilience.
 */
export function saveCachedVideoMeta(
  url: string,
  meta: { thumbnailUrl?: string | null; caption?: string | null; likes?: string | null; views?: string | null; postedDate?: string | null }
) {
  if (!url) return;
  const clean = cleanVideoUrl(url);
  const cleanNoSlash = clean.replace(/\/+$/, '');
  const shortcode = extractInstagramShortcode(url);

  const keys = [clean, cleanNoSlash, url];
  if (shortcode) {
    keys.push(shortcode);
    keys.push(`sc_${shortcode.toLowerCase()}`);
  }

  for (const k of keys) {
    if (meta.thumbnailUrl) {
      try { localStorage.setItem(`trackrr_thumb_${k}`, meta.thumbnailUrl); } catch {}
    }
    if (meta.caption) {
      try { localStorage.setItem(`trackrr_caption_${k}`, meta.caption); } catch {}
    }
    if (meta.likes) {
      const cleanLikes = formatMetricCount(meta.likes);
      if (cleanLikes) {
        try { localStorage.setItem(`trackrr_likes_${k}`, cleanLikes); } catch {}
      }
    }
    if (meta.views) {
      const cleanViews = formatMetricCount(meta.views);
      if (cleanViews) {
        try { localStorage.setItem(`trackrr_views_${k}`, cleanViews); } catch {}
      }
    }
    if (meta.postedDate) {
      try { localStorage.setItem(`trackrr_date_${k}`, meta.postedDate); } catch {}
    }
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

  try {
    const rawFt = localStorage.getItem('ft_settings');
    if (rawFt) {
      const parsed = JSON.parse(rawFt);
      if (parsed.meta_app_id?.trim() && parsed.meta_client_token?.trim()) {
        return `${parsed.meta_app_id.trim()}|${parsed.meta_client_token.trim()}`;
      }
    }
  } catch {}

  // Built-in default app credentials for all users
  return `${DEFAULT_META_APP_ID}|${DEFAULT_META_CLIENT_TOKEN}`;
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

  try {
    const rawFt = localStorage.getItem('ft_settings');
    if (rawFt) {
      const parsed = JSON.parse(rawFt);
      if (parsed.meta_user_token?.trim()) {
        return parsed.meta_user_token.trim();
      }
    }
  } catch {}

  return null;
}

/**
 * Get Meta Instagram Business / Creator Account ID from options, env variables, or localStorage
 */
export function getMetaIgUserId(credentials?: MetaApiCredentials | { igUserId?: string }): string {
  const credIgId = (credentials as MetaApiCredentials)?.metaIgUserId || (credentials as { igUserId?: string })?.igUserId;
  if (credIgId?.trim()) {
    return credIgId.trim();
  }

  const storedId = localStorage.getItem('trackrr_meta_ig_user_id');
  if (storedId?.trim()) {
    return storedId.trim();
  }

  try {
    const rawFt = localStorage.getItem('ft_settings');
    if (rawFt) {
      const parsed = JSON.parse(rawFt);
      if (parsed.meta_ig_user_id?.trim()) {
        return parsed.meta_ig_user_id.trim();
      }
    }
  } catch {}

  return 'me';
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

  const viewsMatch = text.match(/([\d,KMkm.]+)\s*(?:views?|plays?|reels? plays?)/i);
  const viewsCount = viewsMatch ? viewsMatch[1] : null;

  const handleDateMatch = text.match(/-\s+([^\s]+)\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}):/i);
  const creatorHandle = handleDateMatch ? handleDateMatch[1] : null;
  const dateStr = handleDateMatch ? handleDateMatch[2] : null;

  let rawCaption: string | null = null;
  const quoteMatch = text.match(/[:：]\s*[“\"]([\s\S]*)[”\"]\.?$/);
  if (quoteMatch && quoteMatch[1]) {
    rawCaption = quoteMatch[1].trim();
  } else {
    const colonIdx = text.indexOf(':');
    if (colonIdx !== -1) {
      rawCaption = text.slice(colonIdx + 1).replace(/^[“\"]|[”\"]\.?$/g, '').trim();
    } else {
      rawCaption = text.trim();
    }
  }

  const caption = cleanInstagramCaption(rawCaption, creatorHandle);

  return { likesCount, commentsCount, viewsCount, creatorHandle, dateStr, caption };
}

/**
 * Automatically resolve the user's connected Instagram Business / Creator Account ID from their User Token.
 */
export async function resolveInstagramBusinessAccountId(userToken: string): Promise<{ id: string; username?: string; error?: string } | null> {
  const token = userToken?.trim();
  if (!token) return null;

  try {
    let lastError: string | undefined;

    // 1. Try /me/accounts with instagram_business_account (standard Facebook Page linked to Instagram)
    const pageUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`;
    const pageResp = await fetch(pageUrl);
    if (pageResp.ok) {
      const pageData = await pageResp.json();
      for (const page of pageData?.data || []) {
        if (page.instagram_business_account?.id) {
          return {
            id: page.instagram_business_account.id,
            username: page.instagram_business_account.username || page.name,
          };
        }
      }
    } else {
      const errData = await pageResp.json().catch(() => ({}));
      if (errData?.error?.message) {
        lastError = errData.error.message;
      }
    }

    // 2. Try /me?fields=instagram_business_account
    const meUrl = `https://graph.facebook.com/v19.0/me?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`;
    const meResp = await fetch(meUrl);
    if (meResp.ok) {
      const meData = await meResp.json();
      if (meData?.instagram_business_account?.id) {
        return {
          id: meData.instagram_business_account.id,
          username: meData.instagram_business_account.username,
        };
      }
    } else if (!lastError) {
      const errData = await meResp.json().catch(() => ({}));
      if (errData?.error?.message) {
        lastError = errData.error.message;
      }
    }

    // 3. Try /me on graph.instagram.com for direct Instagram Login
    const igUrl = `https://graph.instagram.com/v19.0/me?fields=id,username,account_type&access_token=${encodeURIComponent(token)}`;
    const igResp = await fetch(igUrl);
    if (igResp.ok) {
      const igData = await igResp.json();
      if (igData?.id) {
        return {
          id: igData.id,
          username: igData.username,
        };
      }
    } else if (!lastError) {
      const errData = await igResp.json().catch(() => ({}));
      if (errData?.error?.message) {
        lastError = errData.error.message;
      }
    }

    if (lastError) {
      return { id: '', error: lastError };
    }
  } catch (err: any) {
    console.warn('Could not auto-resolve Instagram Account ID:', err);
    return { id: '', error: err?.message };
  }

  return null;
}

/**
 * Query Meta Graph API Business Discovery for a given creator handle and match target reel.
 */
export async function queryMetaBusinessDiscovery(
  targetHandle: string,
  userToken: string,
  igUserId: string,
  shortcode: string | null,
  cleanUrl: string
): Promise<{
  viewsCount: string | null;
  likesCount: string | null;
  commentsCount: string | null;
  postedDate: string | null;
  postedDateTime: string | null;
  caption: string | null;
  thumbnailUrl?: string | null;
  matched: boolean;
  metaApiError?: string;
} | null> {
  const cleanH = cleanInstagramHandle(targetHandle);
  if (!cleanH || !userToken) return null;

  let activeIgId = igUserId?.trim();

  // If igUserId is missing or 'me', attempt to auto-resolve from the user's token!
  if (!activeIgId || activeIgId === 'me') {
    const resolved = await resolveInstagramBusinessAccountId(userToken);
    if (resolved?.id) {
      activeIgId = resolved.id;
      try {
        localStorage.setItem('trackrr_meta_ig_user_id', resolved.id);
      } catch {
        // ignore
      }
    }
  }

  // If still missing or 'me', explain clearly that an Instagram Business Account ID is needed
  if (!activeIgId || activeIgId === 'me') {
    return {
      matched: false,
      viewsCount: null,
      likesCount: null,
      commentsCount: null,
      postedDate: null,
      postedDateTime: null,
      caption: null,
      metaApiError: 'Meta requires an Instagram Business/Creator Account ID (starts with 178414...). Your Facebook profile does not have a linked Instagram Professional account.',
    };
  }

  try {
    const bdFields = `business_discovery.username(${cleanH}){id,name,username,media.limit(50){id,shortcode,permalink,timestamp,media_type,like_count,comments_count,view_count,caption,media_url,thumbnail_url}}`;
    const bdUrl = `https://graph.facebook.com/v19.0/${activeIgId}?fields=${encodeURIComponent(bdFields)}&access_token=${encodeURIComponent(userToken)}`;
    const bdResp = await fetch(bdUrl);

    if (bdResp.ok) {
      const bdData = await bdResp.json();
      const mediaList = bdData?.business_discovery?.media?.data || [];
      if (mediaList.length > 0) {
        // Cache recent posts for this handle
        const cachePosts: InstagramRecentPost[] = mediaList.map((m: any) => {
          const thumb = m.thumbnail_url || m.media_url || undefined;
          const perm = m.permalink || (m.shortcode ? `https://www.instagram.com/reel/${m.shortcode}/` : '');
          if (thumb && perm) {
            try { localStorage.setItem(`trackrr_thumb_${cleanVideoUrl(perm)}`, thumb); } catch {}
          }
          return {
            id: m.id,
            permalink: perm,
            thumbnailUrl: thumb,
            postedDate: m.timestamp ? m.timestamp.split('T')[0] : undefined,
            postedDateTime: m.timestamp || undefined,
            caption: m.caption || undefined,
            likesCount: m.like_count !== undefined ? formatMetricCount(m.like_count) : null,
            commentsCount: m.comments_count !== undefined ? String(m.comments_count) : null,
            viewsCount: m.view_count !== undefined && m.view_count !== null ? formatMetricCount(m.view_count) : null,
            mediaType: m.media_type,
          };
        });
        saveRecentPostsForHandle(cleanH, cachePosts);

        // Find matching reel by shortcode or permalink
        const match = mediaList.find((m: any) =>
          (shortcode && m.shortcode === shortcode) ||
          (m.permalink && cleanVideoUrl(m.permalink) === cleanUrl) ||
          (shortcode && m.permalink?.includes(shortcode))
        );

        if (match) {
          const matchThumb = match.thumbnail_url || match.media_url || null;
          const matchLikes = match.like_count !== undefined ? formatMetricCount(match.like_count) : null;
          saveCachedVideoMeta(cleanUrl, {
            thumbnailUrl: matchThumb,
            caption: match.caption,
            likes: matchLikes,
          });
          return {
            matched: true,
            viewsCount: match.view_count !== undefined && match.view_count !== null ? formatMetricCount(match.view_count) : null,
            likesCount: matchLikes,
            commentsCount: match.comments_count !== undefined ? String(match.comments_count) : null,
            postedDate: match.timestamp ? match.timestamp.split('T')[0] : null,
            postedDateTime: match.timestamp || null,
            caption: match.caption || null,
            thumbnailUrl: matchThumb,
          };
        }
      }
    } else {
      const errJson = await bdResp.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || 'Meta Business Discovery API error';
      console.warn('Meta Business Discovery API response error:', errJson);
      return {
        matched: false,
        viewsCount: null,
        likesCount: null,
        commentsCount: null,
        postedDate: null,
        postedDateTime: null,
        caption: null,
        metaApiError: errMsg,
      };
    }
  } catch (err: any) {
    console.warn('Meta Business Discovery API network error:', err);
    return {
      matched: false,
      viewsCount: null,
      likesCount: null,
      commentsCount: null,
      postedDate: null,
      postedDateTime: null,
      caption: null,
      metaApiError: err?.message,
    };
  }

  return null;
}

/**
 * Checks if the Trackrr Chrome extension is installed and active in the browser.
 */
export function isTrackrrExtensionInstalled(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  return (
    document.documentElement.getAttribute('data-trackrr-extension') !== null ||
    Boolean((window as any).__TRACKRR_EXTENSION_ACTIVE__)
  );
}

/**
 * Fetch Instagram metadata via Trackrr Chrome Extension bridge.
 * Returns null if extension is not installed or times out.
 */
export async function fetchFromTrackrrExtension(url: string, timeoutMs = 4000): Promise<VideoMetadataResult | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const requestId = `trackrr_req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let timer: any = null;

    const handler = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'TRACKRR_EXT_RESULT' && event.data.requestId === requestId) {
        window.removeEventListener('message', handler);
        if (timer) clearTimeout(timer);
        const d = event.data;
        if (d.error && !d.thumbnailUrl && !d.likesCount && !d.caption) {
          resolve(null);
          return;
        }
        const cleanCap = cleanInstagramCaption(d.caption, d.author);
        resolve({
          provider: 'instagram',
          postedDate: d.postedDate || null,
          postedDateTime: d.postedDateTime || null,
          likesCount: d.likesCount ? formatMetricCount(d.likesCount) : null,
          viewsCount: d.viewsCount ? formatMetricCount(d.viewsCount) : null,
          commentsCount: d.commentsCount || null,
          caption: cleanCap || null,
          title: cleanCap ? cleanCap.slice(0, 80) : undefined,
          author: d.author || undefined,
          creatorHandle: d.author || undefined,
          thumbnailUrl: d.thumbnailUrl || undefined,
          usedOfficialMetaApi: true,
        });
      }
    };

    window.addEventListener('message', handler);

    timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, timeoutMs);

    window.postMessage(
      {
        type: 'TRACKRR_EXT_FETCH',
        requestId,
        url,
      },
      '*'
    );
  });
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

  // --- 1. INSTAGRAM (Chrome Extension Companion + Meta Official oEmbed + Graph API + Fallback) ---
  if (provider === 'instagram') {
    // Priority 1: Check Trackrr Chrome Extension bridge for instant browser-session extraction
    try {
      const extResult = await fetchFromTrackrrExtension(cleanUrl);
      if (extResult && (extResult.thumbnailUrl || extResult.caption || extResult.likesCount || extResult.viewsCount)) {
        saveCachedVideoMeta(cleanUrl, {
          thumbnailUrl: extResult.thumbnailUrl,
          caption: extResult.caption,
          likes: extResult.likesCount,
          views: extResult.viewsCount,
        });
        const shortcode = extractInstagramShortcode(cleanUrl);
        if (extResult.thumbnailUrl && shortcode) {
          fetchImageBase64(extResult.thumbnailUrl).then((b64) => {
            if (b64) {
              try {
                localStorage.setItem(`trackrr_thumb_b64_sc_${shortcode.toLowerCase()}`, b64);
              } catch {}
            }
          }).catch(() => {});
        }
        return extResult;
      }
    } catch (e) {
      console.warn('Trackrr extension communication check failed:', e);
    }

    const metaToken = getMetaAccessToken(credentials);
    const userToken = getMetaUserToken(credentials);
    const igUserId = getMetaIgUserId(credentials);

    let postedDate: string | null = null;
    let postedDateTime: string | null = null;
    let title: string | undefined = undefined;
    let author: string | undefined = undefined;
    let creatorHandle: string | undefined = credentials?.clientHandle ? cleanInstagramHandle(credentials.clientHandle) : undefined;
    let thumbnailUrl: string | undefined = undefined;
    let caption: string | null = null;
    let likesCount: string | null = null;
    let viewsCount: string | null = null;
    let commentsCount: string | null = null;
    let rawHtml: string | undefined = undefined;
    let usedOfficialMetaApi = false;
    let mediaId: string | null = null;
    let metaApiError: string | undefined = undefined;

    const shortcode = extractInstagramShortcode(cleanUrl);
    const urlHandle = extractInstagramUsername(cleanUrl);
    if (urlHandle && !creatorHandle) {
      creatorHandle = urlHandle;
    }

    if (shortcode) {
      const scDate = extractDateFromInstagramShortcode(shortcode);
      if (scDate) {
        postedDate = scDate.toISOString().slice(0, 10);
        postedDateTime = scDate.toISOString();
      }
    }

    const initialCached = getCachedVideoMeta(cleanUrl);
    if (initialCached.thumbnailUrl && !thumbnailUrl) thumbnailUrl = initialCached.thumbnailUrl;
    if (initialCached.caption && !caption) caption = initialCached.caption;
    if (initialCached.likes && !likesCount) likesCount = initialCached.likes;
    if (initialCached.postedDate && !postedDate) {
      postedDate = initialCached.postedDate.slice(0, 10);
      postedDateTime = initialCached.postedDate;
    }

    const applyBdResult = (res: { viewsCount: string | null; likesCount: string | null; commentsCount: string | null; postedDate: string | null; postedDateTime: string | null; caption: string | null; thumbnailUrl?: string | null }) => {
      usedOfficialMetaApi = true;
      if (res.viewsCount) viewsCount = res.viewsCount;
      if (res.likesCount) likesCount = res.likesCount;
      if (res.commentsCount) commentsCount = res.commentsCount;
      if (res.postedDate) {
        postedDate = res.postedDate;
        postedDateTime = res.postedDateTime;
      }
      if (res.caption) caption = res.caption;
      if (res.thumbnailUrl) thumbnailUrl = res.thumbnailUrl;
    };

    // A. Meta Official oEmbed API (uses App ID | Client Token from Meta Dev Account)
    if (metaToken) {
      try {
        const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(cleanUrl)}&access_token=${metaToken}`;
        const response = await fetch(oembedUrl);

        if (response.ok) {
          const data = await response.json();
          usedOfficialMetaApi = true;
          const cleanCap = cleanInstagramCaption(data.title, data.author_name);
          title = cleanCap || data.title || undefined;
          author = data.author_name || undefined;
          creatorHandle = data.author_name || creatorHandle;
          thumbnailUrl = data.thumbnail_url || undefined;
          caption = cleanCap || data.title || undefined;
          rawHtml = data.html;
          mediaId = data.media_id || null;

          if (data.thumbnail_url || caption) {
            saveCachedVideoMeta(cleanUrl, {
              thumbnailUrl: data.thumbnail_url,
              caption: caption,
            });
          }

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

    // B. Meta Business Discovery API (Uses User Token to fetch public reels metrics: view_count & like_count)
    let targetHandle = creatorHandle || (credentials?.clientHandle ? cleanInstagramHandle(credentials.clientHandle) : null);
    if (!targetHandle) {
      try {
        const allKeys = Object.keys(localStorage);
        for (const k of allKeys) {
          if (k.startsWith('trackrr_recent_ig_')) {
            const raw = localStorage.getItem(k);
            if (raw && shortcode && raw.toLowerCase().includes(shortcode.toLowerCase())) {
              targetHandle = k.replace('trackrr_recent_ig_', '');
              break;
            }
          }
        }
      } catch {}

      if (!targetHandle) {
        try {
          const rawBf = localStorage.getItem('ft_bf_clients');
          if (rawBf) {
            const clients = JSON.parse(rawBf);
            if (Array.isArray(clients)) {
              const withIg = clients.filter((c: any) => !c.archived && c.instagram_id?.trim());
              if (withIg.length === 1) {
                targetHandle = cleanInstagramHandle(withIg[0].instagram_id);
              }
            }
          }
        } catch {}
      }

      if (!targetHandle) {
        try {
          const igKeys = Object.keys(localStorage).filter(k => k.startsWith('trackrr_recent_ig_'));
          if (igKeys.length === 1) {
            targetHandle = igKeys[0].replace('trackrr_recent_ig_', '');
          }
        } catch {}
      }
    }

    if (userToken && targetHandle) {
      const bdRes = await queryMetaBusinessDiscovery(targetHandle, userToken, igUserId, shortcode, cleanUrl);
      if (bdRes?.matched) {
        applyBdResult(bdRes);
      } else if (bdRes?.metaApiError) {
        metaApiError = bdRes.metaApiError;
      }
    }

    // C. Meta Graph API Insights (if User Token is available and media belongs to token owner)
    if (!viewsCount && userToken && mediaId) {
      try {
        const fieldsUrl = `https://graph.facebook.com/v19.0/${mediaId}?fields=id,like_count,comments_count,video_view_count,insights.metric(plays,reach,views)&access_token=${encodeURIComponent(userToken)}`;
        const gResp = await fetch(fieldsUrl);
        if (gResp.ok) {
          const gData = await gResp.json();
          if (!likesCount && gData.like_count !== undefined) likesCount = formatMetricCount(gData.like_count);
          if (!commentsCount && gData.comments_count !== undefined) commentsCount = String(gData.comments_count);
          if (gData.video_view_count !== undefined) viewsCount = formatMetricCount(gData.video_view_count);
          if (!viewsCount && gData.insights?.data) {
            for (const item of gData.insights.data) {
              if ((item.name === 'plays' || item.name === 'views') && item.values?.[0]?.value !== undefined) {
                viewsCount = formatMetricCount(item.values[0].value);
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Meta Graph API media insights error:', err);
      }
    }

    // D. Check cached recent posts in localStorage
    if (!viewsCount || !likesCount || !postedDate || !thumbnailUrl || !caption) {
      try {
        const allKeys = Object.keys(localStorage);
        for (const k of allKeys) {
          if (k.startsWith('trackrr_recent_ig_')) {
            const raw = localStorage.getItem(k);
            if (raw) {
              const posts = JSON.parse(raw);
              if (Array.isArray(posts)) {
                const match = posts.find((p: any) =>
                  (shortcode && p.permalink && extractInstagramShortcode(p.permalink)?.toLowerCase() === shortcode.toLowerCase()) ||
                  (p.permalink && cleanVideoUrl(p.permalink) === cleanUrl) ||
                  (shortcode && p.permalink?.includes(shortcode))
                );
                if (match) {
                  if (!viewsCount && match.viewsCount) {
                    viewsCount = formatMetricCount(match.viewsCount);
                  }
                  if (!likesCount && match.likesCount) {
                    likesCount = formatMetricCount(match.likesCount);
                  }
                  if (!postedDate && match.postedDate) {
                    postedDate = match.postedDate;
                  }
                  if (!thumbnailUrl && match.thumbnailUrl) {
                    thumbnailUrl = match.thumbnailUrl;
                  }
                  if (!caption && match.caption) {
                    caption = match.caption;
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
    }

    // E. Fetch public metadata resolver (Microlink) if views, likes, date, or caption are missing
    if (!viewsCount || !likesCount || !postedDate || !caption) {
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
            likesCount = formatMetricCount(parsed.likesCount);
          }
          if (!commentsCount && parsed.commentsCount) {
            commentsCount = parsed.commentsCount;
          }
          if (!viewsCount && parsed.viewsCount) {
            viewsCount = formatMetricCount(parsed.viewsCount);
          }
          if (!caption) {
            caption = cleanInstagramCaption(parsed.caption || d?.description || null, author);
          }
        }
      } catch (err) {
        console.warn('Fallback resolver error:', err);
      }
    }

    // F. Direct Instagram Embed scraping fallback (bypasses noscript redirect for views, likes, captions)
    if (shortcode && (!viewsCount || !likesCount || !thumbnailUrl || !caption)) {
      const embedUrls = [
        `https://www.instagram.com/p/${shortcode}/embed/captioned/?_fb_noscript=1`,
        `https://www.instagram.com/reel/${shortcode}/embed/captioned/?_fb_noscript=1`
      ];

      for (const embedUrl of embedUrls) {
        try {
          const embedResp = await fetch(embedUrl, {
            credentials: 'omit',
            cache: 'no-store',
          });
          if (!embedResp.ok) continue;
          const embedHtml = await embedResp.text();

          // Try high-fidelity contextJSON parsing
          try {
            const contextMatch = embedHtml.match(/"contextJSON"\s*:\s*"((?:\\.|[^"\\])*)"/);
            if (contextMatch && contextMatch[1]) {
              const rawJson = JSON.parse('"' + contextMatch[1] + '"');
              const parsed = JSON.parse(rawJson);
              const media = parsed?.gql_data?.shortcode_media || parsed?.shortcode_media;
              if (media) {
                if (!viewsCount) {
                  const rawV = media.video_view_count ?? media.video_play_count;
                  if (rawV !== undefined && rawV !== null) viewsCount = formatMetricCount(rawV);
                }
                if (!likesCount && media.edge_liked_by?.count !== undefined && media.edge_liked_by?.count !== null) {
                  likesCount = formatMetricCount(media.edge_liked_by.count);
                }
                if (!commentsCount && media.edge_media_to_comment?.count !== undefined) {
                  commentsCount = String(media.edge_media_to_comment.count);
                }
                if (!thumbnailUrl && media.display_url) {
                  thumbnailUrl = media.display_url;
                }
                if (!author && media.owner?.username) {
                  author = media.owner.username;
                }
                if (!caption) {
                  const capText = media.edge_media_to_caption?.edges?.[0]?.node?.text;
                  if (capText) caption = cleanInstagramCaption(capText, author);
                }
              }
            }
          } catch {}

          if (!author) {
            const aMatch = embedHtml.match(/class="[^"]*UsernameText[^"]*"[^>]*>([^<]+)</i) ||
                           embedHtml.match(/class="[^"]*CaptionUsername[^"]*"[^>]*>([^<]+)</i);
            if (aMatch && aMatch[1]) author = aMatch[1].trim();
          }

          if (!viewsCount) {
            const vMatch = embedHtml.match(/(?:video_view_count|video_play_count|play_count|view_count|ig_play_count)[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                           embedHtml.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:views?|plays?|reels? plays?)\b/i);
            if (vMatch && vMatch[1]) viewsCount = formatMetricCount(vMatch[1]);
          }

          if (!likesCount) {
            const lMatch = embedHtml.match(/edge_liked_by[^0-9:]*:\s*\\*\{[^0-9:]*count[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                           embedHtml.match(/(?:like_count|edge_media_preview_like)[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                           embedHtml.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:likes|like)\b/i);
            if (lMatch && lMatch[1]) likesCount = formatMetricCount(lMatch[1]);
          }

          if (!commentsCount) {
            const cMatch = embedHtml.match(/edge_media_to_comment[^0-9:]*:\s*\\*\{[^0-9:]*count[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                           embedHtml.match(/comment_count[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                           embedHtml.match(/View all ([0-9,]+) comments/i);
            if (cMatch && cMatch[1]) commentsCount = cMatch[1].replace(/,/g, '');
          }

          if (!thumbnailUrl) {
            const imgMatch = embedHtml.match(/class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/i) ||
                             embedHtml.match(/<img[^>]*src="([^"]+scontent[^"]+)"/i);
            if (imgMatch && imgMatch[1]) thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&');
          }

          if (!caption) {
            const cMatch = embedHtml.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
            if (cMatch && cMatch[1]) {
              const rawC = cMatch[1].replace(/<a[^>]*class="[^"]*(?:UsernameText|CaptionUsername)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
                                    .replace(/<a[^>]*href="\/[a-zA-Z0-9._]+\/"[^>]*>[\s\S]*?<\/a>/gi, '')
                                    .replace(/<[^>]+>/g, ' ')
                                    .replace(/\s+/g, ' ')
                                    .trim();
              caption = cleanInstagramCaption(rawC, author);
            }
          }

          if (viewsCount && likesCount && caption && thumbnailUrl) break;
        } catch {}
      }
    }

    // E2. If creatorHandle or targetHandle is known and metrics or thumbnail are still missing, query Business Discovery!
    if (userToken && (!viewsCount || !likesCount || !thumbnailUrl) && (creatorHandle || targetHandle)) {
      const h = creatorHandle || targetHandle;
      if (h) {
        const bdRes = await queryMetaBusinessDiscovery(h, userToken, igUserId, shortcode, cleanUrl);
        if (bdRes?.matched) {
          applyBdResult(bdRes);
        } else if (bdRes?.metaApiError) {
          metaApiError = bdRes.metaApiError;
        }
      }
    }

    const effectiveAuthor = author || creatorHandle || targetHandle;
    if (caption) {
      caption = cleanInstagramCaption(caption, effectiveAuthor);
    }
    if (title && (!caption || title.length < caption.length)) {
      const cleanT = cleanInstagramCaption(title, effectiveAuthor);
      if (cleanT) title = cleanT;
    }

    if (postedDate || caption || author || likesCount || viewsCount || thumbnailUrl) {
      saveCachedVideoMeta(cleanUrl, {
        thumbnailUrl,
        caption,
        likes: likesCount ? formatMetricCount(likesCount) : null,
        views: viewsCount ? formatMetricCount(viewsCount) : null,
      });

      if (thumbnailUrl && shortcode) {
        fetchImageBase64(thumbnailUrl).then((b64) => {
          if (b64) {
            try {
              localStorage.setItem(`trackrr_thumb_b64_sc_${shortcode.toLowerCase()}`, b64);
            } catch {}
          }
        }).catch(() => {});
      }
      let viewsStatus: 'available' | 'hidden_by_creator' | 'requires_user_token' | 'unsupported' = 'unsupported';
      if (viewsCount) {
        viewsStatus = 'available';
      } else if (usedOfficialMetaApi || userToken) {
        viewsStatus = 'hidden_by_creator';
      } else {
        viewsStatus = 'requires_user_token';
      }

      return {
        postedDate,
        postedDateTime,
        title,
        author,
        creatorHandle,
        thumbnailUrl,
        caption,
        viewsCount: viewsCount ? formatMetricCount(viewsCount) : null,
        likesCount: likesCount ? formatMetricCount(likesCount) : null,
        commentsCount: commentsCount || null,
        provider: 'instagram',
        rawHtml,
        usedOfficialMetaApi,
        viewsStatus,
        metaApiError,
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
        if (thumbnailUrl) {
          try { localStorage.setItem(`trackrr_thumb_${cleanUrl}`, thumbnailUrl); } catch {}
        }
        if (title) {
          try { localStorage.setItem(`trackrr_caption_${cleanUrl}`, title); } catch {}
        }
        return {
          title,
          author,
          creatorHandle: author,
          thumbnailUrl,
          caption: title,
          postedDate,
          viewsCount,
          provider: 'youtube',
          viewsStatus: viewsCount ? 'available' : 'unsupported',
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
  viewsCount?: string | number | null;
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
    localStorage.setItem(`trackrr_recent_ig_${clean}`, JSON.stringify(posts.slice(0, 15)));
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
  const updated = [post, ...filtered].slice(0, 10);
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

  const metaToken = credentials?.userToken || credentials?.metaUserToken || getMetaUserToken(credentials);
  const igUserId = getMetaIgUserId(credentials);

  if (metaToken) {
    try {
      const fields = `business_discovery.username(${cleanHandle}){id,name,username,profile_picture_url,media.limit(10){id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,like_count,comments_count,view_count}}`;
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
            likesCount: m.like_count !== undefined ? formatMetricCount(m.like_count) : null,
            commentsCount: m.comments_count !== undefined ? String(m.comments_count) : null,
            viewsCount: m.view_count !== undefined && m.view_count !== null ? formatMetricCount(m.view_count) : null,
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
 * Cleanly extracts formatted likes count from video record, fixing cases where like count was stored in views.
 */
export function extractVideoLikes(video: { views?: string | number | null; likes?: string | number | null }) {
  let rawViews = video.views != null ? String(video.views).trim() : '';
  let rawLikes = video.likes != null ? String(video.likes).trim() : '';

  // If likes was previously mistakenly stored in views (e.g. "105 likes")
  if (rawViews.toLowerCase().includes('like')) {
    if (!rawLikes) {
      rawLikes = rawViews.replace(/likes?/i, '').trim();
    }
    rawViews = '';
  }

  // Clean likes and views through formatMetricCount (which rejects any non-digit string like "M")
  const cleanLikes = rawLikes ? (formatMetricCount(rawLikes.replace(/likes?/i, '').trim()) || null) : null;
  const cleanViews = rawViews ? (formatMetricCount(rawViews.replace(/views?|plays?/i, '').trim()) || null) : null;

  return {
    views: cleanViews,
    likes: cleanLikes,
  };
}

export const extractViewsAndLikes = extractVideoLikes;
