// Authenticated HTTP routes against an isolated PostgreSQL-compatible database.
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
const root = process.env.B3_PGLITE_ROOT;
const { PGlite } = await import(root ? pathToFileURL(`${root}/dist/index.js`).href : '@electric-sql/pglite');
const { pgcrypto } = await import(root ? pathToFileURL(`${root}/dist/contrib/pgcrypto.js`).href : '@electric-sql/pglite/contrib/pgcrypto');
Object.assign(process.env, { JWT_SECRET: 'synthetic-water-test-secret', DATABASE_URL: '' });
const { pool } = await import('../db.js');
const database = new PGlite({ extensions: { pgcrypto } });
const query = async (sql, values) => {
  const result = await database.query(sql, values);
  return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
};
pool.query = query;
pool.connect = async () => ({ query, release() {} });
const { createSession } = await import('../sessions.js');
const { default: water } = await import('../routes/water.js');
const users = [randomUUID(), randomUUID()], sessions = [];
let server, base;
async function request(path = '/2026-11-15', user = 0, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...(user === null ? {} : { Authorization: `Bearer ${sessions[user].access_token}` }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
before(async () => {
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) {
    await database.exec(await readFile(new URL(file, dir), 'utf8'));
  }
  for (let i = 0; i < users.length; i++) {
    await query('INSERT INTO public.users(user_id,name) VALUES ($1,$2)', [users[i], `Water ${i}`]);
    await query('INSERT INTO public.app_credentials(user_id,email) VALUES ($1,$2)', [users[i], `water-${i}@example.invalid`]);
    sessions.push(await createSession(pool, { user_id: users[i], email: `water-${i}@example.invalid` }));
  }
  const app = express(); app.use(express.json()); app.use(water);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  pool.query = query;
  await query('TRUNCATE public.daily_water');
  for (const id of users) await query(`INSERT INTO public.subscriptions(user_id,paid_until) VALUES ($1,now()+interval '1 day')
    ON CONFLICT (user_id) DO UPDATE SET paid_until=EXCLUDED.paid_until`, [id]);
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await database.close(); await pool.end(); });

test('water persists across a new login session, including zero and more than six glasses', async () => {
  assert.deepEqual((await request()).body, { glasses: 0, revision: 0 });
  assert.deepEqual((await request(undefined, 0, { glasses: 8, revision: 0 })).body, { glasses: 8, revision: 1 });
  sessions[0] = await createSession(pool, { user_id: users[0], email: 'water-0@example.invalid' });
  const read = await request();
  assert.deepEqual(read.body, { glasses: 8, revision: 1 }); assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal((await request(undefined, 0, { glasses: 0, revision: 1 })).status, 200);
  assert.deepEqual((await request()).body, { glasses: 0, revision: 2 });
  assert.equal((await query('SELECT count(*) FROM public.daily_checkins')).rows[0].count, 0);
});

test('authentication, owner isolation and separate calendar days', async () => {
  assert.equal((await request(undefined, null)).status, 401);
  assert.equal((await request(undefined, null, { glasses: 3, revision: 0 })).status, 401);
  await request('/2026-11-15', 0, { glasses: 3, revision: 0, user_id: users[1] });
  assert.deepEqual((await request(`/2026-11-15?user_id=${users[0]}`, 1)).body, { glasses: 0, revision: 0 });
  assert.deepEqual((await request('/2026-11-16')).body, { glasses: 0, revision: 0 });
  await request('/2026-11-16', 0, { glasses: 1, revision: 0 });
  assert.equal((await request('/2026-11-15')).body.glasses, 3);
});

test('stale device and late retries cannot replace a newer value', async () => {
  const first = { glasses: 2, revision: 0 };
  const results = await Promise.all([request(undefined, 0, first), request(undefined, 0, first)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal((await request(undefined, 0, { glasses: 4, revision: 1 })).status, 200);
  assert.equal((await request(undefined, 0, first)).status, 409);
  assert.equal((await request(undefined, 0, { glasses: 3, revision: 1 })).status, 409);
  assert.deepEqual((await request()).body, { glasses: 4, revision: 2 });
});

test('invalid counts and invalid calendar dates are rejected', async () => {
  for (const glasses of [-1, 1.5, '2', null, 1001]) assert.equal((await request(undefined, 0, { glasses, revision: 0 })).status, 400);
  for (const revision of [-1, 1.5, '0', null]) assert.equal((await request(undefined, 0, { glasses: 1, revision })).status, 400);
  for (const date of ['bad', '2026-02-30', '2026-13-01', '0000-01-01']) {
    assert.equal((await request('/' + date)).status, 400);
    assert.equal((await request('/' + date, 0, { glasses: 1, revision: 0 })).status, 400);
  }
  assert.equal((await request('/2024-02-29', 0, { glasses: 1, revision: 0 })).status, 200);
});

test('expired subscription can read saved water but cannot change it', async () => {
  await request(undefined, 0, { glasses: 2, revision: 0 });
  await query("UPDATE public.subscriptions SET paid_until=now()-interval '1 day' WHERE user_id=$1", [users[0]]);
  assert.equal((await request()).body.glasses, 2);
  assert.equal((await request(undefined, 0, { glasses: 3, revision: 1 })).status, 403);
  assert.equal((await request()).body.glasses, 2);
});

test('database failure is reported instead of returning a false zero or a successful write', async () => {
  pool.query = (sql, values) => /public.daily_water/.test(sql) ? Promise.reject(new Error('synthetic database failure')) : query(sql, values);
  assert.equal((await request()).status, 503);
  assert.equal((await request(undefined, 0, { glasses: 1, revision: 0 })).status, 503);
});

test('migration can be reapplied without losing existing water records', async () => {
  await request(undefined, 0, { glasses: 3, revision: 0 });
  await database.exec(await readFile(new URL('../migrations/116_daily_water.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await request()).body, { glasses: 3, revision: 1 });
});
