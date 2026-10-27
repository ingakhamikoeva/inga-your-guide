// Lightweight fetch wrapper for the self-hosted Node API.
// Adds Authorization: Bearer <access_token>, auto-refreshes on 401.
//
// Returns parsed JSON on success; throws ApiError on failure.

import {
  getAccessToken,
  sessionSnapshot,
  isSessionCurrent,
  commitSession,
  subscribe,
  type SessionSnapshot,
  getRefreshToken,
  setTokens,
  clearTokens,
  notifyAuthChange,
} from './auth-storage';

const RAW_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  '';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const HAS_API = !!API_BASE;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message || (typeof body === 'object' && body && (body as any).error) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;        // attach access token (default: true)
  retryOn401?: boolean;  // attempt refresh on 401 (default: true)
}

async function rawFetch(path: string, opts: ApiOptions, token?: string | null): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    ...opts,
    headers,
    body:
      opts.body === undefined
        ? undefined
        : opts.body instanceof FormData
          ? (opts.body as FormData)
          : JSON.stringify(opts.body),
  });
}

type RefreshFlight = { snapshot: SessionSnapshot; promise: Promise<string | null> };
let refreshInFlight: RefreshFlight | null = null;

function assertSession(snapshot: SessionSnapshot) {
  if (!isSessionCurrent(snapshot)) throw new DOMException('account_changed', 'AbortError');
}

async function attemptRefresh(snapshot: SessionSnapshot): Promise<string | null> {
  assertSession(snapshot);
  if (refreshInFlight && refreshInFlight.snapshot.generation === snapshot.generation
    && refreshInFlight.snapshot.owner === snapshot.owner) return refreshInFlight.promise;
  const refresh_token = getRefreshToken();
  const access_token = getAccessToken();
  if (!refresh_token) return null;
  const controller = new AbortController();
  const unsubscribe = subscribe(() => {
    if (!isSessionCurrent(snapshot)) controller.abort();
  });
  const flight: RefreshFlight = { snapshot, promise: Promise.resolve(null) };
  flight.promise = (async () => {
    try {
      const res = await rawFetch('/auth/refresh', { method: 'POST', body: { refresh_token }, signal: controller.signal });
      assertSession(snapshot);
      // Another tab may already have refreshed this same session.
      if (getAccessToken() !== access_token) return getAccessToken();
      if (!res.ok) return null;
      const json = await res.json();
      assertSession(snapshot);
      if (getAccessToken() !== access_token) return getAccessToken();
      if (json?.access_token) {
        await commitSession(snapshot, () => {
          if (getAccessToken() !== access_token) return;
          setTokens(json.access_token, json.refresh_token || refresh_token);
          notifyAuthChange('TOKEN_REFRESHED');
        });
        assertSession(snapshot);
        return getAccessToken();
      }
      return null;
    } catch {
      assertSession(snapshot);
      if (getAccessToken() !== access_token) return getAccessToken();
      return null;
    } finally {
      unsubscribe();
      if (refreshInFlight === flight) refreshInFlight = null;
    }
  })();
  refreshInFlight = flight;
  return flight.promise;
}

export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  if (!HAS_API) throw new ApiError(0, null, 'API base URL not configured');
  const snapshot = sessionSnapshot();
  const requestOwner = snapshot.owner;
  const useAuth = opts.auth !== false;
  const token = useAuth ? getAccessToken() : null;

  const controller = new AbortController();
  const abort = () => controller.abort(opts.signal?.reason);
  if (opts.signal?.aborted) abort();
  else opts.signal?.addEventListener('abort', abort, { once: true });
  const unsubscribe = useAuth ? subscribe(() => {
    if (!isSessionCurrent(snapshot)) controller.abort();
  }) : () => {};
  const check = () => {
    if (useAuth) assertSession(snapshot);
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  };
  const requestOpts = { ...opts, signal: controller.signal };
  try {
    check();
    let res = await rawFetch(path, requestOpts, token);
    check();

    if (res.status === 401 && useAuth && opts.retryOn401 !== false) {
      const newToken = getAccessToken() !== token ? getAccessToken() : await attemptRefresh(snapshot);
      check();
      if (newToken) {
        res = await rawFetch(path, requestOpts, newToken);
        check();
      } else {
        const text = await res.text();
        check();
        let body: unknown = null;
        if (text) { try { body = JSON.parse(text); } catch { body = text; } }
        await commitSession(snapshot, () => {
          if (getAccessToken() !== token) return;
          clearTokens();
          notifyAuthChange('SIGNED_OUT');
        });
        throw new ApiError(res.status, body);
      }
    }

    const text = await res.text();
    check();
    let json: unknown = null;
    if (text) {
      try { json = JSON.parse(text); } catch { json = text; }
    }

    if (!res.ok) {
      const code = (json as { error?: string } | null)?.error;
      const currentOwner = sessionSnapshot().owner;
      if (useAuth && requestOwner && requestOwner === currentOwner
        && ((res.status === 403 && code === 'access_required') || (res.status === 503 && code === 'access_unavailable'))) {
        window.dispatchEvent(new CustomEvent('legche:access-denied', {
          detail: { userId: requestOwner, access: (json as { access?: unknown })?.access ?? null },
        }));
      }
      throw new ApiError(res.status, json);
    }
    const currentOwner = sessionSnapshot().owner;
    if (useAuth && requestOwner && currentOwner === requestOwner
      && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(opts.method || 'GET')
      && /^\/(profile|checkins|food-logs)(\/|$)/.test(path)) {
      window.dispatchEvent(new CustomEvent('legche:diary-saved', { detail: { userId: requestOwner } }));
    }
    return json as T;
  } finally {
    unsubscribe();
    opts.signal?.removeEventListener('abort', abort);
  }
}
