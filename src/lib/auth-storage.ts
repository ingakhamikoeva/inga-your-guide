// Token storage + auth-state event bus.
// Kept separate from api-client and auth so both can import without a cycle.

const ACCESS_KEY = 'inga_access_token';
const REFRESH_KEY = 'inga_refresh_token';
const USER_KEY = 'inga_user';

export interface StoredUser {
  id: string;
  user_id: string;
  email: string;
  email_verified?: boolean;
  role?: 'user' | 'admin';
  created_at?: string;
}

export interface AppSession {
  access_token: string;
  refresh_token: string;
  user: StoredUser;
  expires_at?: number;
}

export type AuthEvent =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'PASSWORD_RECOVERY'
  | 'USER_UPDATED';

type Listener = (event: AuthEvent, session: AppSession | null) => void;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
}
export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch { return null; }
}

export function setTokens(access: string, refresh: string, user?: StoredUser) {
  try {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export function currentSession(): AppSession | null {
  const access_token = getAccessToken();
  const refresh_token = getRefreshToken();
  const user = getStoredUser();
  if (!access_token || !refresh_token || !user) return null;
  return { access_token, refresh_token, user };
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyAuthChange(event: AuthEvent) {
  const session = currentSession();
  for (const fn of listeners) {
    try { fn(event, session); } catch (e) { console.error('auth listener error', e); }
  }
}
