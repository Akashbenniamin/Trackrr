// Trackrr Chrome Extension - Background Service Worker
// Extracts high-resolution thumbnails, live likes, and captions using authenticated browser session.

function extractShortcode(url) {
  if (!url) return null;
  const m = url.match(/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/i);
  return m ? m[1] : null;
}

function extractDateFromShortcode(shortcode) {
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

function formatMetricCount(val) {
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
    const f = (num / 1_000_000_000).toFixed(1);
    return f.endsWith('.0') ? f.slice(0, -2) + 'B' : f + 'B';
  }
  if (num >= 1_000_000) {
    const f = (num / 1_000_000).toFixed(1);
    return f.endsWith('.0') ? f.slice(0, -2) + 'M' : f + 'M';
  }
  if (num >= 1_000) {
    const f = (num / 1_000).toFixed(1);
    return f.endsWith('.0') ? f.slice(0, -2) + 'K' : f + 'K';
  }
  return String(num);
}

function cleanInstagramCaption(rawCaption, author) {
  if (!rawCaption) return null;
  let text = String(rawCaption);

  // Strip HTML anchors for usernames first if present
  text = text.replace(/<a[^>]*class="[^"]*(?:UsernameText|CaptionUsername)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
  text = text.replace(/<a[^>]*href="\/[a-zA-Z0-9._]+\/"[^>]*>[\s\S]*?<\/a>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
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

  // 3. If author/creatorHandle is known, strip it from the start
  if (author && author.trim()) {
    const cleanAuthor = author.replace(/^@/, '').trim();
    if (cleanAuthor) {
      const authorRegex = new RegExp(`^@?${cleanAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：\\-–—]?\\s*`, 'i');
      text = text.replace(authorRegex, '');
    }
  }

  // 4. Strip any username prefix with colon or hyphen
  text = text.replace(/^@?[a-zA-Z0-9._]{2,30}\s*[:：\-–—]\s*/, '');

  // 5. Strip username handles starting with @ followed by space
  text = text.replace(/^@[a-zA-Z0-9._]{2,30}\s+/, '');

  // 6. Strip domain-like or dotted/underscored handle at start
  text = text.replace(/^[a-zA-Z0-9_-]*[._][a-zA-Z0-9._-]+\s+/, '');

  // 7. Strip surrounding quotes (curly or straight)
  text = text.replace(/^[“\"'«\s]+|[”\"'»\s]+$/g, '').trim();

  if (!text || /^on\s+Instagram$/i.test(text)) {
    return null;
  }

  return text;
}

async function convertImageToBase64(imageUrl) {
  if (!imageUrl) return null;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return imageUrl;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : imageUrl);
      };
      reader.onerror = () => resolve(imageUrl);
      reader.readAsDataURL(blob);
    });
  } catch {
    return imageUrl;
  }
}

async function fetchInstagramMetadata(rawUrl) {
  const shortcode = extractShortcode(rawUrl);
  if (!shortcode) {
    return { error: 'Invalid Instagram URL. Could not detect shortcode.' };
  }

  const d = extractDateFromShortcode(shortcode);
  let postedDate = d ? d.toISOString().slice(0, 10) : null;
  let postedDateTime = d ? d.toISOString() : null;
  let thumbnailUrl = null;
  let caption = null;
  let likesCount = null;
  let viewsCount = null;
  let commentsCount = null;
  let author = null;

  // Strategy 1: Instagram internal web query with browser cookies
  try {
    const jsonUrl = 'https://www.instagram.com/p/' + shortcode + '/?__a=1&__d=dis';
    const resp = await fetch(jsonUrl, {
      credentials: 'include',
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': '*/*'
      }
    });

    if (resp.ok) {
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await resp.json();
        const item = json?.items?.[0] || json?.graphql?.shortcode_media || json?.data?.xdt_shortcode_media || json?.data?.shortcode_media;
        if (item) {
          if (item.user?.username) author = item.user.username;
          else if (item.owner?.username) author = item.owner.username;

          const rawText = item.caption?.text || item.edge_media_to_caption?.edges?.[0]?.node?.text;
          if (rawText) caption = cleanInstagramCaption(rawText, author);

          const rawLikes = item.like_count ?? item.edge_media_preview_like?.count ?? item.edge_liked_by?.count;
          if (rawLikes !== undefined && rawLikes !== null) {
            likesCount = formatMetricCount(rawLikes);
          }

          const rawViews = item.play_count ?? item.video_play_count ?? item.view_count ?? item.video_view_count ?? item.ig_play_count ?? item.clips_metadata?.video_play_count ?? item.clips_metadata?.play_count;
          if (rawViews !== undefined && rawViews !== null) {
            viewsCount = formatMetricCount(rawViews);
          }

          if (item.comment_count !== undefined) commentsCount = String(item.comment_count);
          else if (item.edge_media_to_comment?.count !== undefined) commentsCount = String(item.edge_media_to_comment.count);

          if (item.taken_at) {
            const dt = new Date(item.taken_at * 1000);
            postedDate = dt.toISOString().slice(0, 10);
            postedDateTime = dt.toISOString();
          } else if (item.taken_at_timestamp) {
            const dt = new Date(item.taken_at_timestamp * 1000);
            postedDate = dt.toISOString().slice(0, 10);
            postedDateTime = dt.toISOString();
          }

          // Best image candidate
          const candidates = item.image_versions2?.candidates || [];
          if (candidates.length > 0) {
            thumbnailUrl = candidates[0].url;
          } else if (item.display_url) {
            thumbnailUrl = item.display_url;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Strategy 1 error:', e);
  }

  // Strategy 2: Embed captioned HTML fallback (bypasses noscript redirect)
  if (!thumbnailUrl || !caption || !likesCount || !viewsCount) {
    try {
      const embedUrl = 'https://www.instagram.com/p/' + shortcode + '/embed/captioned/?_fb_noscript=1';
      const embedResp = await fetch(embedUrl, { credentials: 'include' });
      if (embedResp.ok) {
        const html = await embedResp.text();

        // Extract author first so it can be passed to caption cleaner
        if (!author) {
          const authorMatch = html.match(/class="[^"]*UsernameText[^"]*"[^>]*>([^<]+)</i) ||
                              html.match(/class="[^"]*CaptionUsername[^"]*"[^>]*>([^<]+)</i);
          if (authorMatch && authorMatch[1]) {
            author = authorMatch[1].trim();
          }
        }

        // Extract thumbnail image from embed
        if (!thumbnailUrl) {
          const imgMatch = html.match(/class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/i) ||
                           html.match(/<img[^>]*src="([^"]+scontent[^"]+)"/i);
          if (imgMatch && imgMatch[1]) {
            thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&');
          }
        }

        // Extract likes strictly requiring digits
        if (!likesCount) {
          const likeMatch = html.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:likes|like)\b/i) ||
                            html.match(/"(?:like_count|edge_media_preview_like)":\s*(?:\{"count":\s*)?["']?(\d+)["']?/i);
          if (likeMatch && likeMatch[1]) {
            likesCount = formatMetricCount(likeMatch[1]);
          }
        }

        // Extract views from script tags or text
        if (!viewsCount) {
          const viewScriptMatch = html.match(/"(?:video_play_count|video_view_count|play_count|view_count|ig_play_count)":\s*["']?(\d+)["']?/i) ||
                                  html.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:views?|plays?|reels? plays?)\b/i);
          if (viewScriptMatch && viewScriptMatch[1]) {
            viewsCount = formatMetricCount(viewScriptMatch[1]);
          }
        }

        // Extract caption
        if (!caption) {
          const captionMatch = html.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
          if (captionMatch && captionMatch[1]) {
            caption = cleanInstagramCaption(captionMatch[1], author);
          }
        }

        // Extract time
        if (!postedDateTime) {
          const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/i);
          if (timeMatch && timeMatch[1]) {
            postedDateTime = timeMatch[1];
            postedDate = timeMatch[1].split('T')[0];
          }
        }
      }
    } catch (e) {
      console.warn('Strategy 2 error:', e);
    }
  }

  // Strategy 3: Standard page OpenGraph & JSON fallback
  if (!thumbnailUrl || !caption || !likesCount || !viewsCount) {
    try {
      const pageUrl = 'https://www.instagram.com/reel/' + shortcode + '/';
      const pageResp = await fetch(pageUrl, { credentials: 'include' });
      if (pageResp.ok) {
        const pageHtml = await pageResp.text();
        if (!thumbnailUrl) {
          const ogImg = pageHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        pageHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          if (ogImg && ogImg[1]) {
            thumbnailUrl = ogImg[1].replace(/&amp;/g, '&');
          }
        }
        if (!caption || !likesCount || !viewsCount) {
          const ogDesc = pageHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                         pageHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
          if (ogDesc && ogDesc[1]) {
            const cleanDesc = ogDesc[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
            if (!likesCount) {
              const descLikes = cleanDesc.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:likes|like)\b/i);
              if (descLikes && descLikes[1]) {
                likesCount = formatMetricCount(descLikes[1]);
              }
            }
            if (!viewsCount) {
              const descViews = cleanDesc.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:views?|plays?|reels? plays?)\b/i);
              if (descViews && descViews[1]) {
                viewsCount = formatMetricCount(descViews[1]);
              }
            }
            if (!caption) {
              const colonIdx = cleanDesc.indexOf(':');
              const rawDescCap = colonIdx !== -1 ? cleanDesc.slice(colonIdx + 1).trim() : cleanDesc;
              caption = cleanInstagramCaption(rawDescCap, author);
            }
          }
        }

        // Script JSON checks
        if (!viewsCount) {
          const pageViewMatch = pageHtml.match(/"(?:video_play_count|video_view_count|play_count|view_count|ig_play_count)":\s*["']?(\d+)["']?/i);
          if (pageViewMatch && pageViewMatch[1]) {
            viewsCount = formatMetricCount(pageViewMatch[1]);
          }
        }
        if (!likesCount) {
          const pageLikeMatch = pageHtml.match(/"(?:like_count|edge_media_preview_like)":\s*\{"count":\s*(\d+)/i) ||
                                pageHtml.match(/"like_count":\s*(\d+)/i);
          if (pageLikeMatch && pageLikeMatch[1]) {
            likesCount = formatMetricCount(pageLikeMatch[1]);
          }
        }
      }
    } catch (e) {
      console.warn('Strategy 3 error:', e);
    }
  }

  // Ensure caption is cleaned
  if (caption) {
    caption = cleanInstagramCaption(caption, author);
  }

  // Convert thumbnail to clean Base64 data URL so Trackrr has no CORS restrictions
  let base64Thumbnail = null;
  if (thumbnailUrl) {
    base64Thumbnail = await convertImageToBase64(thumbnailUrl);
  }

  return {
    success: true,
    provider: 'instagram',
    shortcode: shortcode,
    postedDate: postedDate,
    postedDateTime: postedDateTime,
    likesCount: likesCount,
    viewsCount: viewsCount,
    commentsCount: commentsCount,
    caption: caption,
    author: author,
    thumbnailUrl: base64Thumbnail || thumbnailUrl,
    source: 'chrome_extension'
  };
}

// Message Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_IG_METADATA') {
    fetchInstagramMetadata(request.url).then((res) => {
      sendResponse(res);
    }).catch((err) => {
      sendResponse({ error: err.message || 'Failed to fetch Instagram metadata' });
    });
    return true; // Keep channel open for async sendResponse
  }
});
