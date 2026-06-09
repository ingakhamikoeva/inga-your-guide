// Lightweight fetch wrapper for the self-hosted Node API.
// Adds Authorization: Bearer <access_token>, auto-refreshes on 401.
//
// Returns parsed JSON on success; throws ApiError on failure.

import {
  getAccessToken,
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

let refreshInFlight: Promise<string | null> | null = null;

async function attemptRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refresh_token = getRefreshToken();
  if (!refresh_token) return null;

  refreshInFlight = (async () => {
    try {
      const res = await rawFetch('/auth/refresh', { method: 'POST', body: { refresh_token } });
      if (!res.ok) return null;
      const json = await res.json();
      if (json?.access_token) {
        setTokens(json.access_token, json.refresh_token || refresh_token);
        notifyAuthChange('TOKEN_REFRESHED');
        return json.access_token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  if (!HAS_API) throw new ApiError(0, null, 'API base URL not configured');
  const useAuth = opts.auth !== false;
  const token = useAuth ? getAccessToken() : null;

  let res = await rawFetch(path, opts, token);

  if (res.status === 401 && useAuth && opts.retryOn401 !== false) {
    const newToken = await attemptRefresh();
    if (newToken) {
      res = await rawFetch(path, opts, newToken);
    } else {
      clearTokens();
      notifyAuthChange('SIGNED_OUT');
    }
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try { json = JSON.parse(text); } catch { json = text; }
  }

  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}
