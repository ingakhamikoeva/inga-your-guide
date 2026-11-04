// Local production-build regression checks. No requests reach a real API.
// VITE_API_URL=/api/v1 npm run build
// npx playwright install --with-deps webkit
// node scripts/check-startup-webkit.mjs dist after
import { webkit, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const directory = path.resolve(process.argv[2] || 'dist');
const before = process.argv[3] === 'before';
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    let file = path.resolve(directory, '.' + pathname);
    if (!file.startsWith(directory + path.sep) && file !== directory) throw new Error('path');
    if (pathname === '/') file = path.join(directory, 'index.html');
    const data = await fs.readFile(file);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
const user = { id: 'synthetic', user_id: 'synthetic', email: 'synthetic@example.invalid' };
const session = { generation: 'synthetic-generation', session: { access_token: 'expired', refresh_token: 'synthetic-refresh', user } };
const device = devices['iPhone 16 Pro Max'] || devices['iPhone 13'];

async function scenario(name) {
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  let apiStalled = name === 'api-timeout';
  let refreshes = 0;
  // Every external request is handled locally, including optional health probes.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      if (name === 'fonts-stalled') return;
      if (name === 'fonts-failed') return route.abort();
      return route.fulfill({ contentType: 'text/css', body: '' });
    }
    if (url.origin !== origin) return route.fulfill({ contentType: 'application/json', body: '{}' });
    if (url.pathname.startsWith('/api/v1/')) {
      requests.push(url.pathname);
      if (apiStalled) return;
      if (url.pathname.endsWith('/auth/refresh')) {
        refreshes++;
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ access_token: 'renewed', refresh_token: 'synthetic-refresh' }) });
      }
      if (name === 'session-refresh' && request.headers().authorization === 'Bearer expired') {
        return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      }
      const key = url.pathname.replace('/api/v1', '');
      const data = {
        '/profile': { name: 'Synthetic' }, '/plan': null, '/behavior': null,
        '/assessment': [], '/checkins': [],
        '/subscription': { active: true, status: 'trial', serverNow: '2026-11-04T12:00:00Z', accessEndsAt: '2026-12-04T12:00:00Z' },
        '/achievements/sync': { medals: [], newIds: [], streakDays: 0, uniqueRecipes: 0 },
      };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data[key] ?? null) });
    }
    if (name === 'javascript-failed' && url.pathname.endsWith('.js')) return route.abort();
    if (name === 'css-failed' && url.pathname.endsWith('.css')) return route.abort();
    return route.continue();
  });
  if (name === 'invalid-session') await context.addInitScript(() => localStorage.setItem('inga_session_v1', 'null'));
  if (name === 'storage-unavailable') await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  if (['saved-session', 'session-refresh', 'api-timeout'].includes(name)) {
    await context.addInitScript(record => localStorage.setItem('inga_session_v1', JSON.stringify(record)), session);
  }
  try {
    await page.goto(origin + '/?diagnostics=1', { waitUntil: 'commit' });
    if (name === 'api-timeout') {
      await page.getByRole('alert').waitFor({ timeout: 35000 });
      assert.match(await page.getByRole('alert').textContent(), /Не удалось загрузить ваши данные/);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('inga_session_v1')).session.user.id), user.id);
      apiStalled = false;
      await page.getByRole('button', { name: 'Повторить' }).click();
      await page.getByRole('alert').waitFor({ state: 'detached' });
    } else {
      // A bounded observation is deliberate for requests that never settle.
      await page.waitForTimeout(1200);
    }
    const state = await page.evaluate(() => ({
      rootChildren: document.querySelector('#root').childElementCount,
      appTextLength: document.querySelector('#root').textContent.length,
      panels: document.querySelectorAll('aside').length,
      earlyPanel: !!document.querySelector('#legche-boot-diagnostics'),
      background: getComputedStyle(document.body).backgroundColor,
    }));
    const brokenBaseline = before && ['invalid-session', 'javascript-failed'].includes(name);
    if (brokenBaseline || name === 'javascript-failed') assert.equal(state.appTextLength, 0);
    else assert.ok(state.appTextLength > 0, name + ' did not render');
    if (name === 'javascript-failed') assert.equal(state.earlyPanel, !before);
    if (name === 'fonts-stalled') assert.equal(state.background, before ? 'rgba(0, 0, 0, 0)' : 'rgb(255, 248, 240)');
    if (!before && name === 'normal') {
      assert.equal(await page.locator('link[href*="fonts.googleapis.com"][media="all"]').count(), 2);
    }
    if (name === 'invalid-session') assert.equal(errors.length > 0, before);
    else assert.equal(errors.length, 0, errors.join('\n'));
    if (name === 'session-refresh') assert.equal(refreshes, 1);
    if (name === 'fonts-stalled' && process.env.STARTUP_SCREENSHOTS) {
      await fs.mkdir(process.env.STARTUP_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.STARTUP_SCREENSHOTS, before ? 'fonts-before.png' : 'fonts-after.png'), timeout: 5000 });
    }
    results.push({ name, ...state, scriptErrors: errors.length, refreshes, apiRequests: requests.length, passed: true });
    console.log(JSON.stringify(results[results.length - 1]));
  } finally { await context.close(); }
}
try {
  browser = await webkit.launch({ executablePath: process.env.STARTUP_WEBKIT_EXECUTABLE });
  console.log(JSON.stringify({ engine: 'Playwright WebKit on Linux, mobile emulation; not an actual iPhone', version: browser.version(), mode: before ? 'before' : 'after' }));
  for (const name of ['normal', 'fonts-stalled', 'fonts-failed', 'javascript-failed', 'css-failed', 'invalid-session', 'storage-unavailable', 'saved-session', 'session-refresh', 'api-timeout']) {
    await scenario(name);
  }
  console.log(JSON.stringify({ passed: results.length, total: 10 }));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
