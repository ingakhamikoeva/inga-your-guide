// I1: actual authenticated routes against isolated in-memory PostgreSQL.
// PGlite is a separate test dependency; set B3_PGLITE_ROOT as in the B3/B5 tests.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';
import pgDriver from 'pg';
const root = process.env.B3_PGLITE_ROOT;
const { PGlite } = await import(root ? pathToFileURL(`${root}/dist/index.js`).href : '@electric-sql/pglite');
const { pgcrypto } = await import(root ? pathToFileURL(`${root}/dist/contrib/pgcrypto.js`).href : '@electric-sql/pglite/contrib/pgcrypto');
Object.assign(process.env, { JWT_SECRET: 'synthetic-i1-secret-never-deployed', DATABASE_URL: '' });
const { pool } = await import('../db.js');
const database = new PGlite({ extensions: { pgcrypto } });
const originalQuery = async (sql, values) => {
  const result = await database.query(sql, values);
  // Use production pg's DATE parser. Returning DATE (OID 1082) must fail
  // the response contract just as it does with node-postgres in production.
  for (const field of result.fields) {
    if (field.dataTypeID === 1082) for (const row of result.rows) {
      if (row[field.name] != null) row[field.name] = pgDriver.types.getTypeParser(1082)(row[field.name]);
    }
  }
  return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
};
pool.query = originalQuery;
pool.connect = async () => ({ query: originalQuery, release() {} });
const { createSession } = await import('../sessions.js');
const { default: checkins } = await import('../routes/checkins.js');
const { default: diary } = await import('../routes/diary.js');
const app = express(); app.use(express.json()); app.use('/checkins', checkins); app.use('/diary', diary);
const users = [randomUUID(), randomUUID()]; const tokens = [];
let server, base;
async function request(path, user = 0, body) {
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, headers: res.headers, body: await res.json() };
}
before(async () => {
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) await database.exec(await readFile(new URL(file, dir), 'utf8'));
  for (let i = 0; i < users.length; i++) {
    await pool.query('INSERT INTO public.users(user_id,name) VALUES ($1,$2)', [users[i], `Synthetic ${i}`]);
    await pool.query('INSERT INTO public.app_credentials(user_id,email) VALUES ($1,$2)', [users[i], `i1-${i}@example.invalid`]);
    await pool.query("INSERT INTO public.subscriptions(user_id,paid_until) VALUES ($1, now()+interval '1 day')", [users[i]]);
    tokens.push((await createSession(pool, { user_id: users[i], email: `i1-${i}@example.invalid` })).access_token);
  }
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(r => server.close(r)); await database.close(); await pool.end(); });

test('I1: saved checkin returns exact calendar date in list, single read and diary', async () => {
  for (const date of ['2024-02-29', '2026-10-31', '2026-11-01', '2026-12-31', '2027-01-01']) {
    assert.equal((await request(`/checkins/${date}`, 0, { weight: 58.3, sleepHours: 0, stepsYesterday: 0, stoolYesterday: false })).status, 200);
    const read = await request(`/checkins/${date}`);
    assert.equal(read.status, 200); assert.deepEqual(read.body, { date, weight: 58.3, sleepHours: 0, stepsYesterday: 0, stoolYesterday: false });
  }
  const list = await request('/checkins');
  assert.deepEqual(list.body.map(c => c.date), ['2024-02-29', '2026-10-31', '2026-11-01', '2026-12-31', '2027-01-01']);
  const archive = await request('/diary');
  assert.equal(archive.status, 200); assert.equal(archive.headers.get('cache-control'), 'no-store');
  assert.deepEqual(archive.body.checkins.map(c => c.date).sort(), list.body.map(c => c.date));
});
test('I1: partial weight update preserves sleep, steps and false; repeat read is stable', async () => {
  await request('/checkins/2026-11-01', 0, { weight: 58.1 });
  const result = await request('/checkins/2026-11-01');
  assert.deepEqual(result.body, { date: '2026-11-01', weight: 58.1, sleepHours: 0, stepsYesterday: 0, stoolYesterday: false });
  assert.deepEqual((await request('/checkins/2026-11-01')).body, result.body);
});
test('I1: diary food and checkins remain isolated by authenticated owner', async () => {
  await pool.query("INSERT INTO public.food_logs(user_id,raw_text,datetime) VALUES ($1,'Суп A','2026-10-31T21:30:00Z')", [users[0]]);
  await pool.query("INSERT INTO public.food_logs(user_id,raw_text,datetime) VALUES ($1,'Суп B','2026-10-31T22:00:00Z')", [users[1]]);
  await request('/checkins/2026-11-01', 1, { weight: 72 });
  const a = await request(`/diary?user_id=${users[1]}`);
  const b = await request('/diary', 1);
  assert.deepEqual(a.body.meals.map(m => m.raw_text), ['Суп A']);
  assert.deepEqual(b.body.meals.map(m => m.raw_text), ['Суп B']);
  assert.equal(Number(b.body.checkins[0].weight_kg), 72);
  assert.equal((await request('/checkins/2026-10-31', 1)).body, null);
  assert.equal((await request('/diary', null)).status, 401);
  assert.equal((await request('/checkins', null)).status, 401);
});
test('I1: expired subscription still reads and exports existing records; writes stay blocked', async () => {
  await pool.query("UPDATE public.subscriptions SET paid_until=now()-interval '1 day' WHERE user_id=$1", [users[0]]);
  assert.equal((await request('/diary')).body.meals[0].raw_text, 'Суп A');
  assert.equal((await request('/checkins')).status, 200);
  assert.equal((await request('/checkins/2026-11-01')).body.date, '2026-11-01');
  assert.equal((await request('/checkins/2026-11-01', 0, { weight: 50 })).status, 403);
  assert.equal((await request('/checkins/2026-11-01')).body.weight, 58.1);
});
test('I1: database failure returns an error, never an apparently empty diary', async () => {
  pool.query = (sql, values) => /FROM public.food_logs/.test(sql) ? Promise.reject(new Error('synthetic read failure')) : originalQuery(sql, values);
  try {
    const result = await request('/diary'); assert.equal(result.status, 503); assert.deepEqual(result.body, { error: 'diary_unavailable' });
  } finally { pool.query = originalQuery; }
});
