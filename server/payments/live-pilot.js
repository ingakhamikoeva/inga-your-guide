import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pool } from '../db.js';
import { PaymentError } from './errors.js';
import { addPeriod, newInvoice, receiptFor, validEmail } from './rules.js';
import { PILOT_AMOUNT, PILOT_VERSION, PILOT_CONSENT, pilotConfig, pilotForm, verifyPilotResult, isPilotInvoice } from './live-pilot-provider.js';

const { documents:{ offer } } = JSON.parse(readFileSync(new URL('../registration-legal-documents.json',import.meta.url),'utf8'));
const offerProof = { url:offer.url, version:offer.version, sha256:offer.sha256 };
const fail = (code,status=409) => { throw new PaymentError(code,status); };
const publicOrder = o => o ? { invoice:o.invoice, status:o.status, amount:o.amount, accessUntil:o.access_until } : null;

// A pool argument supports database tests without any HTTP or env mock hook.
export function createPilotService(database = pool) {
  async function tx(run) {
    const db = await database.connect();
    try { await db.query('BEGIN'); const value = await run(db); await db.query('COMMIT'); return value; }
    catch(e) { await db.query('ROLLBACK').catch(()=>{}); throw e; }
    finally { db.release(); }
  }
  async function account(db,user) {
    const { rows:[a] } = await db.query(`SELECT u.user_id,c.email,c.email_verified FROM public.users u
      JOIN public.app_credentials c USING(user_id) WHERE u.user_id=$1 FOR UPDATE OF u`,[user]);
    if (!a) fail('unauthorized',401);
    return a;
  }
  function allowed(user,c) { if (!c.user || user !== c.user) fail('pilot_unavailable',403); }
  return {
    async state(user) {
      let c; try { c=pilotConfig(); } catch { fail('pilot_unavailable',503); }
      allowed(user,c);
      return tx(async db => {
        const a = await account(db,user);
        const { rows:[order] } = await db.query('SELECT * FROM public.payment_pilot_orders WHERE singleton=1');
        const ownOrder = order?.user_id === user ? order : null;
        return { available:c.enabled && (!order || !!ownOrder), amount:PILOT_AMOUNT, recurring:false,
          emailVerified:!!a.email_verified && validEmail(a.email), consentVersion:PILOT_VERSION,
          consentText:PILOT_CONSENT, offer:offerProof, order:publicOrder(ownOrder) };
      });
    },
    async checkout(user,input) {
      let c; try { c=pilotConfig(); } catch { fail('pilot_unavailable',503); }
      allowed(user,c);
      if (!c.enabled) fail('pilot_disabled',503);
      if (input?.consent !== true || input.version !== PILOT_VERSION || input.offerHash !== offer.sha256
          || Object.keys(input).sort().join(',') !== 'consent,offerHash,version') fail('pilot_consent_required',400);
      return tx(async db => {
        const a = await account(db,user);
        if (!a.email_verified || !validEmail(a.email)) fail('email_not_verified',403);
        // Serialize the global one-payment limit, including different users.
        await db.query('SELECT pg_advisory_xact_lock(113,1)');
        let { rows:[o] } = await db.query('SELECT * FROM public.payment_pilot_orders WHERE singleton=1 FOR UPDATE');
        if (o && o.user_id !== user) fail('pilot_used',403);
        if (o?.status === 'paid') return { invoice:o.invoice,status:'paid' };
        if (o && a.email !== o.email) fail('email_changed',403);
        if (!o) {
          if ((await db.query("SELECT 1 FROM public.payment_orders WHERE user_id=$1 AND status='pending'",[user])).rowCount
              || (await db.query('SELECT 1 FROM public.payment_auto_renewal WHERE user_id=$1 AND (enabled OR initial_invoice IS NOT NULL)',[user])).rowCount) {
            fail('payment_pending');
          }
          const consent = { version:PILOT_VERSION,text:PILOT_CONSENT,accepted:true,recurring:false,
            amount:PILOT_AMOUNT,currency:'RUB',plan:'month',environment:'live',offer:offerProof,source:'payment-check' };
          const { rows } = await db.query(`INSERT INTO public.payment_pilot_orders
            (invoice,user_id,merchant_login,amount,nonce,email,receipt,consent_snapshot)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [newInvoice('live'),user,c.merchant,PILOT_AMOUNT,crypto.randomBytes(24).toString('hex'),a.email,receiptFor('month',PILOT_AMOUNT),consent]);
          o=rows[0];
          await db.query("INSERT INTO public.payment_pilot_events(invoice,type,details) VALUES($1,'consent',$2)",[o.invoice,consent]);
        }
        // Validate the form before committing an order; lost responses resume it.
        return pilotForm(o,c);
      });
    },
    async result(body) {
      if (!isPilotInvoice(body?.InvId)) fail('invalid_payment',400);
      const c=pilotConfig();
      return tx(async db => {
        const { rows:[found] } = await db.query('SELECT * FROM public.payment_pilot_orders WHERE invoice=$1',[body.InvId]);
        if (!found || !verifyPilotResult(body,found,c)) fail('invalid_payment',400);
        // Match checkout's lock order. Never use current allowlist/enable flag to
        // reject a valid notification for a previously created immutable order.
        await db.query('SELECT user_id FROM public.users WHERE user_id=$1 FOR UPDATE',[found.user_id]);
        const { rows:[o] } = await db.query('SELECT * FROM public.payment_pilot_orders WHERE invoice=$1 FOR UPDATE',[found.invoice]);
        if (!verifyPilotResult(body,o,c)) fail('invalid_payment',400);
        if (o.status === 'paid') return 'OK'+o.invoice;
        await db.query('INSERT INTO public.subscriptions(user_id) VALUES($1) ON CONFLICT DO NOTHING',[o.user_id]);
        const { rows:[sub] } = await db.query('SELECT *,clock_timestamp() AS server_now FROM public.subscriptions WHERE user_id=$1 FOR UPDATE',[o.user_id]);
        const starts = new Date(Math.max(new Date(sub.server_now).getTime(),
          ...[sub.paid_until,sub.trial_ends_at].filter(Boolean).map(value=>new Date(value).getTime())));
        const until = addPeriod(starts,'month');
        await db.query("UPDATE public.subscriptions SET paid_until=$2,subscription_status='active' WHERE user_id=$1",[o.user_id,until]);
        await db.query("UPDATE public.payment_pilot_orders SET status='paid',paid_at=clock_timestamp(),access_until=$2 WHERE invoice=$1",[o.invoice,until]);
        await db.query("INSERT INTO public.payment_pilot_events(invoice,type,details) VALUES($1,'paid',$2)",
          [o.invoice,{amount:PILOT_AMOUNT,environment:'live',source:'ResultURL',until:until.toISOString()}]);
        return 'OK'+o.invoice;
      });
    },
  };
}
export const livePilot = createPilotService();
