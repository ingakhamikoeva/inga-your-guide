// Auth client. Mirrors the subset of `supabase.auth` used in this app so
// pages can switch over with minimal diffs.
//
// Behaviour:
// - If VITE_API_URL (or VITE_API_BASE_URL) is set, talks to the Node API.
// - Otherwise falls back to the existing Supabase client (keeps the Lovable
//   preview working during the staged migration).

import { supabase } from '@/integrations/supabase/client';
import { apiFetch, HAS_API, ApiError } from './api-client';
import {
  type AuthEvent,
  type AppSession,
  type StoredUser,
  clearTokens,
  currentSession,
  getStoredUser,
  notifyAuthChange,
  setTokens,
  subscribe,
} from './auth-storage';

export type { AuthEvent, AppSession, StoredUser } from './auth-storage';

interface AuthResult { error: Error | null }
interface SessionResult { data: { session: AppSession | null }; error: Error | null }
interface UserResult { data: { user: StoredUser | null }; error: Error | null }
interface TokenResp {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: StoredUser;
}

// ── recovery flow bootstrap ───────────────────────────────────────
// On load, if the URL carries a recovery token, stash it and emit
// PASSWORD_RECOVERY so /reset-password can react like with Supabase.
const RECOVERY_KEY = 'inga_recovery_token';
function bootstrapRecovery() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('token');
    const type = url.searchParams.get('type');
    if (t && type === 'recovery') {
      sessionStorage.setItem(RECOVERY_KEY, t);
      // strip query params so reloads don't re-fire
      url.searchParams.delete('token');
      url.searchParams.delete('type');
      window.history.replaceState({}, '', url.toString());
      // Defer so subscribers from page mount have time to attach.
      setTimeout(() => notifyAuthChange('PASSWORD_RECOVERY'), 0);
    }
  } catch {}
}
if (HAS_API) bootstrapRecovery();

// ── public API ────────────────────────────────────────────────────

export const auth = {
  async signUp(args: { email: string; password: string }): Promise<{ data: { session: AppSession | null; user: StoredUser | null }; error: Error | null }> {
    if (!HAS_API) {
      const { data, error } = await supabase.auth.signUp({
        email: args.email,
        password: args.password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      return {
        data: {
          session: data.session as unknown as AppSession | null,
          user: (data.user as unknown as StoredUser) || null,
        },
        error: error || null,
      };
    }
    try {
      const r = await apiFetch<TokenResp>('/auth/signup', {
        method: 'POST',
        body: { email: args.email, password: args.password },
        auth: false,
      });
      setTokens(r.access_token, r.refresh_token, r.user);
      notifyAuthChange('SIGNED_IN');
      return { data: { session: currentSession(), user: r.user }, error: null };
    } catch (e) {
      return { data: { session: null, user: null }, error: toError(e) };
    }
  },

  async signInWithPassword(args: { email: string; password: string }): Promise<{ data: { session: AppSession | null; user: StoredUser | null }; error: Error | null }> {
    if (!HAS_API) {
      const { data, error } = await supabase.auth.signInWithPassword(args);
      return {
        data: {
          session: data.session as unknown as AppSession | null,
          user: (data.user as unknown as StoredUser) || null,
        },
        error: error || null,
      };
    }
    try {
      const r = await apiFetch<TokenResp>('/auth/login', {
        method: 'POST',
        body: args,
        auth: false,
      });
      setTokens(r.access_token, r.refresh_token, r.user);
      notifyAuthChange('SIGNED_IN');
      return { data: { session: currentSession(), user: r.user }, error: null };
    } catch (e) {
      return { data: { session: null, user: null }, error: toError(e) };
    }
  },

  async signOut(): Promise<AuthResult> {
    if (!HAS_API) {
      const { error } = await supabase.auth.signOut();
      return { error: error || null };
    }
    try {
      await apiFetch('/auth/logout', { method: 'POST', retryOn401: false }).catch(() => undefined);
    } finally {
      clearTokens();
      notifyAuthChange('SIGNED_OUT');
    }
    return { error: null };
  },

  async getSession(): Promise<SessionResult> {
    if (!HAS_API) {
      const { data, error } = await supabase.auth.getSession();
      return {
        data: { session: (data.session as unknown as AppSession | null) || null },
        error: error || null,
      };
    }
    return { data: { session: currentSession() }, error: null };
  },

  async getUser(): Promise<UserResult> {
    if (!HAS_API) {
      const { data, error } = await supabase.auth.getUser();
      return {
        data: { user: (data.user as unknown as StoredUser) || null },
        error: error || null,
      };
    }
    const cached = getStoredUser();
    if (cached) return { data: { user: cached }, error: null };
    try {
      const r = await apiFetch<{ user: StoredUser }>('/auth/me', { method: 'GET' });
      return { data: { user: r.user }, error: null };
    } catch (e) {
      return { data: { user: null }, error: toError(e) };
    }
  },

  onAuthStateChange(cb: (event: AuthEvent, session: AppSession | null) => void): {
    data: { subscription: { unsubscribe: () => void } };
  } {
    if (!HAS_API) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        cb(event as AuthEvent, session as unknown as AppSession | null);
      });
      return {
        data: {
          subscription: {
            unsubscribe: () => data.subscription.unsubscribe(),
          },
        },
      };
    }
    const unsub = subscribe(cb);
    // Emit an initial event so the consumer doesn't need a separate getSession call.
    setTimeout(() => cb(currentSession() ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession()), 0);
    return { data: { subscription: { unsubscribe: unsub } } };
  },

  async resetPasswordForEmail(email: string, opts?: { redirectTo?: string }): Promise<AuthResult> {
    if (!HAS_API) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: opts?.redirectTo,
      });
      return { error: error || null };
    }
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email, redirect_to: opts?.redirectTo },
        auth: false,
      });
      return { error: null };
    } catch (e) {
      return { error: toError(e) };
    }
  },

  // Mirrors supabase.auth.updateUser({ password }) — used by ResetPassword.tsx.
  // In API mode, consumes the recovery token captured at page load.
  async updateUser(args: { password: string }): Promise<AuthResult> {
    if (!HAS_API) {
      const { error } = await supabase.auth.updateUser({ password: args.password });
      return { error: error || null };
    }
    const token = sessionStorage.getItem(RECOVERY_KEY);
    if (!token) return { error: new Error('No recovery token in session') };
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: args.password },
        auth: false,
      });
      sessionStorage.removeItem(RECOVERY_KEY);
      notifyAuthChange('USER_UPDATED');
      return { error: null };
    } catch (e) {
      return { error: toError(e) };
    }
  },

  // OAuth — server-side redirect. Returns { redirected: true } once
  // the browser navigation is initiated, mirroring the lovable wrapper.
  async signInWithOAuth(
    provider: 'google' | 'apple' | 'microsoft',
    opts?: { redirect_uri?: string; extraParams?: Record<string, string> }
  ): Promise<{ error: Error | null; redirected?: boolean }> {
    if (!HAS_API) {
      // Defer to Supabase OAuth via the existing lovable wrapper at the call site.
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: provider as 'google' | 'apple' | 'azure',
          options: { redirectTo: opts?.redirect_uri, queryParams: opts?.extraParams },
        });
        return { error: error || null, redirected: !error };
      } catch (e) {
        return { error: toError(e) };
      }
    }
    const redirect = opts?.redirect_uri || window.location.origin;
    const params = new URLSearchParams({ redirect_uri: redirect, ...(opts?.extraParams || {}) });
    window.location.assign(`${import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL}/auth/oauth/${provider}?${params.toString()}`);
    return { error: null, redirected: true };
  },
};

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e instanceof ApiError) return new Error(String((e.body as any)?.error || e.message));
  return new Error(String(e));
}

// Bridge OAuth tokens returned on the URL fragment from the API callback.
if (HAS_API && typeof window !== 'undefined') {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const p = new URLSearchParams(hash);
      const at = p.get('access_token');
      const rt = p.get('refresh_token');
      if (at && rt) {
        setTokens(at, rt);
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
        // Best-effort populate user; SIGNED_IN will be fired by /auth/me consumers.
        apiFetch<{ user: StoredUser }>('/auth/me')
          .then((r) => { setTokens(at, rt, r.user); notifyAuthChange('SIGNED_IN'); })
          .catch(() => notifyAuthChange('SIGNED_IN'));
      }
    }
  } catch {}
}
