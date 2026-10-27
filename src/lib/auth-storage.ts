// Token storage + auth-state event bus.
// Kept separate from api-client and auth so both can import without a cycle.

const ACCESS_KEY = 'inga_access_token';
const REFRESH_KEY = 'inga_refresh_token';
const USER_KEY = 'inga_user';
// Commit credentials and their owner together, including an explicit logout.
const SESSION_KEY = 'inga_session_v1';

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

export interface SessionSnapshot {
  generation: string;
  owner: string | null;
}
interface SessionRecord {
  generation: string;
  session: AppSession | null;
}

function readRecord(): SessionRecord {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw !== null) return JSON.parse(raw) as SessionRecord;
    // Existing installations keep their session until the first atomic write.
    const access_token = localStorage.getItem(ACCESS_KEY);
    const refresh_token = localStorage.getItem(REFRESH_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    const user = rawUser ? JSON.parse(rawUser) as StoredUser : null;
    return {
      generation: `legacy:${refresh_token || ''}`,
      session: access_token && refresh_token && user ? { access_token, refresh_token, user } : null,
    };
  } catch { return { generation: 'unavailable', session: null }; }
}

export function sessionSnapshot(): SessionSnapshot {
  const record = readRecord();
  return { generation: record.generation, owner: record.session?.user.id || record.session?.user.user_id || null };
}

export function isSessionCurrent(snapshot: SessionSnapshot): boolean {
  const current = sessionSnapshot();
  return current.generation === snapshot.generation && current.owner === snapshot.owner;
}

// Serialize commits across tabs where Web Locks is available. The callback is
// synchronous: no network operation holds the lock. Always recheck after waiting.
export async function commitSession(snapshot: SessionSnapshot, update: () => void): Promise<boolean> {
  const commit = () => {
    if (!isSessionCurrent(snapshot)) return false;
    update();
    return true;
  };
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('legche-auth-session', commit);
  }
  return commit();
}

export function getAccessToken(): string | null {
  return currentSession()?.access_token ?? null;
}
export function getRefreshToken(): string | null {
  return currentSession()?.refresh_token ?? null;
}
export function getStoredUser(): StoredUser | null {
  return currentSession()?.user ?? null;
}

function writeRecord(record: SessionRecord) {
  // Do not swallow a failed write and report a successful login/refresh.
  localStorage.setItem(SESSION_KEY, JSON.stringify(record));
  observed = record;
  // The new record is authoritative; these old keys cannot revive a logout.
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* The atomic session record remains authoritative. */ }
}

export function setTokens(access: string, refresh: string, user?: StoredUser, newSession = !!user) {
  const previous = readRecord();
  const owner = user || previous.session?.user;
  if (!owner) return;
  writeRecord({
    generation: newSession ? crypto.randomUUID() : previous.generation,
    session: { access_token: access, refresh_token: refresh, user: owner },
  });
}

export function clearTokens() {
  writeRecord({ generation: crypto.randomUUID(), session: null });
}

export function currentSession(): AppSession | null {
  return readRecord().session;
}

let observed = readRecord();
function onStorage(event: StorageEvent) {
  if (event.storageArea && event.storageArea !== localStorage) return;
  if (event.key !== null && ![SESSION_KEY, ACCESS_KEY, REFRESH_KEY, USER_KEY].includes(event.key)) return;
  const previous = observed;
  const next = readRecord();
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  const eventName: AuthEvent = !next.session ? 'SIGNED_OUT'
    : previous.generation !== next.generation ? 'SIGNED_IN'
    : previous.session?.access_token !== next.session.access_token ? 'TOKEN_REFRESHED'
    : 'USER_UPDATED';
  notifyAuthChange(eventName);
}

export function subscribe(fn: Listener): () => void {
  if (!listeners.size) {
    observed = readRecord();
    window.addEventListener('storage', onStorage);
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}

export function notifyAuthChange(event: AuthEvent) {
  observed = readRecord();
  const session = observed.session;
  for (const fn of listeners) {
    try { fn(event, session); } catch (e) { console.error('auth listener error', e); }
  }
}
