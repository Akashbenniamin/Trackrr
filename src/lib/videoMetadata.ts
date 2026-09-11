export interface VideoMetadataResult {
  postedDate?: string | null;
  postedDateTime?: string | null;
  title?: string;
  author?: string;
  creatorHandle?: string;
  thumbnailUrl?: string;
  likesCount?: string | null;
  commentsCount?: string | null;
  caption?: string | null;
  provider: 'instagram' | 'youtube' | 'other';
  rawHtml?: string;
  error?: string;
  usedOfficialMetaApi?: boolean;
}

export interface MetaApiCredentials {
  metaAppId?: string;
  metaClientToken?: string;
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
 * Parse Instagram description string into likes, comments, creator handle, date, and clean caption.
 * Format: "122 likes, 0 comments - leoholidays.in on July 22, 2026: “Every Tamil festival...”"
 */
export function parseInstagramDescription(text?: string | null) {
  if (!text) return {};

  const likesMatch = text.match(/([\d,KMkm.]+)\s+likes/i);
  const likesCount = likesMatch ? likesMatch[1] : null;

  const commentsMatch = text.match(/([\d,KMkm.]+)\s+comments/i);
  const commentsCount = commentsMatch ? commentsMatch[1] : null;

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

  return { likesCount, commentsCount, creatorHandle, dateStr, caption };
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

  // --- 1. INSTAGRAM (Meta Official oEmbed API) ---
  if (provider === 'instagram') {
    const metaToken = getMetaAccessToken(credentials);

    if (metaToken) {
      try {
        const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(cleanUrl)}&access_token=${metaToken}`;
        const response = await fetch(oembedUrl);

        if (response.ok) {
          const data = await response.json();
          let postedDate: string | null = null;
          let postedDateTime: string | null = null;

          // Parse <time datetime="..."> inside the oEmbed blockquote
          if (data.html) {
            const timeMatch = data.html.match(/<time[^>]*datetime="([^"]+)"/i);
            if (timeMatch && timeMatch[1]) {
              const matchedStr = timeMatch[1];
              postedDateTime = matchedStr;
              postedDate = matchedStr.split('T')[0];
            }
          }

          return {
            postedDate,
            postedDateTime,
            title: data.title || undefined,
            author: data.author_name || undefined,
            creatorHandle: data.author_name || undefined,
            thumbnailUrl: data.thumbnail_url || undefined,
            caption: data.title || undefined,
            provider: 'instagram',
            rawHtml: data.html,
            usedOfficialMetaApi: true,
          };
        }

        const errData = await response.json().catch(() => ({}));
        console.warn('Meta oEmbed API error:', errData);
      } catch (err) {
        console.warn('Network error calling Meta oEmbed API:', err);
      }
    }

    // Fallback: Free public metadata service (Microlink) if Meta token is missing, pending review, or failed
    try {
      const fallbackUrl = `https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}`;
      const fbResponse = await fetch(fallbackUrl);
      if (fbResponse.ok) {
        const fbData = await fbResponse.json();
        const d = fbData?.data;
        const descText = d?.description || d?.title || '';
        const parsed = parseInstagramDescription(descText);

        let pDate: string | null = null;
        if (d?.date) {
          pDate = String(d.date).split('T')[0];
        } else if (parsed.dateStr) {
          const parsedD = new Date(parsed.dateStr);
          if (!isNaN(parsedD.getTime())) {
            pDate = parsedD.toISOString().slice(0, 10);
          }
        }

        if (pDate || parsed.caption || d?.author) {
          return {
            postedDate: pDate,
            postedDateTime: d?.date || null,
            title: d?.title || (parsed.caption ? parsed.caption.slice(0, 80) : undefined),
            author: d?.author || d?.publisher || undefined,
            creatorHandle: parsed.creatorHandle || d?.author || undefined,
            thumbnailUrl: d?.image?.url || undefined,
            likesCount: parsed.likesCount || null,
            commentsCount: parsed.commentsCount || null,
            caption: parsed.caption || d?.description || null,
            provider: 'instagram',
            usedOfficialMetaApi: false,
          };
        }
      }
    } catch (err) {
      console.warn('Fallback resolver error:', err);
    }

    return {
      provider: 'instagram',
      error: 'Could not extract metadata from this Instagram URL. Please verify the post or reel is public.',
    };
  }

  // --- 2. YOUTUBE (Open oEmbed API) ---
  if (provider === 'youtube') {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
      const response = await fetch(oembedUrl);

      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title || undefined,
          author: data.author_name || undefined,
          creatorHandle: data.author_name || undefined,
          thumbnailUrl: data.thumbnail_url || undefined,
          caption: data.title || undefined,
          provider: 'youtube',
          rawHtml: data.html,
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
