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

export function getJwtExp(token?: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(window.atob(padded));
    return typeof payload?.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

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
      if (parsed && typeof parsed === 'object' && typeof parsed.access_token === 'string') {
        const realExp = getJwtExp(parsed.access_token);
        if (realExp && (parsed.expires_at !== realExp || '_local_issued_at' in parsed)) {
          parsed.expires_at = realExp;
          delete parsed._local_issued_at;
          delete parsed._last_token;
          const repaired = JSON.stringify(parsed);
          safeStorageSetItem(key, repaired);
          return repaired;
        }
      }
      return raw;
    } catch {
      return window.localStorage.getItem(key);
    }
  },
  setItem: (key: string, value: string): void => {
    safeStorageSetItem(key, value);
  },
  removeItem: (key: string): void => {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  },
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
  }
);
