import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
function boot(query = '?diagnostics=1') {
  window.history.replaceState({}, '', '/' + query);
  window.eval(script);
  document.dispatchEvent(new Event('readystatechange'));
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); sessionStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
});
afterEach(() => {
  window.__legcheBootDiagnostics?.finish(); delete window.__legcheBootDiagnostics;
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});

test('diagnostics exist without importing or starting the application', () => {
  boot();
  expect(document.querySelector('#legche-boot-diagnostics')).not.toBeNull();
  const button = document.querySelector('button')!; button.click();
  const output = document.querySelector('textarea')!;
  expect(output.hidden).toBe(false);
  expect(JSON.parse(output.value)).toMatchObject({ html: true, module: false });
});

test('early resource and script failures are counted without recording private data', () => {
  boot('?diagnostics=1&token=private-token');
  window.dispatchEvent(new ErrorEvent('error', { message: 'private-message', filename: '/private-file' }));
  const resource = document.createElement('script');
  document.head.appendChild(resource);
  resource.dispatchEvent(new Event('error'));
  resource.remove();
  const text = document.querySelector('textarea')!.value;
  expect(JSON.parse(text)).toMatchObject({ scriptErrors: 1, resourceErrors: 1 });
  expect(text).not.toContain('private');
});

test('network diagnostics take over the early panel and retain its evidence', async () => {
  boot();
  window.dispatchEvent(new ErrorEvent('error', { message: 'private' }));
  const d = await import('./network-diagnostics');
  d.installNetworkDiagnostics();
  expect(document.querySelectorAll('aside')).toHaveLength(1);
  expect(document.querySelector('#legche-boot-diagnostics')).toBeNull();
  expect(JSON.parse(d.diagnosticReport()).bootstrap).toMatchObject({ html: true, module: true, scriptErrors: 1 });
  expect(window.__legcheBootDiagnostics).toBeUndefined();
  d.stopDiagnostics();
});

test('diagnostics remain optional on normal visits', () => {
  boot('');
  expect(document.querySelector('aside')).toBeNull();
  expect(window.__legcheBootDiagnostics).toBeUndefined();
});

test('empty React layout wrappers are not reported as a rendered screen', async () => {
  document.querySelector('#root')!.innerHTML = '<div><div></div></div>';
  const d = await import('./network-diagnostics');
  expect(JSON.parse(d.diagnosticReport()).screen).toBe('empty');
  document.querySelector('#root')!.textContent = 'Visible screen';
  expect(JSON.parse(d.diagnosticReport()).screen).toBe('rendered');
});

test('unavailable history mutation cannot prevent application startup', async () => {
  boot();
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
  const d = await import('./network-diagnostics');
  expect(() => d.installNetworkDiagnostics()).not.toThrow();
  expect(document.querySelector('aside')).not.toBeNull();
  d.stopDiagnostics();
});
