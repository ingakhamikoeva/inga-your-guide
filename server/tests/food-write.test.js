// I4: authenticated weight/profile writes, PostgreSQL and downstream consumers.
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
  JWT_SECRET: 'synthetic-i4-secret-never-deployed', DATABASE_URL: '',
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
const { default: foodRouter } = await import('../routes/food-logs.js');
const { analyzeSavedMeal } = await import('../nutrition/meal-estimation.js');
const { createFoodLog } = await import('../nutrition/food-write.js');
const { readSource, fingerprint } = await import('../nutrition/day-analysis.js');
const users = [randomUUID(), randomUUID()], tokens = [];
let server, base;
async function request(method, path='', body, user=0) {
  const res=await nativeFetch(base+'/food-logs'+path,{method,headers:{'Content-Type':'application/json',...(user===null?{}:{Authorization:`Bearer ${tokens[user]}`})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,body:await res.json()};
}
before(async () => {
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(n => n.endsWith('.sql')).sort()) await database.exec(await readFile(new URL(file, dir), 'utf8'));
  for (let i = 0; i < users.length; i++) {
    await pool.query('INSERT INTO public.users(user_id,name) VALUES ($1,$2)', [users[i], `Synthetic ${i}`]);
    await pool.query('INSERT INTO public.app_credentials(user_id,email) VALUES ($1,$2)', [users[i], `i4-${i}@example.invalid`]);
    await pool.query("INSERT INTO public.subscriptions(user_id,paid_until) VALUES ($1, now()+interval '1 day')", [users[i]]);
    tokens.push((await createSession(pool, { user_id: users[i], email: `i4-${i}@example.invalid` })).access_token);
  }
  const app = express(); app.use(express.json()); app.use('/food-logs', foodRouter);
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  pool.query = originalQuery; calls = [];
  await pool.query('TRUNCATE public.food_write_requests, public.food_logs CASCADE');
  await pool.query('TRUNCATE public.user_profile, public.user_plan');
  await pool.query('TRUNCATE public.daily_checkins, public.resource_limit_buckets, public.ai_request_leases');
  await pool.query("UPDATE public.subscriptions SET paid_until=now()+interval '1 day'");
});
after(async () => {
  globalThis.fetch = nativeFetch;
  if (server) await new Promise(r => server.close(r)); await database.close(); await pool.end();
});

const meal = () => ({description:'Шницель',mealTag:'lunch',datetime:'2026-11-06T12:00:00Z',meta:{},requestId:randomUUID()});
const estimate = {protein_g:25,has_protein:true,has_carbs:false,has_fiber:false,confidence:'low'};
const tea = {...estimate,protein_g:0,has_protein:false};
async function count() { return Number((await pool.query('SELECT count(*) FROM public.food_logs')).rows[0].count); }
function deferred() { let resolve; const promise=new Promise(r=>{resolve=r;});return{promise,resolve}; }

test('I4: lost reply and concurrent retries return one saved meal',async()=>{
  const payload=meal();
  const results=await Promise.all(Array.from({length:6},()=>request('POST','',payload)));
  assert.ok(results.every(r=>r.status===200));
  assert.equal(new Set(results.map(r=>r.body.log_id)).size,1);assert.equal(await count(),1);
  const again=await request('POST','',payload);
  assert.equal(again.body.log_id,results[0].body.log_id);
});

test('I4: action keys are owner-scoped and intentional second meals remain possible',async()=>{
  const payload=meal();
  const a=await request('POST','',payload), b=await request('POST','',payload,1);
  assert.notEqual(a.body.log_id,b.body.log_id);
  assert.equal((await request('PATCH','/'+a.body.log_id,{description:'Чужая еда'},1)).status,404);
  assert.equal((await request('POST','', {...payload,requestId:randomUUID()})).status,200);
  assert.equal((await request('POST','',payload,null)).status,401);
  assert.equal(await count(),3);
});

test('I4: same key with another payload fails; changed metadata key order does not',async()=>{
  const payload={...meal(),meta:{sweet:false,isEvening:false}};
  const a=await request('POST','',payload);
  const reordered=await request('POST','',{...payload,meta:{isEvening:false,sweet:false}});
  assert.equal(reordered.body.log_id,a.body.log_id);
  assert.equal((await request('POST','',{...payload,description:'Чай'})).status,409);
  assert.equal(await count(),1);
});

test('I4: retry after editing returns latest row; retry after deletion cannot resurrect it',async()=>{
  const payload=meal();const saved=(await request('POST','',payload)).body;
  await request('PATCH','/'+saved.log_id,{description:'Зелёный чай',resetComposition:true});
  assert.equal((await request('POST','',payload)).body.raw_text,'Зелёный чай');
  assert.equal((await request('DELETE','/'+saved.log_id)).status,200);
  assert.equal((await request('POST','',payload)).status,410);assert.equal(await count(),0);
});

test('I4: failed insert rolls back action reservation and retry succeeds',async()=>{
  const payload=meal(), originalConnect=pool.connect;
  const db={connect:async()=>{const client=await originalConnect();return {...client,query:(sql,args)=>/INSERT INTO public.food_logs/.test(sql)?Promise.reject(new Error('synthetic insert failure')):client.query(sql,args)};}};
  const {requestId,...input}=payload;
  await assert.rejects(createFoodLog(db,users[0],input,requestId),/synthetic/);
  assert.equal((await pool.query('SELECT * FROM public.food_write_requests')).rows.length,0);
  assert.equal((await request('POST','',payload)).status,200);assert.equal(await count(),1);
});

test('I4: changed text clears old composition, manual values and recipe credit, then recalculates',async()=>{
  const payload={...meal(),meta:{nutritionVersion:3,nutrition:estimate,proteinAi:25,proteinManual:true,protein:true,proteinFlagManual:true,carbs:true,carbsFlagManual:true,fiber:false,fiberFlagManual:true,sweet:true,proteinPortion:'large',lightSwap:{recipeIds:['bliny'],savedKcal:100},isEvening:true,unrelated:'keep'}};
  const saved=(await request('POST','',payload)).body;
  const oldHash=fingerprint(await readSource(users[0],'2026-11-06','UTC'));
  assert.equal((await request('PATCH','/'+saved.log_id,{description:'Зелёный чай'})).status,409);
  const changed=await request('PATCH','/'+saved.log_id,{description:'Зелёный чай',resetComposition:true});
  assert.equal(changed.status,200);
  assert.deepEqual(changed.body.meta,{isEvening:true,unrelated:'keep',compositionRevision:1});
  let calls=0;const result=await analyzeSavedMeal(users[0],saved.log_id,pool,async text=>{calls++;assert.equal(text,'Зелёный чай');return tea;});
  assert.equal(calls,1);assert.equal(result.meta.proteinAi,0);assert.equal(result.meta.protein,false);
  assert.equal(result.meta.nutritionVersion,3);assert.equal(result.meta.lightSwap,undefined);
  assert.notEqual(fingerprint(await readSource(users[0],'2026-11-06','UTC')),oldHash);
  const savings=(await request('GET','/savings?month=2026-11')).body;
  assert.equal(savings.total_kcal,0);assert.equal(savings.swaps_count,0);
});

test('I4: time-only and unchanged description retain manual data and recipe attribution',async()=>{
  const meta={nutritionVersion:3,proteinAi:37,proteinManual:true,protein:false,proteinFlagManual:true,lightSwap:{recipeIds:['bliny'],savedKcal:100}};
  const saved=(await request('POST','',{...meal(),meta})).body;
  const changed=(await request('PATCH','/'+saved.log_id,{description:'Шницель',resetComposition:true,datetime:'2026-11-06T13:00:00Z',mealTag:'snack',meta:{sweet:true}})).body;
  assert.equal(changed.datetime,'2026-11-06T13:00:00.000Z');assert.equal(changed.meal_tag,'snack');
  assert.deepEqual(changed.meta,{...meta,sweet:true,compositionRevision:0});
  await analyzeSavedMeal(users[0],saved.log_id,pool,async()=>{assert.fail('must reuse current estimate');});
});

test('I4: old AI response cannot overwrite new text, even after changing text back',async()=>{
  const saved=(await request('POST','',meal())).body;
  const ready=deferred(),slow=deferred();
  const old=analyzeSavedMeal(users[0],saved.log_id,pool,async()=>{ready.resolve();return slow.promise;});
  await ready.promise;
  await request('PATCH','/'+saved.log_id,{description:'Зелёный чай',resetComposition:true});
  await request('PATCH','/'+saved.log_id,{description:'Шницель',resetComposition:true});
  const fresh=await analyzeSavedMeal(users[0],saved.log_id,pool,async()=>({...estimate,protein_g:30}));
  assert.equal(fresh.meta.proteinAi,30);
  slow.resolve(estimate);await old;
  assert.equal((await request('GET')).body[0].meta.proteinAi,30);
});

test('I4: manual correction made while estimating still wins under row lock',async()=>{
  const saved=(await request('POST','',meal())).body;
  const ready=deferred(),slow=deferred();
  const pending=analyzeSavedMeal(users[0],saved.log_id,pool,async()=>{ready.resolve();return slow.promise;});
  await ready.promise;
  await request('PATCH','/'+saved.log_id,{meta:{proteinAi:40,proteinManual:true,fiber:false,fiberFlagManual:true}});
  slow.resolve({...estimate,has_fiber:true});const result=await pending;
  assert.equal(result.meta.proteinAi,40);assert.equal(result.meta.fiber,false);
});

test('I4: provider failure keeps edited text and unknown composition, never stale protein',async()=>{
  const saved=(await request('POST','',{...meal(),meta:{nutritionVersion:3,proteinAi:25}})).body;
  await request('PATCH','/'+saved.log_id,{description:'Зелёный чай',resetComposition:true});
  await assert.rejects(analyzeSavedMeal(users[0],saved.log_id,pool,async()=>{throw new Error('provider failed');}));
  const current=(await request('GET')).body[0];
  assert.equal(current.raw_text,'Зелёный чай');assert.equal(current.meta.proteinAi,undefined);
  assert.equal(current.meta.nutritionVersion,undefined);
  assert.equal((await analyzeSavedMeal(users[0],saved.log_id,pool,async()=>tea)).meta.proteinAi,0);
});

test('I4: invalid writes fail and additive migration can be applied again',async()=>{
  assert.equal((await request('POST','',{...meal(),requestId:'bad'})).status,400);
  assert.equal((await request('POST','',{...meal(),description:' '})).status,400);
  const payload=meal();await request('POST','',payload);
  await database.exec(await readFile(new URL('../migrations/115_food_write_requests.sql',import.meta.url),'utf8'));
  assert.equal((await request('POST','',payload)).status,200);assert.equal(await count(),1);
  await pool.query("UPDATE public.subscriptions SET paid_until=now()-interval '1 day',trial_ends_at=now()-interval '1 day'");
  assert.equal((await request('POST','',meal())).status,403);
});
