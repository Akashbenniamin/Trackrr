import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getJwtExp } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    // Get initial session and ensure token is valid/refreshed
    supabase.auth.getSession().then(async ({ data: { session: currentSession }, error }) => {
      if (error || !currentSession) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const exp = getJwtExp(currentSession.access_token);
      const nowSec = Math.floor(Date.now() / 1000);
      if (exp && exp < nowSec + 30) {
        try {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          if (refreshErr || !refreshed.session) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          setSession(refreshed.session);
          setUser(refreshed.session.user ?? null);
          setLoading(false);
          return;
        } catch {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }

      setSession(currentSession);
      setUser(currentSession.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error('Error fetching Supabase session:', err);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(prev => {
        if (prev?.id === nextSession?.user?.id) return prev;
        return nextSession?.user ?? null;
      });
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [configured]);

  const signInWithEmail = async (email: string, password: string) => {
    if (!configured) {
      return { error: new Error('Supabase is not configured yet. Please add your credentials to .env') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!configured) {
      return { error: new Error('Supabase is not configured yet. Please add your credentials to .env') };
    }
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    if (!configured) {
      return { error: new Error('Supabase is not configured yet. Please add your credentials to .env') };
    }
    const origin = window.location.origin;
    let pathname = window.location.pathname;
    if (!pathname.endsWith('/')) {
      pathname += '/';
    }
    const redirectUrl = `${origin}${pathname}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      if (configured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Error during supabase signOut:', err);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: configured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
