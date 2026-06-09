// Auth client. Talks to the standalone Node API (/api/v1/auth/*).
// Mirrors the subset of supabase.auth used by the app so call sites
// don't need to change.

import { apiFetch, ApiError } from './api-client';
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
// If the URL carries a recovery token, stash it and emit
// PASSWORD_RECOVERY so /reset-password can react.
const RECOVERY_KEY = 'inga_recovery_token';
function bootstrapRecovery() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const t = url.searchParams.get('token');
    const type = url.searchParams.get('type');
    if (t && type === 'recovery') {
      sessionStorage.setItem(RECOVERY_KEY, t);
      url.searchParams.delete('token');
      url.searchParams.delete('type');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => notifyAuthChange('PASSWORD_RECOVERY'), 0);
    }
  } catch {}
}
bootstrapRecovery();

// ── public API ────────────────────────────────────────────────────

export const auth = {
  async signUp(args: { email: string; password: string }): Promise<{ data: { session: AppSession | null; user: StoredUser | null }; error: Error | null }> {
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
    try {
      await apiFetch('/auth/logout', { method: 'POST', retryOn401: false }).catch(() => undefined);
    } finally {
      clearTokens();
      notifyAuthChange('SIGNED_OUT');
    }
    return { error: null };
  },

  async getSession(): Promise<SessionResult> {
    return { data: { session: currentSession() }, error: null };
  },

  async getUser(): Promise<UserResult> {
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
    const unsub = subscribe(cb);
    setTimeout(() => cb(currentSession() ? 'SIGNED_IN' : 'SIGNED_OUT', currentSession()), 0);
    return { data: { subscription: { unsubscribe: unsub } } };
  },

  async resetPasswordForEmail(email: string, opts?: { redirectTo?: string }): Promise<AuthResult> {
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
  // Consumes the recovery token captured at page load.
  async updateUser(args: { password: string }): Promise<AuthResult> {
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
  // the browser navigation is initiated.
  async signInWithOAuth(
    provider: 'google' | 'apple' | 'microsoft',
    opts?: { redirect_uri?: string; extraParams?: Record<string, string> }
  ): Promise<{ error: Error | null; redirected?: boolean }> {
    const redirect = opts?.redirect_uri || window.location.origin;
    const params = new URLSearchParams({ redirect_uri: redirect, ...(opts?.extraParams || {}) });
    const base = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
    window.location.assign(`${base}/auth/oauth/${provider}?${params.toString()}`);
    return { error: null, redirected: true };
  },
};

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e instanceof ApiError) return new Error(String((e.body as any)?.error || e.message));
  return new Error(String(e));
}

// Bridge OAuth tokens returned on the URL fragment from the API callback.
if (typeof window !== 'undefined') {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
      const p = new URLSearchParams(hash);
      const at = p.get('access_token');
      const rt = p.get('refresh_token');
      if (at && rt) {
        setTokens(at, rt);
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
        apiFetch<{ user: StoredUser }>('/auth/me')
          .then((r) => { setTokens(at, rt, r.user); notifyAuthChange('SIGNED_IN'); })
          .catch(() => notifyAuthChange('SIGNED_IN'));
      }
    }
  } catch {}
}
