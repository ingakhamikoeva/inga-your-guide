import { beginRequest, updateRequest } from './network-diagnostics';

// Empty message lets existing screens use their existing, approved error text.
export class RequestTimeoutError extends Error {
  constructor() { super(''); this.name = 'TimeoutError'; }
}

export function requestDeadline(path: string, method = 'GET'): number {
  const pathname = new URL(path, 'https://local.invalid').pathname.replace(/^\/api\/v1(?=\/|$)/, '');
  if (pathname === '/auth/forgot-password') return 60000;
  if (pathname.startsWith('/auth/')) return 30000;
  if (method.toUpperCase() === 'GET' && ['/profile','/plan','/behavior','/assessment','/checkins','/subscription'].includes(pathname)) return 30000;
  // Preserve AI/upload/save timing; this change targets auth and initial hydration only.
  return 0;
}

export async function fetchText(url: string, init: RequestInit, timeoutMs: number) {
  const started = performance.now();
  const id = beginRequest(url, init.method);
  const controller = new AbortController();
  let phase: 'headers' | 'body' = 'headers';
  let status: number | undefined;
  let timedOut = false;
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    controller.abort();
    rejectAbort(timedOut ? new RequestTimeoutError() : new DOMException('Aborted', 'AbortError'));
  };
  const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; abort(); }, timeoutMs) : undefined;
  init.signal?.addEventListener('abort', abort, { once: true });
  const task = async () => {
    if (init.signal?.aborted) { abort(); throw new DOMException('Aborted', 'AbortError'); }
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    phase = 'body'; status = response.status;
    updateRequest(id, phase, 'pending', performance.now() - started, status);
    const text = await response.text();
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return { response, text };
  };
  try {
    // Race also covers a stalled response body and fetch implementations that ignore abort.
    const result = await Promise.race([task(), aborted]);
    updateRequest(id, 'done', result.response.type === 'opaque' ? 'opaque' : result.response.ok ? 'ok' : 'http_error', performance.now() - started, status);
    return result;
  } catch (error) {
    updateRequest(id, phase, timedOut ? 'timeout' : controller.signal.aborted ? 'aborted' : 'network_error', performance.now() - started, status);
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}
