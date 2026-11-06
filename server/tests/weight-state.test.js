// I3: authenticated weight/profile writes, PostgreSQL and downstream consumers.
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
  JWT_SECRET: 'synthetic-i3-secret-never-deployed', DATABASE_URL: '',
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
const { default: profileRouter } = await import('../routes/profile.js');
const { default: checkinRouter } = await import('../routes/checkins.js');
const { readSource, analyzeDay } = await import('../nutrition/day-analysis.js');
const { measurementDate } = await import('../weight-state.js');
const users = [randomUUID(), randomUUID()], tokens = [];
let server, base;
async function request(path, body, user = 0) {
  const res = await nativeFetch(base + path, { method: body === undefined ? 'GET' : path === '/ask-inga' ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}
before(async () => {
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) await database.exec(await readFile(new URL(file, dir), 'utf8'));
  for (let i = 0; i < users.length; i++) {
    await pool.query('INSERT INTO public.users(user_id,name) VALUES ($1,$2)', [users[i], `Synthetic ${i}`]);
    await pool.query('INSERT INTO public.app_credentials(user_id,email) VALUES ($1,$2)', [users[i], `i3-${i}@example.invalid`]);
    await pool.query("INSERT INTO public.subscriptions(user_id,paid_until) VALUES ($1, now()+interval '1 day')", [users[i]]);
    tokens.push((await createSession(pool, { user_id: users[i], email: `i3-${i}@example.invalid` })).access_token);
  }
  const app = express(); app.use(express.json()); app.post('/ask-inga', handleAskInga); app.use('/profile', profileRouter); app.use('/checkins', checkinRouter);
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  pool.query = originalQuery; calls = [];
  await pool.query('TRUNCATE public.food_logs CASCADE');
  await pool.query('TRUNCATE public.user_profile, public.user_plan');
  await pool.query('TRUNCATE public.daily_checkins, public.resource_limit_buckets, public.ai_request_leases');
  await pool.query("UPDATE public.subscriptions SET paid_until=now()+interval '1 day'");
});
after(async () => {
  globalThis.fetch = nativeFetch;
  if (server) await new Promise(r => server.close(r)); await database.close(); await pool.end();
});


const initial = { name: 'Synthetic', gender: 'female', height: 160, age: 50, weight: 60, goalWeight: 55, stepsPerDay: 5000 };
async function setupProfile(user = 0) {
  const result = await request('/profile', { ...initial, recordWeight: true, timezone: 'Europe/Moscow' }, user);
  assert.equal(result.status, 200); return result.body;
}

test('I3: onboarding returns distinct starting weight without creating a diary entry', async () => {
  const saved = await setupProfile();
  assert.deepEqual(saved.weightState, { weight: 60, startWeight: 60, weightDate: null });
  assert.deepEqual((await request('/checkins')).body, []);
  const profile = (await request('/profile')).body;
  assert.equal(profile.weight, 60); assert.equal(profile.startWeight, 60); assert.equal(profile.goalWeight, 55);
  await request('/profile', { weight: 61, recordWeight: true });
  assert.equal((await request('/profile')).body.startWeight, 60);
});

test('I3: morning measurement updates profile, server protein target and stale chat input', async () => {
  await setupProfile();
  const saved = await request('/checkins/2026-11-06', { weight: 58.3, sleepHours: 0, stepsYesterday: 0, stoolYesterday: false });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.weightState, { weight: 58.3, startWeight: 60, weightDate: '2026-11-06' });
  const profile = (await request('/profile')).body;
  assert.equal(profile.weight, 58.3); assert.equal(profile.startWeight, 60); assert.equal(profile.goalWeight, 55);
  const analysis = await analyzeDay(users[0], '2026-11-06', 'Europe/Moscow');
  assert.equal(analysis.facts.proteinTarget, 87);
  const chat = await request('/ask-inga', { message: 'Какой у меня вес?', userContext: { weight: 60 }, timezone: 'Europe/Moscow' });
  assert.equal(chat.status, 200);
  assert.match(calls.at(-1).messages[1].content, /58[.,]3/);
  assert.doesNotMatch(calls.at(-1).messages[1].content, /Вес: 60/);
});

test('I3: editing older dates and sleep-only writes never replace the latest measurement', async () => {
  await setupProfile();
  await request('/checkins/2026-11-06', { weight: 58.3, sleepHours: 0, stoolYesterday: false });
  await request('/checkins/2026-11-01', { weight: 59.5 });
  await request('/checkins/2026-11-06', { stepsYesterday: 0, weight: null });
  assert.equal((await request('/profile')).body.weight, 58.3);
  assert.deepEqual((await request('/checkins/2026-11-06')).body,
    { date: '2026-11-06', weight: 58.3, sleepHours: 0, stepsYesterday: 0, stoolYesterday: false });
  await request('/checkins/2026-11-06', { weight: 58.1 });
  assert.equal((await request('/profile')).body.weight, 58.1);
});

test('I3: existing stale profiles are correct on read before another measurement is saved', async () => {
  await setupProfile();
  await pool.query("INSERT INTO public.daily_checkins(user_id,date,weight_kg) VALUES ($1,'2026-11-05',58.3)", [users[0]]);
  assert.equal((await request('/profile')).body.weight, 58.3);
  assert.equal((await readSource(users[0], '2026-11-06', 'Europe/Moscow')).profile.current_weight_kg, 58.3);
  await request('/profile', { name: 'New name', weight: 60 }); // old/full client sync
  const after = (await request('/profile')).body;
  assert.equal(after.weight, 58.3); assert.equal(after.startWeight, 60); assert.equal(after.name, 'New name');
  assert.equal((await request('/checkins')).body.length, 1);
});

test('I3: an explicit profile weight edit updates today in the same history, preserving morning fields', async () => {
  await setupProfile();
  const today = measurementDate('Europe/Moscow');
  await request('/checkins/' + today, { weight: 58.3, sleepHours: 7, stepsYesterday: 4000, stoolYesterday: false });
  const saved = await request('/profile', { weight: 58.1, recordWeight: true, timezone: 'Europe/Moscow' });
  assert.equal(saved.status, 200); assert.equal(saved.body.weightState.weight, 58.1);
  assert.deepEqual((await request('/checkins/' + today)).body,
    { date: today, weight: 58.1, sleepHours: 7, stepsYesterday: 4000, stoolYesterday: false });
  assert.equal((await request('/profile')).body.startWeight, 60);
  assert.equal(measurementDate('America/Los_Angeles', new Date('2026-11-01T01:00:00Z')), '2026-10-31');
  assert.equal(measurementDate('Europe/Moscow', new Date('2026-11-01T01:00:00Z')), '2026-11-01');
});

test('I3: weight changes preserve saved calorie plan, manual food estimates and fixation state', async () => {
  await setupProfile();
  await pool.query("INSERT INTO public.user_plan(user_id,calorie_target,calorie_corridor_low,calorie_corridor_high) VALUES($1,1900,1500,1650)",[users[0]]);
  await pool.query("UPDATE public.user_profile SET current_stage='fixation', equilibrium_calories=1800, current_fixation_calories=1550 WHERE user_id=$1",[users[0]]);
  await pool.query("INSERT INTO public.food_logs(user_id,raw_text,meta) VALUES($1,'Manual', $2::jsonb)",[users[0],JSON.stringify({proteinManual:true,proteinAi:25})]);
  await request('/checkins/2026-11-06', { weight: 58.3 });
  const profile = (await request('/profile')).body;
  assert.equal(profile.currentStage, 'fixation'); assert.equal(profile.currentFixationCalories, 1550); assert.equal(profile.equilibriumCalories, 1800);
  const { rows:[plan] } = await pool.query('SELECT calorie_target,calorie_corridor_low,calorie_corridor_high FROM public.user_plan WHERE user_id=$1',[users[0]]);
  assert.deepEqual(Object.values(plan).map(Number), [1900,1500,1650]);
  assert.deepEqual((await pool.query('SELECT meta FROM public.food_logs WHERE user_id=$1',[users[0]])).rows[0].meta,{proteinManual:true,proteinAi:25});
});

test('I3: failed profile synchronization rolls back the measurement and its other fields', async () => {
  await setupProfile();
  const connect = pool.connect;
  pool.connect = async () => {
    const client = await connect(); const original = client.query;
    client.query = (sql, values) => /INSERT INTO public.user_profile/.test(sql)
      ? Promise.reject(new Error('synthetic profile write failure')) : original(sql, values);
    return client;
  };
  try { assert.equal((await request('/checkins/2026-11-06', { weight: 58.3, sleepHours: 5 })).status, 500); }
  finally { pool.connect = connect; }
  assert.equal((await request('/checkins/2026-11-06')).body, null);
  assert.equal((await request('/profile')).body.weight, 60);
});

test('I3: first diary-only measurement sets a stable baseline; backdated and concurrent writes use latest date', async () => {
  await request('/checkins/2026-11-04', { weight: 62 });
  assert.equal((await request('/profile')).body.startWeight, 62);
  const results = await Promise.all([
    request('/checkins/2026-11-06', { weight: 60 }), request('/checkins/2026-11-05', { weight: 61 }),
  ]);
  assert.ok(results.every(r=>r.status===200));
  const profile = (await request('/profile')).body;
  assert.equal(profile.weight, 60); assert.equal(profile.startWeight, 62);
});

test('I3: invalid weights and timezone cannot corrupt profile or create entries; owners stay isolated', async () => {
  await setupProfile(); await setupProfile(1);
  for (const weight of [0, -1, 1000, '58.3']) {
    assert.equal((await request('/profile', { weight, recordWeight: true })).status, 400);
    assert.equal((await request('/checkins/2026-11-06', { weight })).status, 400);
  }
  assert.equal((await request('/profile', { weight: 58.3, recordWeight: true, timezone: 'invalid/zone' })).status, 400);
  await request('/checkins/2026-11-06', { weight: 58.3, user_id: users[1] });
  assert.equal((await request('/profile', undefined, 1)).body.weight, 60);
  assert.equal((await request('/checkins', undefined, 1)).body.length, 0);
  assert.equal((await request('/profile', undefined, null)).status, 401);
});

test('I3: profile editor cannot bypass diary write access after subscription expiry', async () => {
  await setupProfile();
  const today = measurementDate();
  await request('/checkins/' + today, { weight: 58.3 });
  await pool.query("UPDATE public.subscriptions SET paid_until=now()-interval '1 day' WHERE user_id=$1",[users[0]]);
  assert.equal((await request('/profile', { weight: 58.1, recordWeight: true })).status, 403);
  assert.equal((await request('/checkins/' + today)).body.weight, 58.3);
  assert.equal((await request('/profile', { name: 'Still editable' })).status, 200);
});
