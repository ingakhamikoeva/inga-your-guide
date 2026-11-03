import { afterEach, beforeEach, expect, test, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); sessionStorage.clear(); document.body.innerHTML = '<div id="root"></div>'; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

test('diagnostic link exposes report even with an empty app root; copy never reads page data', async () => {
  window.history.replaceState({}, '', '/?diagnostics=1&token=private-token');
  const d = await import('./network-diagnostics'); d.installNetworkDiagnostics();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const id = d.beginRequest('/api/v1/auth/login?email=private-email');
  d.updateRequest(id, 'headers', 'timeout', 30000);
  expect(document.querySelector('aside')).not.toBeNull();
  const buttons = Array.from(document.querySelectorAll('button'));
  buttons[0].click(); buttons[1].click(); await Promise.resolve();
  expect(writeText).toHaveBeenCalledOnce();
  expect(writeText.mock.calls[0][0]).toContain('timeout');
  expect(writeText.mock.calls[0][0]).not.toMatch(/private-token|private-email/);
  expect(window.location.search).not.toContain('diagnostics=');
  expect(window.location.search).toContain('token=private-token');
  buttons[2].click();
  expect(document.querySelector('aside')).toBeNull();
  expect(sessionStorage.getItem('legche-network-diagnostics-v1')).toBeNull();
});
test('normal visits add no panel and opt-in expires automatically', async () => {
  window.history.replaceState({}, '', '/');
  let d = await import('./network-diagnostics'); d.installNetworkDiagnostics();
  expect(document.querySelector('aside')).toBeNull();
  vi.resetModules();
  window.history.replaceState({}, '', '/?diagnostics=1');
  d = await import('./network-diagnostics'); d.installNetworkDiagnostics();
  await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
  expect(document.querySelector('aside')).toBeNull();
  expect(d.diagnosticsEnabled()).toBe(false);
});
test('same-tab reload restores sanitized rows but drops unknown injected properties', async () => {
  window.history.replaceState({}, '', '/?diagnostics=1');
  let d = await import('./network-diagnostics'); d.installNetworkDiagnostics();
  const id = d.beginRequest('/api/v1/auth/login'); d.updateRequest(id, 'done', 'ok', 100, 200);
  const saved = JSON.parse(sessionStorage.getItem('legche-network-diagnostics-v1')!);
  saved.rows[0].password = 'private'; saved.rows[0].body = 'private';
  sessionStorage.setItem('legche-network-diagnostics-v1', JSON.stringify(saved));
  vi.resetModules(); document.querySelector('aside')?.remove();
  d = await import('./network-diagnostics'); d.installNetworkDiagnostics();
  expect(JSON.parse(d.diagnosticReport()).rows).toHaveLength(1);
  expect(d.diagnosticReport()).not.toMatch(/private|password/);
});
