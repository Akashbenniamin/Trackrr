import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://tdedvipgmafivbecfcpo.supabase.co';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZWR2aXBnbWFmaXZiZWNmY3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MjA0MzksImV4cCI6MjEwNDE5NjQzOX0.Jxp2NwooiTn0CgCZdfcrQ6TBr_WNyTtHrAAEE-Iy1aA';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || defaultUrl;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || defaultAnonKey;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://your-project-id.supabase.co' &&
    supabaseAnonKey !== 'your-anon-public-key' &&
    supabaseUrl.startsWith('https://')
  );
};

function safeStorageSetItem(key: string, val: string): void {
  try {
    window.localStorage.setItem(key, val);
  } catch {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('trackrr_thumb_b64_')) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) {
        window.localStorage.removeItem(k);
      }
      window.localStorage.setItem(key, val);
    } catch {}
  }
}

const customAuthStorage = {
  getItem: (key: string): string | null => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.access_token) {
        const nowSec = Math.floor(Date.now() / 1000);
        const expiresIn = typeof parsed.expires_in === 'number' && parsed.expires_in > 0 ? parsed.expires_in : 3600;
        // If session was stored with server's clock (skewed > 24h from local PC clock) or missing _local_issued_at
        if (
          typeof parsed._local_issued_at !== 'number' ||
          parsed._last_token !== parsed.access_token ||
          Math.abs((parsed.expires_at || 0) - (parsed._local_issued_at + expiresIn)) > 300
        ) {
          parsed._local_issued_at = nowSec;
          parsed._last_token = parsed.access_token;
          parsed.expires_at = nowSec + expiresIn;
          const updated = JSON.stringify(parsed);
          safeStorageSetItem(key, updated);
          return updated;
        }
      }
      return raw;
    } catch {
      return window.localStorage.getItem(key);
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && parsed.access_token) {
        const nowSec = Math.floor(Date.now() / 1000);
        const expiresIn = typeof parsed.expires_in === 'number' && parsed.expires_in > 0 ? parsed.expires_in : 3600;
        if (parsed._last_token !== parsed.access_token || typeof parsed._local_issued_at !== 'number') {
          parsed._local_issued_at = nowSec;
          parsed._last_token = parsed.access_token;
        }
        parsed.expires_at = parsed._local_issued_at + expiresIn;
        safeStorageSetItem(key, JSON.stringify(parsed));
        return;
      }
    } catch {}
    safeStorageSetItem(key, value);
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
};

const customSupabaseFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  try {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (res.ok && urlStr.includes('/auth/v1/')) {
      const clone = res.clone();
      const data = await clone.json();
      if (data && typeof data === 'object' && data.access_token) {
        const nowSec = Math.floor(Date.now() / 1000);
        const expiresIn = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600;
        data._local_issued_at = nowSec;
        data._last_token = data.access_token;
        data.expires_at = nowSec + expiresIn;
        return new Response(JSON.stringify(data), {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      }
    }
  } catch {}
  return res;
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: customAuthStorage,
    },
    global: {
      fetch: customSupabaseFetch,
    },
  }
);

