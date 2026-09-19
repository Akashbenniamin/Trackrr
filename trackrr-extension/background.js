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
  const str = String(val).trim();
  if (!str) return null;
  if (/[kKmMbB]/.test(str)) return str.toUpperCase();
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return str;
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
  let commentsCount = null;
  let author = null;

  // Strategy 1: Instagram internal web query with browser cookies
  try {
    const jsonUrl = 'https://www.instagram.com/p/' + shortcode + '/?__a=1&__d=dis';
    const resp = await fetch(jsonUrl, {
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
        const item = json?.items?.[0] || json?.graphql?.shortcode_media;
        if (item) {
          if (item.caption?.text) caption = item.caption.text;
          if (item.like_count !== undefined) likesCount = formatMetricCount(item.like_count);
          if (item.comment_count !== undefined) commentsCount = String(item.comment_count);
          if (item.user?.username) author = item.user.username;
          if (item.taken_at) {
            const dt = new Date(item.taken_at * 1000);
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

  // Strategy 2: Embed captioned HTML fallback
  if (!thumbnailUrl || !caption || !likesCount) {
    try {
      const embedUrl = 'https://www.instagram.com/p/' + shortcode + '/embed/captioned/';
      const embedResp = await fetch(embedUrl);
      if (embedResp.ok) {
        const html = await embedResp.text();

        // Extract thumbnail image from embed
        if (!thumbnailUrl) {
          const imgMatch = html.match(/class="[^"]*EmbeddedMediaImage[^"]*"[^>]*src="([^"]+)"/i) ||
                           html.match(/<img[^>]*src="([^"]+scontent[^"]+)"/i);
          if (imgMatch && imgMatch[1]) {
            thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&');
          }
        }

        // Extract likes
        if (!likesCount) {
          const likeMatch = html.match(/([0-9,KMkm.]+)\s*(?:likes|like)/i);
          if (likeMatch && likeMatch[1]) {
            likesCount = formatMetricCount(likeMatch[1]);
          }
        }

        // Extract caption
        if (!caption) {
          const captionMatch = html.match(/class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
          if (captionMatch && captionMatch[1]) {
            caption = captionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        }

        // Extract author
        if (!author) {
          const authorMatch = html.match(/class="[^"]*UsernameText[^"]*"[^>]*>([^<]+)</i);
          if (authorMatch && authorMatch[1]) {
            author = authorMatch[1].trim();
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

  // Strategy 3: Standard page OpenGraph fallback
  if (!thumbnailUrl || !caption) {
    try {
      const pageUrl = 'https://www.instagram.com/reel/' + shortcode + '/';
      const pageResp = await fetch(pageUrl);
      if (pageResp.ok) {
        const pageHtml = await pageResp.text();
        if (!thumbnailUrl) {
          const ogImg = pageHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        pageHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
          if (ogImg && ogImg[1]) {
            thumbnailUrl = ogImg[1].replace(/&amp;/g, '&');
          }
        }
        if (!caption) {
          const ogDesc = pageHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                         pageHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
          if (ogDesc && ogDesc[1]) {
            const cleanDesc = ogDesc[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
            const descLikes = cleanDesc.match(/([0-9,KMkm.]+)\s+likes/i);
            if (!likesCount && descLikes && descLikes[1]) {
              likesCount = formatMetricCount(descLikes[1]);
            }
            const colonIdx = cleanDesc.indexOf(':');
            caption = colonIdx !== -1 ? cleanDesc.slice(colonIdx + 1).trim() : cleanDesc;
          }
        }
      }
    } catch (e) {
      console.warn('Strategy 3 error:', e);
    }
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
