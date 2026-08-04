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
import { getStoredUtm, clearStoredUtm } from './utm';

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
  async signUp(args: { email: string; password: string; pdConsent?: boolean; marketingConsent?: boolean }): Promise<{ data: { session: AppSession | null; user: StoredUser | null }; error: Error | null }> {
    try {
      const r = await apiFetch<TokenResp>('/auth/signup', {
        method: 'POST',
        body: {
          email: args.email,
          password: args.password,
          pdConsent: args.pdConsent ?? false,
          marketingConsent: args.marketingConsent ?? false,
          utm: getStoredUtm(),
        },
        auth: false,
      });
      setTokens(r.access_token, r.refresh_token, r.user);
      notifyAuthChange('SIGNED_IN');
      clearStoredUtm();
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

  // Подтверждение email (мягкая проверка): доступ есть сразу,
  // подтверждение нужно для восстановления пароля и писем.
  async sendVerification(): Promise<AuthResult> {
    try {
      await apiFetch('/auth/send-verification', { method: 'POST', body: {} });
      return { error: null };
    } catch (e) {
      return { error: toError(e) };
    }
  },

  async verifyEmail(token: string): Promise<AuthResult> {
    try {
      await apiFetch('/auth/verify-email', { method: 'POST', body: { token }, auth: false });
      return { error: null };
    } catch (e) {
      return { error: toError(e) };
    }
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
  // True если при загрузке страницы был перехвачен recovery-токен из ссылки письма.
  hasRecoveryToken(): boolean {
    try { return Boolean(sessionStorage.getItem(RECOVERY_KEY)); } catch { return false; }
  },

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

};

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e instanceof ApiError) return new Error(String((e.body as any)?.error || e.message));
  return new Error(String(e));
}

