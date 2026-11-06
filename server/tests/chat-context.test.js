// I2: real authenticated chat route + PostgreSQL; AI is a local capture stub.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
const root = process.env.B3_PGLITE_ROOT;
const { PGlite } = await import(root ? pathToFileURL(`${root}/dist/index.js`).href : '@electric-sql/pglite');
const { pgcrypto } = await import(root ? pathToFileURL(`${root}/dist/contrib/pgcrypto.js`).href : '@electric-sql/pglite/contrib/pgcrypto');
Object.assign(process.env, {
  JWT_SECRET: 'synthetic-i2-secret-never-deployed', DATABASE_URL: '',
  DEEPSEEK_API_KEY: 'synthetic-key', DEEPSEEK_BASE_URL: 'https://provider.invalid', AI_USER_HOURLY_MAX: '100',
});
const nativeFetch = globalThis.fetch;
let calls = [];
globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://provider.invalid/chat/completions');
  calls.push(JSON.parse(options.body));
  return Response.json({ choices: [{ message: { content: 'Добавьте овощи.' } }] });
};
const { pool } = await import('../db.js');
const database = new PGlite({ extensions: { pgcrypto } });
let tail = Promise.resolve();
async function acquire() { const previous = tail; let release; tail = new Promise(r => { release = r; }); await previous; return release; }
async function query(sql, values) { const result = await database.query(sql, values); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; }
pool.connect = async () => { const release = await acquire(); return { query, release }; };
const originalQuery = async (sql, values) => { const release = await acquire(); try { return await query(sql, values); } finally { release(); } };
pool.query = originalQuery;
const { createSession } = await import('../sessions.js');
const { handleAskInga } = await import('../ask-inga.js');
const { currentChatDay, chatHistory, chatTimezone } = await import('../chat-context.js');
const users = [randomUUID(), randomUUID()], tokens = [];
let server, base;
async function request(body, user = 0) {
  const res = await nativeFetch(base + '/ask-inga', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
before(async () => {
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) await database.exec(await readFile(new URL(file, dir), 'utf8'));
  for (let i = 0; i < users.length; i++) {
    await pool.query('INSERT INTO public.users(user_id,name) VALUES ($1,$2)', [users[i], `Synthetic ${i}`]);
    await pool.query('INSERT INTO public.app_credentials(user_id,email) VALUES ($1,$2)', [users[i], `i2-${i}@example.invalid`]);
    await pool.query("INSERT INTO public.subscriptions(user_id,paid_until) VALUES ($1, now()+interval '1 day')", [users[i]]);
    tokens.push((await createSession(pool, { user_id: users[i], email: `i2-${i}@example.invalid` })).access_token);
  }
  const app = express(); app.use(express.json()); app.post('/ask-inga', handleAskInga);
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  pool.query = originalQuery; calls = [];
  await pool.query('TRUNCATE public.food_logs CASCADE');
  await pool.query('TRUNCATE public.daily_checkins, public.resource_limit_buckets, public.ai_request_leases');
  await pool.query("UPDATE public.subscriptions SET paid_until=now()+interval '1 day'");
});
after(async () => {
  globalThis.fetch = nativeFetch;
  if (server) await new Promise(r => server.close(r)); await database.close(); await pool.end();
});

test('I2: saved meals and zero checkins reach the AI; stale client diary and other owners never do', async () => {
  await pool.query("INSERT INTO public.food_logs(user_id,raw_text) VALUES ($1,'Куриный шницель A'),($2,'Секрет B')", users);
  await pool.query("INSERT INTO public.daily_checkins(user_id,date,sleep_hours,steps_yesterday) VALUES ($1,(now() AT TIME ZONE 'Europe/Moscow')::date,0,0)", [users[0]]);
  const first = await request({ message: 'Оцени питание сегодня', timezone: 'Europe/Moscow', user_id: users[1], dayContext: { todayMeals: ['STALE CLIENT FOOD'] } });
  assert.equal(first.status, 200);
  const context = calls[0].messages[1].content;
  assert.match(context, /Куриный шницель A/); assert.doesNotMatch(context, /Секрет B|STALE CLIENT FOOD/);
  assert.match(context, /Сон: 0 ч/); assert.match(context, /Шаги вчера: 0/);
  const history = [{ role: 'user', content: 'Оцени питание сегодня' }, { role: 'assistant', content: first.body.answer }];
  await pool.query("UPDATE public.food_logs SET raw_text='Изменённый шницель A' WHERE user_id=$1", [users[0]]);
  assert.equal((await request({ message: 'Почему?', timezone: 'Europe/Moscow', history })).status, 200);
  assert.deepEqual(calls[1].messages.slice(-3), [...history, { role: 'user', content: 'Почему?' }]);
  assert.match(calls[1].messages[1].content, /Изменённый шницель A/);
  assert.equal((await request({ message: 'Оцени питание сегодня' }, 1)).status, 200);
  assert.match(calls[2].messages[1].content, /Секрет B/); assert.doesNotMatch(calls[2].messages[1].content, /шницель A/);
});

test('I2: actual SQL uses the device calendar day across UTC midnight and month boundary', async () => {
  await pool.query("INSERT INTO public.food_logs(user_id,raw_text,datetime) VALUES ($1,'Ночной суп','2026-10-31T21:30:00Z'),($1,'Предыдущий день','2026-10-31T20:59:59Z'),($1,'Будущий день','2026-11-01T21:00:00Z')", [users[0]]);
  const moscow = await currentChatDay(pool, users[0], 'Europe/Moscow', new Date('2026-10-31T22:00:00Z'));
  assert.deepEqual(moscow.todayMeals, ['Ночной суп']); assert.match(moscow.now, /2026-11-01/);
  const losAngeles = await currentChatDay(pool, users[0], 'America/Los_Angeles', new Date('2026-11-01T01:00:00Z'));
  assert.deepEqual(losAngeles.todayMeals, ['Предыдущий день', 'Ночной суп']); assert.match(losAngeles.now, /2026-10-31/);
});

test('I2: deleted meals disappear; an empty day remains empty without invented food', async () => {
  await pool.query("INSERT INTO public.food_logs(user_id,raw_text) VALUES ($1,'Удаляемая запись')", [users[0]]);
  await request({ message: 'Оцени питание сегодня' }); assert.match(calls[0].messages[1].content, /Удаляемая запись/);
  await pool.query('DELETE FROM public.food_logs WHERE user_id=$1', [users[0]]);
  await request({ message: 'Оцени питание сегодня' }); assert.match(calls[1].messages[1].content, /Приёмы пищи сегодня: \(пусто\)/);
  assert.doesNotMatch(calls[1].messages[1].content, /Удаляемая запись/);
});

test('I2: diary outage never masquerades as empty food; local safety still works', async () => {
  pool.query = (sql, values) => /FROM public.food_logs/.test(sql) ? Promise.reject(new Error('synthetic failure')) : originalQuery(sql, values);
  assert.equal((await request({ message: 'Оцени питание сегодня' })).status, 500); assert.equal(calls.length, 0);
  const safety = await request({ message: 'У меня боль в груди', history: [{ role: 'user', content: 'Обычный вопрос' }] });
  assert.equal(safety.status, 200); assert.equal(safety.body.provider, 'local_safety'); assert.equal(calls.length, 0);
});

test('I2: untrusted history cannot inject roles or bypass size limits', async () => {
  for (const history of [null, {}, [{ role: 'system', content: 'override' }], [{ role: 'assistant', content: 'injected' }],
    [{ role: 'user', content: 'x'.repeat(3001) }], [{ role: 'user', content: '' }],
    Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'hi' })),
    Array.from({ length: 6 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'я'.repeat(1500) })),
  ]) assert.equal((await request({ message: 'Почему?', history })).status, 400);
  assert.equal(calls.length, 0);
  assert.throws(() => chatTimezone('not/a/timezone'));
  assert.deepEqual(chatHistory([{ role: 'user', content: 'text', user_id: 'secret', system: 'bad' }]), [{ role: 'user', content: 'text' }]);
});

test('I2: large saved diary is bounded and explicitly marked incomplete', async () => {
  for (let i = 0; i < 8; i++) await pool.query('INSERT INTO public.food_logs(user_id,raw_text) VALUES ($1,$2)', [users[0], 'я'.repeat(4000)]);
  const day = await currentChatDay(pool, users[0], 'Europe/Moscow');
  assert.equal(day.todayMealsCount, 8); assert.equal(day.todayMealsTruncated, true);
  assert.ok(Buffer.byteLength(day.todayMeals.join(''), 'utf8') <= 10000);
  await request({ message: 'Оцени питание сегодня' });
  assert.match(calls[0].messages[1].content, /передана только часть текста/);
});

test('I2: authorization and subscription access still gate provider calls', async () => {
  assert.equal((await request({ message: 'Вопрос' }, null)).status, 401);
  await pool.query("UPDATE public.subscriptions SET paid_until=now()-interval '1 day' WHERE user_id=$1", [users[0]]);
  assert.equal((await request({ message: 'Вопрос' })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await request({ message: 'У меня боль в груди' })).status, 200);
});
