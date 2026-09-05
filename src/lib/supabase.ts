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

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
