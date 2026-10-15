import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pool } from '../db.js';
import { assertTestEnvironment, config, form, verify } from './provider.js';
import { PRICES, GRACE_MS, addPeriod, newInvoice, receiptFor, validEmail } from './rules.js';

export const CONSENT_VERSION = 'subscription-2026-10-14-v2';
export const CONSENT_TEXT = 'Я согласен на автоматические списания согласно условиям оферты';
export const SPECIAL_PRICE_TERMS = 'Спеццена сохраняется при непрерывном продлении. Если оплата не прошла, у вас есть ещё 3 дня после окончания оплаченного периода, чтобы продлить подписку по прежней цене. До оплаты новые записи и платные функции будут недоступны. Дневник останется доступен для просмотра и скачивания.';
const { documents: { offer } } = JSON.parse(readFileSync(new URL('../registration-legal-documents.json', import.meta.url), 'utf8'));
const offerProof = { url: offer.url, version: offer.version, sha256: offer.sha256 };
import { PaymentError } from './errors.js';
import { initialIntent, renewalSummary } from './renewals.js';
export { PaymentError } from './errors.js';
import { payable, settlePaidOrder } from './settlement.js';
const fail = (code,status) => { throw new PaymentError(code,status); };
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
async function transaction(run) {
  const db=await pool.connect();
  try { await db.query('BEGIN'); const result=await run(db); await db.query('COMMIT'); return result; }
  catch(e) { await db.query('ROLLBACK').catch(()=>{}); throw e; }
  finally { db.release(); }
}
async function owner(db,user) {
  // One lock order for checkout and callbacks: user -> order -> subscription.
  const r=await db.query(`SELECT u.user_id,c.email,c.email_verified,clock_timestamp() AS server_now,
    s.paid_until,s.trial_ends_at FROM public.users u
    JOIN public.app_credentials c USING(user_id) LEFT JOIN public.subscriptions s USING(user_id)
    WHERE u.user_id=$1 FOR UPDATE OF u`,[user]);
  if (!r.rows[0]) fail('unauthorized',401);
  return r.rows[0];
}
const periodStart = a => new Date(Math.max(new Date(a.server_now).getTime(),
  ...[a.paid_until,a.trial_ends_at].filter(Boolean).map(d=>new Date(d).getTime())));
async function price(db,user,plan,now) {
  if (!Object.hasOwn(PRICES,plan)) fail('invalid_plan',400);
  const last=(await db.query("SELECT special,access_until FROM public.payment_orders WHERE user_id=$1 AND status='paid' ORDER BY paid_at DESC,invoice DESC LIMIT 1",[user])).rows[0];
  let special;
  if (last) special=last.special && new Date(now).getTime()<=new Date(last.access_until).getTime()+GRACE_MS;
  else special=(await db.query('SELECT 1 FROM public.payment_special_seats WHERE user_id=$1 OR user_id IS NULL LIMIT 1',[user])).rowCount>0;
  return {special,amount:PRICES[plan][special?'founder':'normal']};
}
function mac(raw) {
  if (!process.env.JWT_SECRET) throw new Error('payments_not_configured');
  return crypto.createHmac('sha256',process.env.JWT_SECRET).update('payment-quote-v1:'+raw).digest('base64url');
}
function sign(q) { const raw=Buffer.from(JSON.stringify(q)).toString('base64url'); return raw+'.'+mac(raw); }
function read(token,user,c) {
  if(typeof token!=='string'||token.length>8000) fail('quote_invalid',400);
  const [raw,sig,...rest]=token.split('.'); const expected=mac(raw);
  if(rest.length||typeof sig!=='string'||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) fail('quote_invalid',400);
  let q;try {q=JSON.parse(Buffer.from(raw,'base64url').toString());}catch{fail('quote_invalid',400);}
  if(q.user!==user||q.environment!=='test'||q.merchant!==c.merchant||q.consentVersion!==CONSENT_VERSION||q.offerHash!==offer.sha256)fail('quote_invalid',400);
  return q;
}
function publicOrder(o, now) { return { verification: o.status === 'pending' && o.kind === 'renewal' ? (new Date(now).getTime() - new Date(o.created_at).getTime() >= 86400000 ? 'delayed' : 'waiting') : null, invoice:o.invoice,plan:o.plan,amount:o.amount,special:o.special,status:o.status,createdAt:o.created_at,accessUntil:o.access_until,recurring:o.kind==='initial',canResume:o.kind!=='renewal' && o.status==='pending' }; }
export async function state(user) {
  try {assertTestEnvironment();}catch{return {available:false,testOnly:true,quotes:[],orders:[]};}
  let c;try {c=config();}catch{c={enabled:false,recurringEnabled:false};}
  return transaction(async db=>{
    const a=await owner(db,user);
    const orders=(await db.query(`SELECT * FROM public.payment_orders WHERE user_id=$1 AND status<>'void' ORDER BY (status='pending') DESC,created_at DESC LIMIT 10`,[user])).rows;
    const renewal=await renewalSummary(db,user);
    const quotes=[];
    if(c.enabled&&!renewal.enabled&&a.email_verified&&validEmail(a.email)&&!orders.some(o=>o.status==='pending')) {
      for(const plan of ['month','year']) {
        const p=await price(db,user,plan,a.server_now);
        const startsAt=periodStart(a).toISOString(),renewsAt=addPeriod(startsAt,plan).toISOString();
        const q={id:crypto.randomUUID(),user,recurring:c.recurringEnabled,environment:'test',merchant:c.merchant,plan,...p,startsAt,renewsAt,
          expires:new Date(a.server_now).getTime()+15*60000,consentVersion:CONSENT_VERSION,offerHash:offer.sha256};
        quotes.push({id:q.id,recurring:q.recurring,plan,...p,startsAt,renewsAt,expiresAt:new Date(q.expires).toISOString(),
          consentText:CONSENT_TEXT,consentVersion:CONSENT_VERSION,offer:offerProof,specialPriceTerms:SPECIAL_PRICE_TERMS,
          reminderDays:3,token:sign(q)});
      }
    }
    return {available:c.enabled,testOnly:true,autoRenew:renewal.enabled,renewal,recurringAvailable:c.enabled&&c.recurringEnabled,emailVerified:!!a.email_verified,quotes,orders:orders.map(o=>publicOrder(o,a.server_now))};
  });
}
export async function checkout(user,input) {
  const c=config();if(!c.enabled)fail('payments_disabled',503);
  if(input?.consent!==true)fail('consent_required',400);
  const q=read(input.quote,user,c);
  const o=await transaction(async db=>{
    const a=await owner(db,user);
    if(!a.email_verified||!validEmail(a.email))fail('email_not_verified',403);
    const quoteDigest=digest(input.quote);
    const existing=(await db.query('SELECT * FROM public.payment_orders WHERE user_id=$1 AND quote_digest=$2',[user,quoteDigest])).rows[0];
    // Lost response/repeated click keeps the exact original immutable invoice.
    if(existing)return existing;
    if(q.recurring!==c.recurringEnabled)fail('quote_expired');
    if((await renewalSummary(db,user)).enabled)fail('renewal_active');
    if(q.expires<new Date(a.server_now).getTime())fail('quote_expired');
    if((await db.query("SELECT 1 FROM public.payment_orders WHERE user_id=$1 AND status='pending'",[user])).rowCount)fail('payment_pending');
    // Serialize allocation of the 100th discount across different users.
    await db.query('SELECT pg_advisory_xact_lock(107,1)');
    const p=await price(db,user,q.plan,a.server_now);
    if(p.amount!==q.amount||p.special!==q.special)fail('price_changed');
    const consent={version:CONSENT_VERSION,text:CONSENT_TEXT,accepted:true,testOnly:true,recurring:q.recurring,
      plan:q.plan,amount:q.amount,currency:'RUB',special:q.special,startsAt:q.startsAt,renewsAt:q.renewsAt,
      period:q.plan==='month'?'calendar_month':'calendar_year',timezone:'Europe/Moscow',reminderDays:3,
      specialPriceTerms:SPECIAL_PRICE_TERMS,offer:offerProof,source:'checkout'};
    const invoice=newInvoice('test');
    const r=await db.query(`INSERT INTO public.payment_orders(invoice,user_id,merchant_login,nonce,quote_digest,plan,amount,special,email,receipt,consent_snapshot,kind)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [invoice,user,c.merchant,crypto.randomBytes(24).toString('hex'),quoteDigest,q.plan,p.amount,p.special,a.email,receiptFor(q.plan,p.amount),consent,q.recurring?'initial':'manual']);
    if(q.recurring)await initialIntent(db,r.rows[0]);
    if(p.special) {
      const seat=(await db.query('SELECT seat FROM public.payment_special_seats WHERE user_id=$1 OR user_id IS NULL ORDER BY user_id NULLS LAST,seat LIMIT 1 FOR UPDATE',[user])).rows[0];
      if(!seat)fail('price_changed');
      await db.query('UPDATE public.payment_special_seats SET user_id=$2,invoice=$3 WHERE seat=$1',[seat.seat,user,invoice]);
    }
    await db.query("INSERT INTO public.payment_events(invoice,type,details) VALUES($1,'consent',$2)",[invoice,consent]);
    return r.rows[0];
  });
  if(o.status==='paid')return {invoice:o.invoice,status:'paid'};
  if(o.status!=='pending')fail('payment_not_found',404);
  return {invoice:o.invoice,status:o.status,recurring:o.kind==='initial',...form(o,c)};
}
// Recover an interrupted redirect without creating another invoice or consent.
export async function resume(user, invoice) {
  const c=config();if(!c.enabled)fail('payments_disabled',503);
  if(typeof invoice!=='string'||!/^1\d{17}$/.test(invoice))fail('invalid_payment',400);
  const o=await transaction(async db=>{
    const a=await owner(db,user);
    const order=(await db.query('SELECT * FROM public.payment_orders WHERE invoice=$1 AND user_id=$2 FOR UPDATE',[invoice,user])).rows[0];
    if(!order||!['pending','paid'].includes(order.status))fail('payment_not_found',404);
    if(order.kind==='renewal')fail('payment_processing');
    if(order.status==='paid')return order;
    if(!a.email_verified||!validEmail(a.email)||a.email!==order.email)fail('email_not_verified',403);
    return order;
  });
  if(o.status==='paid')return {invoice:o.invoice,status:'paid'};
  if(o.status!=='pending')fail('payment_not_found',404);
  return {invoice:o.invoice,status:o.status,recurring:o.kind==='initial',...form(o,c)};
}
export async function result(body) {
  const c=config(); // Callback remains valid after PAYMENTS_ENABLED is turned off.
  if(typeof body?.InvId!=='string'||!/^1\d{17}$/.test(body.InvId))fail('invalid_payment',400);
  return transaction(async db=>{
    const order=(await db.query('SELECT * FROM public.payment_orders WHERE invoice=$1',[body.InvId])).rows[0];
    if(!order||!payable(order)||!verify(body,order,c))fail('invalid_payment',400);
    const a=await owner(db,order.user_id);
    const locked=(await db.query('SELECT * FROM public.payment_orders WHERE invoice=$1 FOR UPDATE',[order.invoice])).rows[0];
    if(!payable(locked))fail('invalid_payment',400);
    await settlePaidOrder(db,locked,'ResultURL');
    return 'OK'+order.invoice;
  });
}
