// Trackrr Chrome Extension - Background Service Worker v1.1.0
// Extracts high-resolution thumbnails, live metrics, and captions anonymously
// ZERO USER COOKIES / ANTI-BAN ISOLATED MODE:
// All requests are completely unauthenticated guest fetches with credentials omitted and cookies stripped.

// 1. Initialize Network-Level Cookie Stripping (declarativeNetRequest)
async function initCookieStrippingRules() {
  try {
    if (chrome?.declarativeNetRequest?.updateDynamicRules) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001],
        addRules: [
          {
            id: 1001,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'cookie', operation: 'remove' },
                { header: 'authorization', operation: 'remove' },
                { header: 'x-csrftoken', operation: 'remove' },
                { header: 'sec-ch-ua', operation: 'remove' }
              ]
            },
            condition: {
              urlFilter: '||instagram.com',
              resourceTypes: ['xmlhttprequest', 'sub_frame', 'other']
            }
          }
        ]
      });
      console.log('[Trackrr] Network cookie-stripping rules active. Zero personal session cookies will be sent to Instagram.');
    }
  } catch (err) {
    console.warn('[Trackrr] declarativeNetRequest configuration note:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initCookieStrippingRules();
});
initCookieStrippingRules();

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
  if (!str || !/\d/.test(str)) return null;

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
    const response = await fetch(imageUrl, {
      credentials: 'omit',
      cache: 'no-store'
    });
    if (!response.ok) return imageUrl;
    const blob = await response.blob();
    if (typeof FileReader !== 'undefined') {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(typeof reader.result === 'string' ? reader.result : imageUrl);
        };
        reader.onerror = () => resolve(imageUrl);
        reader.readAsDataURL(blob);
      });
    }
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return 'data:' + (blob.type || 'image/jpeg') + ';base64,' + b64;
  } catch {
    return imageUrl;
  }
}

function shortcodeToMediaId(shortcode) {
  if (!shortcode) return null;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = BigInt(0);
  for (let i = 0; i < shortcode.length; i++) {
    const val = BigInt(alphabet.indexOf(shortcode[i]));
    if (val === BigInt(-1)) return null;
    id = id * BigInt(64) + val;
  }
  return id.toString();
}

function extractEmbedData(embedHtml) {
  let media = null;
  try {
    const contextMatch = embedHtml.match(/"contextJSON"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (contextMatch && contextMatch[1]) {
      const rawJson = JSON.parse('"' + contextMatch[1] + '"');
      const parsed = JSON.parse(rawJson);
      media = parsed?.gql_data?.shortcode_media || parsed?.shortcode_media;
    }
  } catch (e) {
    console.warn('Failed to parse contextJSON:', e);
  }
  return media;
}

// Anonymous Guest Extractor (Zero account links, zero session cookies)
async function fetchInstagramMetadata(rawUrl) {
  const shortcode = extractShortcode(rawUrl);
  if (!shortcode) {
    return { error: 'Invalid Instagram URL. Could not detect shortcode.' };
  }

  const mediaId = shortcodeToMediaId(shortcode);
  const d = extractDateFromShortcode(shortcode);
  let postedDate = d ? d.toISOString().slice(0, 10) : null;
  let postedDateTime = d ? d.toISOString() : null;
  let thumbnailUrl = null;
  let caption = null;
  let likesCount = null;
  let viewsCount = null;
  let commentsCount = null;
  let author = null;

  // --- Strategy 1: Public Embed Captioned Scraping (Pure Anonymous Guest) ---
  // Instagram's official unauthenticated public embed endpoint designed for third-party embeds
  const embedUrls = [
    'https://www.instagram.com/p/' + shortcode + '/embed/captioned/?_fb_noscript=1',
    'https://www.instagram.com/reel/' + shortcode + '/embed/captioned/?_fb_noscript=1'
  ];

  for (const embedUrl of embedUrls) {
    try {
      const embedResp = await fetch(embedUrl, {
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'navigate'
        }
      });
      if (!embedResp.ok) continue;
      const html = await embedResp.text();

      const media = extractEmbedData(html);
      if (media) {
        if (media.owner?.username) author = media.owner.username;
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
        if (!caption) {
          const capText = media.edge_media_to_caption?.edges?.[0]?.node?.text;
          if (capText) caption = cleanInstagramCaption(capText, author);
        }
        if (media.taken_at_timestamp) {
          const dt = new Date(media.taken_at_timestamp * 1000);
          postedDate = dt.toISOString().slice(0, 10);
          postedDateTime = dt.toISOString();
        }
      }

      // Regex fallbacks supporting escaped quotes / backslashes
      if (!author) {
        const authorMatch = html.match(/class="[^"]*UsernameText[^"]*"[^>]*>([^<]+)</i) ||
                            html.match(/class="[^"]*CaptionUsername[^"]*"[^>]*>([^<]+)</i);
        if (authorMatch && authorMatch[1]) author = authorMatch[1].trim();
      }

      if (!viewsCount) {
        const vMatch = html.match(/(?:video_view_count|video_play_count|play_count|view_count|ig_play_count)[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                       html.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:views?|plays?|reels? plays?)\b/i);
        if (vMatch && vMatch[1]) viewsCount = formatMetricCount(vMatch[1]);
      }

      if (!likesCount) {
        const lMatch = html.match(/edge_liked_by[^0-9:]*:\s*\\*\{[^0-9:]*count[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                       html.match(/(?:like_count|edge_media_preview_like)[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                       html.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:likes|like)\b/i);
        if (lMatch && lMatch[1]) likesCount = formatMetricCount(lMatch[1]);
      }

      if (!commentsCount) {
        const cMatch = html.match(/edge_media_to_comment[^0-9:]*:\s*\\*\{[^0-9:]*count[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                       html.match(/comment_count[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                       html.match(/View all ([0-9,]+) comments/i);
        if (cMatch && cMatch[1]) commentsCount = cMatch[1].replace(/,/g, '');
      }

      if (!thumbnailUrl) {
        const imgMatch = html.match(/class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/i) ||
                         html.match(/<img[^>]*src="([^"]+scontent[^"]+)"/i);
        if (imgMatch && imgMatch[1]) thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&');
      }

      if (!caption) {
        const captionMatch = html.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (captionMatch && captionMatch[1]) caption = cleanInstagramCaption(captionMatch[1], author);
      }

      if (!postedDateTime) {
        const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/i);
        if (timeMatch && timeMatch[1]) {
          postedDateTime = timeMatch[1];
          postedDate = timeMatch[1].split('T')[0];
        }
      }

      if (viewsCount && likesCount && caption && thumbnailUrl) break;
    } catch (e) {
      console.warn('[Trackrr] Strategy 1 Embed error:', e);
    }
  }

  // --- Strategy 2: Anonymous Public Guest Page Scraping (OpenGraph & Meta tags) ---
  if (!thumbnailUrl || !caption || !likesCount || !viewsCount) {
    const pageUrls = [
      'https://www.instagram.com/reel/' + shortcode + '/',
      'https://www.instagram.com/p/' + shortcode + '/'
    ];

    for (const pageUrl of pageUrls) {
      try {
        const pageResp = await fetch(pageUrl, {
          credentials: 'omit',
          cache: 'no-store',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-Mode': 'navigate'
          }
        });
        if (!pageResp.ok) continue;
        const pageHtml = await pageResp.text();

        if (!thumbnailUrl) {
          const ogImg = pageHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        pageHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          if (ogImg && ogImg[1]) thumbnailUrl = ogImg[1].replace(/&amp;/g, '&');
        }

        const ogDesc = pageHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                       pageHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
        if (ogDesc && ogDesc[1]) {
          const cleanDesc = ogDesc[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
          if (!likesCount) {
            const descLikes = cleanDesc.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:likes|like)\b/i);
            if (descLikes && descLikes[1]) likesCount = formatMetricCount(descLikes[1]);
          }
          if (!viewsCount) {
            const descViews = cleanDesc.match(/(?:^|[^\w])([0-9][0-9,.]*\s*[KkMmBb]?)\s*(?:views?|plays?|reels? plays?)\b/i);
            if (descViews && descViews[1]) viewsCount = formatMetricCount(descViews[1]);
          }
          if (!caption) {
            const colonIdx = cleanDesc.indexOf(':');
            const rawDescCap = colonIdx !== -1 ? cleanDesc.slice(colonIdx + 1).trim() : cleanDesc;
            caption = cleanInstagramCaption(rawDescCap, author);
          }
        }

        if (thumbnailUrl && caption && likesCount && viewsCount) break;
      } catch (e) {
        console.warn('[Trackrr] Strategy 2 Guest Page error:', e);
      }
    }
  }

  // Final caption cleanup
  if (caption) {
    caption = cleanInstagramCaption(caption, author);
  }

  // Convert thumbnail to clean Base64 data URL so Trackrr has no CORS restrictions
  let base64Thumbnail = null;
  if (thumbnailUrl) {
    base64Thumbnail = await convertImageToBase64(thumbnailUrl);
  }

  const finalResult = {
    success: true,
    provider: 'instagram',
    url: rawUrl,
    shortcode: shortcode,
    mediaId: mediaId,
    postedDate: postedDate,
    postedDateTime: postedDateTime,
    likesCount: likesCount,
    viewsCount: viewsCount,
    commentsCount: commentsCount,
    caption: caption,
    author: author,
    thumbnailUrl: base64Thumbnail || thumbnailUrl,
    source: 'chrome_extension_anonymous'
  };

  // Broadcast to open Trackrr tabs so cards live-update in real time
  broadcastMetadataToTabs(finalResult);

  return finalResult;
}

function broadcastMetadataToTabs(res) {
  if (!res || !res.shortcode) return;
  try {
    chrome.tabs.query({}, (tabs) => {
      if (!tabs) return;
      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          chrome.tabs.sendMessage(tab.id, {
            action: 'TRACKRR_METADATA_BROADCAST',
            data: res
          }).catch(() => {});
        } catch {}
      }
    });
  } catch {}
}

// Request rate limiter / anti-flood queue
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 250;

// Message Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_IG_METADATA') {
    const now = Date.now();
    const waitTime = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now - lastRequestTime));
    lastRequestTime = now + waitTime;

    setTimeout(() => {
      fetchInstagramMetadata(request.url).then((res) => {
        sendResponse(res);
      }).catch((err) => {
        sendResponse({ error: err.message || 'Failed to fetch Instagram metadata' });
      });
    }, waitTime);

    return true; // Keep channel open for async sendResponse
  }

  if (request.action === 'BROADCAST_METADATA') {
    broadcastMetadataToTabs(request.data);
    sendResponse({ success: true });
    return false;
  }
});
