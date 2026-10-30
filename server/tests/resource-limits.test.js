// Local integration tests: an isolated in-memory PostgreSQL (PGlite), fake SMTP/AI.
// B3_PGLITE_ROOT may point at a separately installed @electric-sql/pglite package.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
import nodemailer from 'nodemailer';

const pgliteRoot = process.env.B3_PGLITE_ROOT;
const { PGlite } = await import(pgliteRoot ? pathToFileURL(`${pgliteRoot}/dist/index.js`).href : '@electric-sql/pglite');
const { pgcrypto } = await import(pgliteRoot ? pathToFileURL(`${pgliteRoot}/dist/contrib/pgcrypto.js`).href : '@electric-sql/pglite/contrib/pgcrypto');
Object.assign(process.env, {
  JWT_SECRET: 'synthetic-test-secret-never-used-on-a-server', APP_URL: 'https://b3.invalid',
  DEEPSEEK_API_KEY: 'synthetic-test-key', DEEPSEEK_BASE_URL: 'https://provider.invalid',
  AI_USER_HOURLY_MAX: '3', AI_DAILY_MAX_CALLS: '100', AI_MAX_CONCURRENT: '8', AI_USER_MAX_CONCURRENT: '2',
  AI_DAILY_BUDGET_UNITS: '50000000', SMTP_HOST: 'smtp.invalid', SMTP_SUPPORT_USER: 'support@b3.invalid',
  SMTP_SUPPORT_PASS: 'synthetic-test-password', DATABASE_URL: '',
});
let mailCalls = [];
nodemailer.createTransport = () => ({ sendMail: async message => { mailCalls.push(message); return {}; } });
const nativeFetch = globalThis.fetch;
let providerCalls = [];
let providerAction;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://provider.invalid/chat/completions', 'no external traffic is allowed');
  const body = JSON.parse(options.body); providerCalls.push(body);
  if (providerAction) return providerAction(body, options);
  const content = body.max_tokens === 1800
    ? JSON.stringify({ present: ['Записан суп'], attention: [], next: ['Добавьте овощи'], recipeIds: [] })
    : body.response_format ? JSON.stringify({ protein_g: 20, has_protein: true, has_carbs: true, has_fiber: false, confidence: 'low' })
    : 'Тестовый ответ';
  return Response.json({ choices: [{ message: { content } }] });
};
const { pool } = await import('../db.js');
const pg = new PGlite({ extensions: { pgcrypto } });
// PGlite has one connection; serialize pool leases, keeping real SQL transactions.
let tail = Promise.resolve();
async function acquire() { const previous = tail; let release; tail = new Promise(r => { release = r; }); await previous; return release; }
async function query(sql, values) { const result = await pg.query(sql, values); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; }
pool.connect = async () => { const release = await acquire(); return { query, release }; };
pool.query = async (sql, values) => { const release = await acquire(); try { return await query(sql, values); } finally { release(); } };
const { createResourceLimiter, limitConfig, resourceLimiter, ResourceLimitError, configureTrustedProxy, clientIp } = await import('../resource-limits.js');
const { deepseekChat } = await import('../deepseek.js');
const { forgotPasswordHandler, resetPasswordHandler } = await import('../auth.js');
const { handleAskInga } = await import('../ask-inga.js');
const { handleEstimateNutrition } = await import('../estimate-nutrition.js');
const { default: foodRouter } = await import('../routes/food-logs.js');
const { default: nutritionRouter } = await import('../routes/nutrition.js');
const { createSession } = await import('../sessions.js');
const users = [randomUUID(), randomUUID(), randomUUID()];
const tokens = [];
const migrations = new URL('../migrations/', import.meta.url);
const app = express(); app.use(express.json()); configureTrustedProxy(app, '');
app.get('/ip', (req, res) => res.json({ ip: clientIp(req) }));
app.use('/food-logs', foodRouter); app.use('/nutrition', nutritionRouter);
app.post('/ask-inga', handleAskInga); app.post('/estimate-nutrition', handleEstimateNutrition);
app.post('/forgot-password', forgotPasswordHandler);
app.post('/reset-password', resetPasswordHandler);
let server, base;
async function request(path, body, user = 0, extraHeaders = {}) {
  const response = await nativeFetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json',
      ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
const count = async table => Number((await pool.query(`SELECT count(*) AS n FROM public.${table}`)).rows[0].n);
const limiter = overrides => createResourceLimiter(pool, { ...limitConfig(), ...overrides });
const limited = promise => assert.rejects(promise, error => error instanceof ResourceLimitError);
const messages = [{ role: 'user', content: 'synthetic input' }];
const date = () => new Date().toISOString().slice(0, 10);

before(async () => {
  for (const filename of (await readdir(migrations)).filter(n => n.endsWith('.sql')).sort()) {
    await pg.exec(await readFile(new URL(filename, migrations), 'utf8'));
  }
  for (let i = 0; i < users.length; i++) {
    await pool.query('INSERT INTO public.users(user_id, name) VALUES ($1, $2)', [users[i], `Test ${i}`]);
    await pool.query('INSERT INTO public.app_credentials(user_id,email) VALUES ($1,$2)', [users[i], `test${i}@b3.invalid`]);
    await pool.query("INSERT INTO public.subscriptions(user_id,paid_until) VALUES ($1,now()+interval '1 day')", [users[i]]);
    await pool.query('INSERT INTO public.user_profile(user_id,current_weight_kg) VALUES ($1,70)', [users[i]]);
    const session = await createSession(pool, { user_id: users[i], email: `test${i}@b3.invalid` });
    tokens.push(session.access_token);
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  await pool.query('TRUNCATE public.resource_limit_buckets, public.ai_request_leases, public.password_reset_tokens, public.food_analysis, public.food_logs, public.daily_diet_analysis');
  providerCalls = []; mailCalls = []; providerAction = null; configureTrustedProxy(app, '');
});
after(async () => {
  globalThis.fetch = nativeFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await pg.close(); await pool.end();
});

test('B3: one user quota covers all four actual AI routes, while another account has its own quota', async () => {
  const meal = await request('/food-logs', { description: 'Суп' });
  assert.equal(meal.status, 200);
  assert.equal((await request(`/food-logs/${meal.body.log_id}/analyze`, {})).status, 200);
  assert.equal((await request(`/nutrition/analysis/${date()}`, { timezone: 'UTC' })).status, 200);
  assert.equal((await request('/ask-inga', { message: 'Что приготовить?' })).status, 200);
  const blocked = await request('/estimate-nutrition', { text: 'Каша' }, 0, { 'X-Real-IP': '198.51.100.99', 'X-Forwarded-For': '203.0.113.9' });
  assert.equal(blocked.status, 429); assert.equal(blocked.body.error, 'ai_limit');
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  assert.equal(providerCalls.length, 3);
  assert.equal((await request('/ask-inga', { message: 'Что приготовить?' }, 1)).status, 200);
  assert.equal(providerCalls.length, 4);
});

test('B3: changing meals or dates cannot bypass the quota; cached results and saving stay available', async () => {
  const first = await request('/food-logs', { description: 'Суп' });
  await request(`/food-logs/${first.body.log_id}/analyze`, {});
  await request(`/nutrition/analysis/${date()}`, { timezone: 'UTC' });
  await request('/ask-inga', { message: 'Что приготовить?' });
  assert.equal((await request(`/food-logs/${first.body.log_id}/analyze`, {})).status, 200);
  assert.equal((await request(`/nutrition/analysis/${date()}`, { timezone: 'UTC' })).status, 200);
  assert.equal(providerCalls.length, 3);
  const second = await request('/food-logs', { description: 'Яблоко' });
  assert.equal(second.status, 200);
  const blocked = await request(`/food-logs/${second.body.log_id}/analyze`, {});
  assert.equal(blocked.status, 429); assert.match(blocked.body.userMessage, /Ваши записи сохранены/);
  assert.equal((await request(`/nutrition/analysis/${date()}`, { timezone: 'UTC' })).status, 429);
  assert.equal((await request('/food-logs')).body.length, 2);
  assert.equal(providerCalls.length, 3);
  const safety = await request('/ask-inga', { message: 'У меня сильная слабость и головокружение' });
  assert.equal(safety.status, 200); assert.equal(safety.body.provider, 'local_safety');
  assert.equal(providerCalls.length, 3);
});

test('B3: unauthenticated and foreign-meal requests cannot spend someone else\'s quota', async () => {
  const meal = await request('/food-logs', { description: 'Суп' });
  assert.equal((await request(`/food-logs/${meal.body.log_id}/analyze`, {}, 1)).status, 404);
  assert.equal((await request('/ask-inga', { message: 'test' }, null)).status, 401);
  assert.equal(providerCalls.length, 0); assert.equal(await count('resource_limit_buckets'), 0);
});

test('B3: concurrent copies of one meal share one provider call', async () => {
  let release, entered;
  const started = new Promise(r => { entered = r; });
  providerAction = async () => { entered(); await new Promise(r => { release = r; }); return Response.json({ choices: [{ message: { content: JSON.stringify({ protein_g: 20, has_protein: true, confidence: 'low' }) } }] }); };
  const meal = await request('/food-logs', { description: 'Суп' });
  const first = request(`/food-logs/${meal.body.log_id}/analyze`, {});
  await started;
  const second = request(`/food-logs/${meal.body.log_id}/analyze`, {});
  // Let the second request reach the HTTP router before releasing the provider.
  await new Promise(r => setTimeout(r, 30)); release();
  assert.equal((await first).status, 200); assert.equal((await second).status, 200);
  assert.equal(providerCalls.length, 1);
});

test('B3: global and per-user concurrent leases are shared across limiter instances', async () => {
  const a = limiter({ concurrent: 2, userConcurrent: 1 });
  const b = limiter({ concurrent: 2, userConcurrent: 1 });
  await a.reserveAi(users[0], 100);
  await limited(b.reserveAi(users[0], 100));
  await b.reserveAi(users[1], 100);
  await limited(a.reserveAi(users[2], 100));
  assert.equal(await count('ai_request_leases'), 2);
});

test('B3: concurrent admissions never exceed one shared slot', async () => {
  const a = limiter({ concurrent: 1 }), b = limiter({ concurrent: 1 });
  const results = await Promise.allSettled([a.reserveAi(users[0], 100), b.reserveAi(users[1], 100)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await count('ai_request_leases'), 1);
});

test('B3: daily volume and call caps survive limiter recreation and reject before executing work', async () => {
  let calls = 0;
  await limiter({ dailyUnits: 150 }).runAi(users[0], 100, async () => { calls++; });
  await limited(limiter({ dailyUnits: 150 }).runAi(users[1], 100, async () => { calls++; }));
  assert.equal(calls, 1);
  await limited(limiter({ dailyCalls: 1 }).runAi(users[2], 1, async () => { calls++; }));
  assert.equal(calls, 1);
});

test('B3: failed provider releases its slot but keeps the budget reservation', async () => {
  const guard = limiter({ concurrent: 1 });
  await assert.rejects(guard.runAi(users[0], 100, async () => { throw new Error('provider failure'); }));
  assert.equal(await count('ai_request_leases'), 0);
  await guard.runAi(users[1], 100, async () => {});
  assert.equal(Number((await pool.query("SELECT units FROM public.resource_limit_buckets WHERE key='ai:global'")).rows[0].units), 200);
});

test('B3: expired crashed-worker leases and elapsed windows recover without a restart', async () => {
  const guard = limiter({ userHourly: 1, concurrent: 1 });
  await guard.reserveAi(users[0], 100);
  await pool.query("UPDATE public.ai_request_leases SET expires_at=now()-interval '1 second'");
  await pool.query("UPDATE public.resource_limit_buckets SET expires_at=now()-interval '1 second'");
  await guard.runAi(users[0], 100, async () => {});
  assert.equal(await count('ai_request_leases'), 0);
});

test('B3: oversized and ownerless provider requests fail before fetch; abort releases slot', async () => {
  await assert.rejects(deepseekChat(messages));
  await assert.rejects(deepseekChat(messages, { userId: users[0], maxTokens: 5000 }));
  await assert.rejects(deepseekChat([{ role: 'user', content: 'x'.repeat(200001) }], { userId: users[0] }));
  assert.equal(providerCalls.length, 0);
  let entered;
  const started = new Promise(r => { entered = r; });
  providerAction = async (_body, opts) => new Promise((_resolve, reject) => {
    entered(); opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true });
  });
  const controller = new AbortController();
  const pending = deepseekChat(messages, { userId: users[0], signal: controller.signal });
  await started; controller.abort(); await assert.rejects(pending);
  assert.equal(await count('ai_request_leases'), 0);
});

test('B3: quota database failure prevents provider calls', async () => {
  const guard = createResourceLimiter({ connect: async () => { throw new Error('DB unavailable'); } });
  let called = false;
  await assert.rejects(guard.runAi(users[0], 10, async () => { called = true; }));
  assert.equal(called, false);
});

test('B3: four simultaneous reset requests create exactly one token and one SMTP call', async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => request('/forgot-password', { email: ' Test0@B3.Invalid ' }, null)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 429, 429, 429]);
  assert.equal(await count('password_reset_tokens'), 1); assert.equal(mailCalls.length, 1);
  assert.match(results.find(r => r.status === 429).body.userMessage, /Если письмо уже пришло/);
  assert.match(mailCalls[0].text, /https:\/\/b3\.invalid\/reset-password/);
});

test('B3: unknown email gets the same success/cooldown responses without SMTP or account disclosure', async () => {
  const first = await request('/forgot-password', { email: 'unknown@b3.invalid' }, null);
  const repeated = await request('/forgot-password', { email: 'UNKNOWN@B3.INVALID' }, null);
  assert.equal(first.status, 200); assert.deepEqual(first.body, { ok: true });
  assert.equal(repeated.status, 429); assert.equal(repeated.body.error, 'password_reset_limit');
  assert.equal(mailCalls.length, 0); assert.equal(await count('password_reset_tokens'), 0);
});

test('B3: cooldown expiry allows resend; account hourly cap remains across IP changes', async () => {
  const guard = limiter({ resetAccount: 2 });
  await guard.reservePasswordReset('test0@b3.invalid', '198.51.100.1');
  await limited(guard.reservePasswordReset('test0@b3.invalid', '198.51.100.2'));
  await pool.query("UPDATE public.resource_limit_buckets SET expires_at=now()-interval '1 second' WHERE key LIKE 'reset:cooldown:%'");
  await guard.reservePasswordReset('test0@b3.invalid', '198.51.100.2');
  await pool.query("UPDATE public.resource_limit_buckets SET expires_at=now()-interval '1 second' WHERE key LIKE 'reset:cooldown:%'");
  await limited(guard.reservePasswordReset('test0@b3.invalid', '198.51.100.3'));
});

test('B3: reset IP and global caps cover multiple different email addresses', async () => {
  const guard = limiter({ resetIp: 1, resetGlobal: 2 });
  await guard.reservePasswordReset('one@b3.invalid', '198.51.100.1');
  await limited(guard.reservePasswordReset('two@b3.invalid', '198.51.100.1'));
  await guard.reservePasswordReset('two@b3.invalid', '198.51.100.2');
  await limited(guard.reservePasswordReset('three@b3.invalid', '198.51.100.3'));
  const { rows } = await pool.query("SELECT key FROM public.resource_limit_buckets WHERE key LIKE 'reset:%'");
  assert.ok(rows.every(row => !row.key.includes('@') && !row.key.includes('198.51')));
});

test('B3: spoofed forwarding headers are ignored; trusted proxy uses the nearest untrusted hop', async () => {
  let result = await request('/ip', undefined, null, { 'X-Real-IP': '198.51.100.5', 'X-Forwarded-For': '198.51.100.6' });
  assert.equal(result.body.ip, '127.0.0.1');
  configureTrustedProxy(app, '127.0.0.1/32');
  result = await request('/ip', undefined, null, { 'X-Real-IP': '198.51.100.5', 'X-Forwarded-For': '198.51.100.6, 203.0.113.7' });
  assert.equal(result.body.ip, '203.0.113.7');
  assert.throws(() => configureTrustedProxy(app, '0.0.0.0/0'));
  assert.throws(() => limitConfig({ AI_DAILY_MAX_CALLS: '0' }));
});

test('B3: migration can run again without removing quota or subscription data', async () => {
  await resourceLimiter.reservePasswordReset('test0@b3.invalid', '198.51.100.1');
  const beforeCount = await count('resource_limit_buckets');
  await pg.exec(await readFile(new URL('114_resource_limits.sql', migrations), 'utf8'));
  assert.equal(await count('resource_limit_buckets'), beforeCount);
  assert.equal(await count('subscriptions'), users.length);
});


test('B3: a blocked resend leaves the original recovery link usable once', async () => {
  assert.equal((await request('/forgot-password', { email: 'test2@b3.invalid' }, null)).status, 200);
  const link = mailCalls[0].text.match(/https:\/\/b3\.invalid\/reset-password[^\s]+/)[0];
  const token = new URL(link).searchParams.get('token');
  assert.ok(token);
  assert.equal((await request('/forgot-password', { email: 'test2@b3.invalid' }, null)).status, 429);
  assert.equal((await request('/reset-password', { token, new_password: 'synthetic-new-password' }, null)).status, 200);
  assert.equal((await request('/reset-password', { token, new_password: 'synthetic-new-password' }, null)).status, 400);
  assert.equal(mailCalls.length, 1);
});
