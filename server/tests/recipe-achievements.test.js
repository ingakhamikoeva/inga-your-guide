import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { evaluate, RECIPE_IDS } from '../achievements/rules.js';
import { recipes, recipeIds } from '../nutrition/recipe-catalog.js';

const today = '2026-11-06';
const newIds = ['curd-galette', 'apple-roll', 'pumpkin-soup', 'kefir-chicken', 'cabbage-pie'];
const meal = (ids, day = today) => ({ datetime: `${day}T12:00:00Z`, raw_text: 'Лёгкий рецепт', meal_tag: 'lunch', meta: { lightSwap: { recipeIds: ids } } });
const earned = meals => evaluate({ meals, today });

test('all current recipes count, including the five additions', () => {
  assert.strictEqual(RECIPE_IDS, recipeIds);
  for (const id of new Set(recipes.map(recipe => recipe.id))) {
    const result = earned([meal([id])]);
    assert.equal(result.uniqueRecipes, 1, id);
    assert.ok(result.hits.some(hit => hit.id === 'swap-1'), id);
  }
  const five = earned(newIds.map(id => meal([id])));
  assert.equal(five.uniqueRecipes, 5);
  assert.deepEqual(five.hits.map(hit => hit.id), ['swap-1', 'swap-5']);
  const all = earned([meal([...recipeIds])]);
  assert.equal(all.uniqueRecipes, recipeIds.size);
  assert.ok(all.hits.some(hit => hit.id === 'swap-10'));
});

test('a future recipe added only to the shared server catalog counts without editing achievement rules', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'legche-i5-'));
  try {
    await mkdir(join(dir, 'achievements')); await mkdir(join(dir, 'nutrition'));
    await writeFile(join(dir, 'package.json'), '{"type":"module"}');
    await copyFile(new URL('../achievements/rules.js', import.meta.url), join(dir, 'achievements/rules.js'));
    await copyFile(new URL('../nutrition/recipe-catalog.js', import.meta.url), join(dir, 'nutrition/recipe-catalog.js'));
    const id = `future-recipe-${randomUUID()}`;
    await writeFile(join(dir, 'nutrition/recipes.json'), JSON.stringify([...recipes, { ...recipes[0], id }]));
    const input = JSON.stringify({ meals: [meal([id])], today });
    const output = execFileSync(process.execPath, ['--input-type=module', '-e',
      `import { evaluate } from './achievements/rules.js'; console.log(JSON.stringify(evaluate(${input})));`], { cwd: dir, encoding: 'utf8' });
    const result = JSON.parse(output);
    assert.equal(result.uniqueRecipes, 1);
    assert.deepEqual(result.hits.map(hit => hit.id), ['swap-1']);
    assert.deepEqual(result.hits[0].evidence.recipes, [id]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('repeats and duplicated categories count once; favorite needs three different dates', () => {
  const repeated = earned([meal(['curd-galette', 'curd-galette', 'varenie', 'pirozhki']), meal(['curd-galette'])]);
  assert.equal(repeated.uniqueRecipes, 3);
  assert.ok(!repeated.hits.some(hit => hit.id === 'favorite'));
  const favorite = earned(['2026-11-04', '2026-11-05', today].map(day => meal(['curd-galette'], day)));
  assert.equal(favorite.uniqueRecipes, 1);
  assert.ok(favorite.hits.some(hit => hit.id === 'favorite'));
});

test('viewing a recipe, unknown IDs, empty or future meals do not earn awards', () => {
  assert.equal(earned([]).uniqueRecipes, 0);
  const rows = [meal(['unknown-recipe']), { ...meal(newIds), raw_text: '' },
    { ...meal(newIds), meal_tag: 'chat' }, meal(newIds, '2026-11-07'),
    { ...meal(newIds), meta: { lightSwap: { recipeIds: 'curd-galette' } } }];
  assert.equal(earned(rows).uniqueRecipes, 0);
  assert.deepEqual(earned(rows).hits, []);
});

// Authenticated sync against actual PostgreSQL migrations (PGlite), no external AI.
const root = process.env.B3_PGLITE_ROOT;
const { PGlite } = await import(root ? pathToFileURL(`${root}/dist/index.js`).href : '@electric-sql/pglite');
const { pgcrypto } = await import(root ? pathToFileURL(`${root}/dist/contrib/pgcrypto.js`).href : '@electric-sql/pglite/contrib/pgcrypto');
Object.assign(process.env, { JWT_SECRET: 'synthetic-i5-secret-never-deployed', DATABASE_URL: '' });
const { pool } = await import('../db.js');
const db = new PGlite({ extensions: { pgcrypto } });
let tail = Promise.resolve();
async function acquire() { const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous; return release; }
async function query(sql, values) { const result = await db.query(sql, values); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; }
pool.connect = async () => { const release = await acquire(); return { query, release }; };
pool.query = async (sql, values) => { const release = await acquire(); try { return await query(sql, values); } finally { release(); } };
const { createSession } = await import('../sessions.js');
const { default: router } = await import('../routes/achievements.js');
const users = [randomUUID(), randomUUID()], tokens = [];
let server, base;
async function sync(user = 0, body = {}) {
  const response = await fetch(base + '/sync', { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }),
  }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function save(ids, user = 0) {
  const row = meal(ids);
  row.datetime = new Date(Date.now() - 86400000).toISOString();
  await pool.query(`INSERT INTO public.food_logs(log_id,user_id,datetime,raw_text,meal_tag,meta)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb)`, [randomUUID(), users[user], row.datetime, row.raw_text, row.meal_tag, JSON.stringify(row.meta)]);
}
before(async () => {
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
  for (let i = 0; i < users.length; i++) {
    await pool.query('INSERT INTO public.users(user_id,name) VALUES ($1,$2)', [users[i], `Synthetic ${i}`]);
    await pool.query('INSERT INTO public.app_credentials(user_id,email) VALUES ($1,$2)', [users[i], `i5-${i}@example.invalid`]);
    tokens.push((await createSession(pool, { user_id: users[i], email: `i5-${i}@example.invalid` })).access_token);
  }
  const app = express(); app.use(express.json()); app.use(router);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => { await pool.query('TRUNCATE public.food_logs, public.user_achievements CASCADE'); });
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await db.close(); await pool.end(); });

test('sync retroactively awards saved new recipes, repeats once and isolates users', async () => {
  for (const id of newIds) await save([id]);
  const results = await Promise.all(Array.from({ length: 4 }, () => sync()));
  for (const result of results) { assert.equal(result.status, 200); assert.equal(result.body.uniqueRecipes, 5); }
  assert.deepEqual(results.flatMap(result => result.body.newIds).sort(), ['swap-1', 'swap-5']);
  const other = await sync(1, { userId: users[0], meals: [meal(newIds)], uniqueRecipes: 10 });
  assert.equal(other.status, 200); assert.equal(other.body.uniqueRecipes, 0); assert.deepEqual(other.body.medals, []);
  const repeat = await sync();
  assert.deepEqual(repeat.body.newIds, []);
  assert.deepEqual(repeat.body.medals.map(medal => medal.id).sort(), ['swap-1', 'swap-5']);
  assert.equal((await sync(null)).status, 401);
});

test('progress changes only after a saved recipe; clearing its selection removes its contribution', async () => {
  assert.equal((await sync()).body.uniqueRecipes, 0);
  await save(['curd-galette', 'curd-galette']);
  await save(['curd-galette']);
  assert.equal((await sync()).body.uniqueRecipes, 1);
  await pool.query("UPDATE public.food_logs SET meta = '{}'::jsonb WHERE user_id=$1", [users[0]]);
  const result = await sync();
  assert.equal(result.body.uniqueRecipes, 0);
  // Earned medals remain historical, as before I5; no new award is issued.
  assert.deepEqual(result.body.newIds, []);
  assert.equal(result.body.medals.length, 1);
});
