import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { fetchText, requestDeadline } from './api-transport';
import { startDiagnostics, stopDiagnostics, diagnosticReport } from './network-diagnostics';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => { vi.useFakeTimers(); sessionStorage.clear(); startDiagnostics(); });
afterEach(() => { stopDiagnostics(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('stalled headers time out and abort underlying fetch, with no retry', async () => {
  const fetch = vi.fn(() => new Promise<Response>(() => {})); vi.stubGlobal('fetch', fetch);
  const promise = fetchText('https://api.invalid/api/v1/auth/login?token=secret', { method: 'POST', body: 'private password' }, 30000).catch(e => e);
  await vi.advanceTimersByTimeAsync(30000);
  expect(await promise).toMatchObject({ name: 'TimeoutError', message: '' });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(true);
  expect(JSON.parse(diagnosticReport()).rows[0]).toMatchObject({ phase: 'headers', result: 'timeout', route: '/auth/login' });
  expect(diagnosticReport()).not.toMatch(/secret|password|token=/);
});

test('deadline includes body transfer; late body cannot complete an expired request', async () => {
  let resolve!: (text: string) => void;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, text: () => new Promise<string>(r => { resolve = r; }) }));
  const pending = fetchText('/api/v1/profile', {}, 30000).catch(e => e);
  await vi.advanceTimersByTimeAsync(30000);
  expect(await pending).toMatchObject({ name: 'TimeoutError' });
  resolve('{"name":"private"}'); await vi.advanceTimersByTimeAsync(1);
  expect(JSON.parse(diagnosticReport()).rows[0]).toMatchObject({ phase: 'body', result: 'timeout', status: 200 });
  expect(diagnosticReport()).not.toContain('private');
});

test('caller cancellation stays AbortError rather than timeout', async () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
  const controller = new AbortController();
  const pending = fetchText('/api/v1/profile', { signal: controller.signal }, 30000).catch(e => e);
  controller.abort();
  expect(await pending).toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(60000);
  expect(JSON.parse(diagnosticReport()).rows.at(-1).result).toBe('aborted');
});

test('network errors reveal neither raw exception nor payload, headers or URL parameters', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private@example.invalid private-token')));
  await expect(fetchText('/api/v1/food-logs/private-id?email=private@example.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer private-token' }, body: 'private meal',
  }, 30000)).rejects.toBeInstanceOf(TypeError);
  const report = diagnosticReport(); expect(report).not.toMatch(/private|Authorization|Bearer/);
  expect(JSON.parse(report).rows[0]).toMatchObject({ route: '<other>', result: 'network_error' });
});

test('HTTP error is recorded as HTTP, and successful JSON body is unchanged', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ error: 'private server response' }, 503)).mockResolvedValueOnce(json({ ok: true })));
  const first = await fetchText('/api/v1/auth/me', {}, 30000);
  expect(first.response.status).toBe(503);
  expect(JSON.parse(diagnosticReport()).rows[0]).toMatchObject({ result: 'http_error', status: 503 });
  expect(diagnosticReport()).not.toContain('private server response');
  expect((await fetchText('/healthz', {}, 10000)).text).toBe('{"ok":true}');
  await vi.advanceTimersByTimeAsync(60000);
  expect(JSON.parse(diagnosticReport()).rows.at(-1).result).toBe('ok');
  expect((vi.mocked(fetch).mock.calls.at(-1) as [string, RequestInit])[1].signal?.aborted).toBe(false);
});

test('opaque reachability probe never claims HTTP success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ type: 'opaque', status: 0, ok: false, text: async () => '' }));
  await fetchText('https://api.legche.online/healthz', { mode: 'no-cors', credentials: 'omit' }, 10000);
  expect(JSON.parse(diagnosticReport()).rows[0]).toMatchObject({ result: 'opaque', status: 0 });
});

test('no report recorded when opt-in disabled, and log is bounded', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => json({ ok: true })));
  for (let i = 0; i < 65; i++) await fetchText('/healthz', {}, 10000);
  expect(JSON.parse(diagnosticReport()).rows).toHaveLength(60);
  stopDiagnostics(); await fetchText('/healthz', {}, 10000);
  expect(sessionStorage.getItem('legche-network-diagnostics-v1')).toBeNull();
  expect(JSON.parse(diagnosticReport()).rows).toHaveLength(0);
});

test('scope keeps slow AI and diary writes unchanged', () => {
  expect(requestDeadline('/auth/forgot-password', 'POST')).toBe(60000);
  expect(requestDeadline('/auth/login', 'POST')).toBe(30000);
  expect(requestDeadline('/profile')).toBe(30000);
  expect(requestDeadline('/ask-inga', 'POST')).toBe(0);
  expect(requestDeadline('/food-logs', 'POST')).toBe(0);
  expect(requestDeadline('/profile', 'PUT')).toBe(0);
});
