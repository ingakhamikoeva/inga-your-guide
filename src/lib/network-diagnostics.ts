// Opt-in, tab-local diagnostics. Never accept bodies, headers, error messages or user IDs.
const KEY = 'legche-network-diagnostics-v1';
const MAX_AGE = 30 * 60 * 1000;
const MAX_ROWS = 60;
const routes = new Set(['/', '/healthz', '/auth/login', '/auth/signup', '/auth/logout',
  '/auth/refresh', '/auth/me', '/auth/forgot-password', '/auth/reset-password',
  '/auth/send-verification', '/auth/verify-email', '/profile', '/plan', '/behavior',
  '/assessment', '/checkins', '/subscription', '/food-logs', '/ask-inga',
  '/estimate-nutrition', '/achievements/sync']);
export type NetworkResult = 'pending' | 'ok' | 'http_error' | 'opaque' | 'timeout' | 'aborted' | 'network_error';
type Row = { id: number; at: string; host: string; route: string; method: string;
  phase: 'headers' | 'body' | 'done'; result: NetworkResult; ms: number; status?: number };
type Report = { version: 'mobile-diag-1'; started: number; rows: Row[]; scriptErrors: number };
let report: Report | null = null;
let nextId = 0;
let refreshPanel = () => {};
let installed = false;

function write() {
  try { if (report) sessionStorage.setItem(KEY, JSON.stringify(report)); } catch { /* memory-only still works */ }
  refreshPanel();
}
function active() {
  if (report && Date.now() - report.started > MAX_AGE) stopDiagnostics();
  return report !== null;
}
export function diagnosticsEnabled() { return active(); }
export function stopDiagnostics() {
  report = null;
  try { sessionStorage.removeItem(KEY); } catch { /* optional storage */ }
  refreshPanel();
}
export function startDiagnostics() {
  report = { version: 'mobile-diag-1', started: Date.now(), rows: [], scriptErrors: 0 };
  write();
}
export function beginRequest(url: string, method = 'GET'): number | null {
  if (!active()) return null;
  let host = 'invalid'; let route = '<other>';
  try {
    const parsed = new URL(url, window.location.origin);
    host = parsed.host;
    const path = parsed.pathname.replace(/^\/api\/v1(?=\/|$)/, '') || '/';
    route = routes.has(path) ? path : '<other>';
  } catch { /* no raw URL in the report */ }
  const id = ++nextId;
  report!.rows.push({ id, at: new Date().toISOString(), host, route,
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) ? method.toUpperCase() : 'OTHER',
    phase: 'headers', result: 'pending', ms: 0 });
  report!.rows = report!.rows.slice(-MAX_ROWS);
  write();
  return id;
}
export function updateRequest(id: number | null, phase: Row['phase'], result: NetworkResult, ms: number, status?: number) {
  if (id === null || !active()) return;
  const row = report!.rows.find(item => item.id === id);
  if (!row) return;
  Object.assign(row, { phase, result, ms: Math.round(ms) });
  if (status !== undefined) row.status = status;
  write();
}
export function diagnosticReport() {
  return JSON.stringify({ version: 'mobile-diag-1',
    online: navigator.onLine,
    screen: document.getElementById('root')?.childElementCount ? 'rendered' : 'empty',
    started: report?.started, scriptErrors: report?.scriptErrors ?? 0,
    rows: report?.rows ?? [] }, null, 2);
}

export function installNetworkDiagnostics() {
  if (installed) return;
  installed = true;
  const url = new URL(window.location.href);
  const mode = url.searchParams.get('diagnostics');
  if (mode === '1') startDiagnostics();
  else if (mode === '0') stopDiagnostics();
  else {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      // Restore only our bounded, strictly sanitized record shape.
      if (saved?.version === 'mobile-diag-1' && Number.isFinite(saved.started)
        && Date.now() - saved.started >= 0 && Date.now() - saved.started < MAX_AGE) {
        report = { version: 'mobile-diag-1', started: saved.started, rows: [], scriptErrors: 0 };
        for (const item of (Array.isArray(saved.rows) ? saved.rows.slice(-MAX_ROWS) : [])) {
          if (!Number.isInteger(item.id) || !Number.isFinite(item.ms) || typeof item.at !== 'string'
            || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(item.at)
            || typeof item.host !== 'string' || !/^[a-zA-Z0-9.:[\]-]+$/.test(item.host)
            || !(routes.has(item.route) || item.route === '<other>')
            || !['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','OTHER'].includes(item.method)
            || !['headers','body','done'].includes(item.phase)
            || !['pending','ok','http_error','opaque','timeout','aborted','network_error'].includes(item.result)) continue;
          report.rows.push({ id: item.id, at: item.at, host: item.host, route: item.route,
            method: item.method, phase: item.phase, result: item.result, ms: item.ms,
            ...(Number.isInteger(item.status) && item.status >= 0 && item.status <= 599 ? { status: item.status } : {}) });
          nextId = Math.max(nextId, item.id);
        }
      }
    } catch { /* optional storage */ }
  }
  if (mode !== null) {
    url.searchParams.delete('diagnostics');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
  if (!active()) return;

  // Native DOM: this remains accessible even when React's loading branch renders null.
  const panel = document.createElement('aside');
  panel.setAttribute('aria-label', 'Диагностика соединения');
  panel.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:2147483647;max-width:calc(100vw - 16px);font:14px system-ui;background:white;color:#222;border:2px solid #ff6500;border-radius:12px;padding:8px;box-shadow:0 2px 12px #0003';
  const toggle = document.createElement('button');
  toggle.textContent = 'Диагностика · отчёт';
  toggle.style.cssText = 'padding:10px;min-height:44px;color:#222;background:#fff0e5;border:0;border-radius:8px';
  const body = document.createElement('div'); body.hidden = true;
  const note = document.createElement('p');
  note.textContent = 'Отчёт остаётся в этой вкладке. Пароли, токены и данные дневника не записываются. Скопируйте отчёт после попытки входа.';
  note.style.maxWidth = '340px';
  const output = document.createElement('textarea'); output.readOnly = true;
  output.setAttribute('aria-label', 'Технический отчёт');
  output.style.cssText = 'display:block;width:320px;max-width:75vw;height:32vh;font:12px monospace;color:#222;background:#fff';
  const copy = document.createElement('button'); copy.textContent = 'Скопировать отчёт';
  const stop = document.createElement('button'); stop.textContent = 'Завершить диагностику';
  for (const button of [copy, stop]) button.style.cssText = 'display:block;padding:10px;min-height:44px;margin-top:6px';
  copy.onclick = async () => {
    const text = diagnosticReport(); output.value = text;
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Скопировано'; }
    catch { output.focus(); output.select(); copy.textContent = 'Выделено — скопируйте текст'; }
  };
  stop.onclick = stopDiagnostics;
  toggle.onclick = () => { body.hidden = !body.hidden; output.value = diagnosticReport(); };
  refreshPanel = () => {
    if (!report) { panel.remove(); return; }
    // Do not disrupt manual selection on browsers without clipboard support.
    if (document.activeElement !== output) output.value = diagnosticReport();
  };
  const scriptError = () => { if (active()) { report!.scriptErrors++; write(); } };
  window.addEventListener('error', scriptError);
  window.addEventListener('unhandledrejection', scriptError);
  body.append(note, output, copy, stop); panel.append(toggle, body); document.body.append(panel);
  setTimeout(stopDiagnostics, Math.max(0, MAX_AGE - (Date.now() - report!.started)));
  write();
}
