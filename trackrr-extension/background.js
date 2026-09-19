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

  // Strategy 1: High-fidelity Embed Captioned scraping (Instagram Embed API)
  // Bypasses login walls and directly includes contextJSON with live video_view_count, likes, clean caption, author
  const embedUrls = [
    'https://www.instagram.com/p/' + shortcode + '/embed/captioned/?_fb_noscript=1',
    'https://www.instagram.com/reel/' + shortcode + '/embed/captioned/?_fb_noscript=1'
  ];

  for (const embedUrl of embedUrls) {
    try {
      const embedResp = await fetch(embedUrl, { credentials: 'include' });
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
      console.warn('Strategy 1 Embed error:', e);
    }
  }

  // Strategy 2: Instagram GraphQL Query via PolarisPostRootQuery
  if (!viewsCount || !likesCount || !caption || !thumbnailUrl) {
    try {
      let csrfToken = '';
      try {
        const cookie = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'csrftoken' });
        if (cookie?.value) csrfToken = cookie.value;
      } catch {}

      const docIds = ['26130443479876713', '27128499623469141', '8845758582119845'];
      for (const docId of docIds) {
        try {
          const params = new URLSearchParams({
            av: '0',
            __d: 'www',
            __user: '0',
            __a: '1',
            __req: '1',
            dpr: '1',
            fb_api_caller_class: 'RelayModern',
            fb_api_req_friendly_name: 'PolarisPostRootQuery',
            variables: JSON.stringify({ shortcode }),
            doc_id: docId,
          });

          const gResp = await fetch('https://www.instagram.com/graphql/query', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-CSRFToken': csrfToken,
              'X-IG-App-ID': '936619743392459',
              'X-FB-Friendly-Name': 'PolarisPostRootQuery',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: params.toString(),
          });

          if (gResp.ok) {
            const gData = await gResp.json();
            const item = gData?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0] ||
                         gData?.data?.xdt_shortcode_media ||
                         gData?.data?.shortcode_media;
            if (item) {
              if (!author) author = item.user?.username || item.owner?.username;
              if (!viewsCount) {
                const rawV = item.video_view_count ?? item.video_play_count ?? item.view_count ?? item.play_count;
                if (rawV !== undefined && rawV !== null) viewsCount = formatMetricCount(rawV);
              }
              if (!likesCount) {
                const rawL = item.like_count ?? item.edge_media_preview_like?.count ?? item.edge_liked_by?.count;
                if (rawL !== undefined && rawL !== null) likesCount = formatMetricCount(rawL);
              }
              if (!commentsCount) {
                const rawC = item.comment_count ?? item.edge_media_to_comment?.count;
                if (rawC !== undefined) commentsCount = String(rawC);
              }
              if (!thumbnailUrl) {
                const candidates = item.image_versions2?.candidates || [];
                thumbnailUrl = candidates[0]?.url || item.display_url;
              }
              if (!caption) {
                const rawCap = item.caption?.text || item.edge_media_to_caption?.edges?.[0]?.node?.text;
                if (rawCap) caption = cleanInstagramCaption(rawCap, author);
              }
              if (item.taken_at || item.taken_at_timestamp) {
                const ts = (item.taken_at || item.taken_at_timestamp) * 1000;
                const dt = new Date(ts);
                postedDate = dt.toISOString().slice(0, 10);
                postedDateTime = dt.toISOString();
              }
              break;
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Strategy 2 GraphQL error:', e);
    }
  }

  // Strategy 3: Internal web query (?__a=1&__d=dis or /api/v1/media/${mediaId}/info/)
  if (!viewsCount || !likesCount || !caption || !thumbnailUrl) {
    try {
      const endpoints = [
        'https://www.instagram.com/p/' + shortcode + '/?__a=1&__d=dis',
        mediaId ? ('https://www.instagram.com/api/v1/media/' + mediaId + '/info/') : null
      ].filter(Boolean);

      for (const ep of endpoints) {
        try {
          const resp = await fetch(ep, {
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
              const item = json?.items?.[0] || json?.graphql?.shortcode_media || json?.data?.xdt_shortcode_media;
              if (item) {
                if (!author) author = item.user?.username || item.owner?.username;
                if (!viewsCount) {
                  const rawV = item.video_view_count ?? item.video_play_count ?? item.view_count ?? item.play_count ?? item.clips_metadata?.video_play_count ?? item.clips_metadata?.play_count;
                  if (rawV !== undefined && rawV !== null) viewsCount = formatMetricCount(rawV);
                }
                if (!likesCount) {
                  const rawL = item.like_count ?? item.edge_media_preview_like?.count ?? item.edge_liked_by?.count;
                  if (rawL !== undefined && rawL !== null) likesCount = formatMetricCount(rawL);
                }
                if (!commentsCount) {
                  const rawC = item.comment_count ?? item.edge_media_to_comment?.count;
                  if (rawC !== undefined) commentsCount = String(rawC);
                }
                if (!thumbnailUrl) {
                  const candidates = item.image_versions2?.candidates || [];
                  thumbnailUrl = candidates[0]?.url || item.display_url;
                }
                if (!caption) {
                  const rawCap = item.caption?.text || item.edge_media_to_caption?.edges?.[0]?.node?.text;
                  if (rawCap) caption = cleanInstagramCaption(rawCap, author);
                }
                break;
              }
            }
          }
        } catch {}
      }
    } catch (e) {
      console.warn('Strategy 3 error:', e);
    }
  }

  // Strategy 4: Profile timeline query (web_profile_info) if author is known
  if (!viewsCount && author) {
    try {
      const profUrl = 'https://www.instagram.com/api/v1/users/web_profile_info/?username=' + author;
      const profResp = await fetch(profUrl, {
        credentials: 'include',
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': '*/*'
        }
      });
      if (profResp.ok) {
        const profData = await profResp.json();
        const user = profData?.data?.user;
        const timelineEdges = user?.edge_owner_to_timeline_media?.edges || [];
        const videoEdges = user?.edge_felix_video_timeline?.edges || [];
        const allEdges = [...timelineEdges, ...videoEdges];

        const matchEdge = allEdges.find(e => e?.node?.shortcode === shortcode || e?.node?.id === mediaId);
        if (matchEdge?.node) {
          const node = matchEdge.node;
          const rawV = node.video_view_count ?? node.video_play_count;
          if (rawV !== undefined && rawV !== null) viewsCount = formatMetricCount(rawV);
          if (!likesCount && node.edge_liked_by?.count !== undefined) likesCount = formatMetricCount(node.edge_liked_by.count);
          if (!commentsCount && node.edge_media_to_comment?.count !== undefined) commentsCount = String(node.edge_media_to_comment.count);
          if (!thumbnailUrl && node.display_url) thumbnailUrl = node.display_url;
          if (!caption) {
            const rawCap = node.edge_media_to_caption?.edges?.[0]?.node?.text;
            if (rawCap) caption = cleanInstagramCaption(rawCap, author);
          }
        }
      }
    } catch (e) {
      console.warn('Strategy 4 error:', e);
    }
  }

  // Strategy 5: Standard page HTML & OpenGraph fallback
  if (!thumbnailUrl || !caption || !likesCount || !viewsCount) {
    try {
      const pageUrl = 'https://www.instagram.com/reel/' + shortcode + '/';
      const pageResp = await fetch(pageUrl, { credentials: 'include' });
      if (pageResp.ok) {
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

        if (!viewsCount) {
          const pageViewMatch = pageHtml.match(/(?:video_view_count|video_play_count|play_count|view_count|ig_play_count)[^0-9:]*:\s*\\*["']?(\d+)/i);
          if (pageViewMatch && pageViewMatch[1]) viewsCount = formatMetricCount(pageViewMatch[1]);
        }
        if (!likesCount) {
          const pageLikeMatch = pageHtml.match(/edge_liked_by[^0-9:]*:\s*\\*\{[^0-9:]*count[^0-9:]*:\s*\\*["']?(\d+)/i) ||
                                pageHtml.match(/(?:like_count|edge_media_preview_like)[^0-9:]*:\s*\\*["']?(\d+)/i);
          if (pageLikeMatch && pageLikeMatch[1]) likesCount = formatMetricCount(pageLikeMatch[1]);
        }
      }
    } catch (e) {
      console.warn('Strategy 5 error:', e);
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

  return {
    success: true,
    provider: 'instagram',
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
