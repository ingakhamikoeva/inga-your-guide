import crypto from 'node:crypto';
import { pool } from '../db.js';
import { assertTestEnvironment, config, sendRecurring } from './provider.js';
import { PaymentError } from './errors.js';
import { GRACE_MS, HOUR, newInvoice, receiptFor, validEmail } from './rules.js';
import { sendRenewalNotice } from './renewal-mailer.js';

const NOTICE_MS = 72 * HOUR;
const epochMatches = (a, b) => String(a) === String(b);
const dateMs = value => new Date(value).getTime();
const event = (db, user, epoch, type, details = {}) => db.query(
  'INSERT INTO public.payment_renewal_events(user_id,epoch,type,details) VALUES($1,$2,$3,$4)',
  [user, epoch, type, details]);

async function userTransaction(user, run) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const found = await db.query('SELECT user_id FROM public.users WHERE user_id=$1 FOR UPDATE', [user]);
    if (!found.rowCount) throw new PaymentError('unauthorized', 401);
    const value = await run(db);
    await db.query('COMMIT');
    return value;
  } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
  finally { db.release(); }
}

// Caller already holds the same user row lock used by checkout/callback/cancel.
export async function initialIntent(db, order) {
  const { rows: [schedule] } = await db.query(`
    INSERT INTO public.payment_auto_renewal(user_id,epoch,initial_invoice)
    VALUES($1,1,$2) ON CONFLICT(user_id) DO UPDATE
    SET epoch=payment_auto_renewal.epoch+1,enabled=false,initial_invoice=$2,
        parent_invoice=NULL,next_due=NULL,stopped_reason=NULL,updated_at=clock_timestamp()
    RETURNING *`, [order.user_id, order.invoice]);
  await db.query('UPDATE public.payment_orders SET renewal_epoch=$2 WHERE invoice=$1', [order.invoice, schedule.epoch]);
  await event(db, order.user_id, schedule.epoch, 'intent', { invoice: order.invoice, consent: order.consent_snapshot });
}

export async function activateOrAdvance(db, order, until) {
  if (!['initial', 'renewal'].includes(order.kind)) return;
  const { rows: [s] } = await db.query('SELECT * FROM public.payment_auto_renewal WHERE user_id=$1 FOR UPDATE', [order.user_id]);
  if (!s || !epochMatches(s.epoch, order.renewal_epoch)) return;
  if (order.kind === 'initial' && s.initial_invoice === order.invoice) {
    await db.query(`UPDATE public.payment_auto_renewal SET enabled=true,initial_invoice=NULL,
      parent_invoice=$2,next_due=$3,stopped_reason=NULL,updated_at=clock_timestamp() WHERE user_id=$1`,
    [order.user_id, order.invoice, until]);
    await event(db, order.user_id, s.epoch, 'activated', { invoice: order.invoice, due: until });
  } else if (order.kind === 'renewal' && s.enabled && s.parent_invoice === order.parent_invoice) {
    await db.query('UPDATE public.payment_auto_renewal SET next_due=$2,updated_at=clock_timestamp() WHERE user_id=$1', [order.user_id, until]);
  }
}

export async function renewalSummary(db, user) {
  const { rows: [s] } = await db.query(`SELECT a.*,p.plan,p.amount,p.special,GREATEST(s.paid_until,s.trial_ends_at) AS paid_until,
      c.charge_at,c.notice_sent_at,c.invoice AS cycle_invoice
    FROM public.payment_auto_renewal a
    LEFT JOIN public.payment_orders p ON p.invoice=COALESCE(a.parent_invoice,a.initial_invoice)
    LEFT JOIN public.subscriptions s ON s.user_id=a.user_id
    LEFT JOIN public.payment_renewal_cycles c ON c.user_id=a.user_id AND c.epoch=a.epoch AND c.due_at=GREATEST(s.paid_until,s.trial_ends_at)
    WHERE a.user_id=$1`, [user]);
  if (!s) return { enabled: false, pendingActivation: false, paused: false };
  return { enabled: s.enabled, pendingActivation: !!s.initial_invoice, paused: !!s.stopped_reason,
    plan: s.plan, amount: s.amount, special: s.special,
    dueAt: s.paid_until, chargeAt: s.charge_at, noticeSentAt: s.notice_sent_at,
    awaitingPayment: !!s.cycle_invoice };
}

export async function cancelRenewal(user) {
  // Cancellation works even with payments disabled or missing SMTP/provider keys.
  assertTestEnvironment();
  return userTransaction(user, async db => {
    const { rows: [s] } = await db.query('SELECT * FROM public.payment_auto_renewal WHERE user_id=$1 FOR UPDATE', [user]);
    if (s && (s.enabled || s.initial_invoice)) {
      await db.query(`UPDATE public.payment_auto_renewal SET enabled=false,initial_invoice=NULL,
        epoch=epoch+1,stopped_reason=NULL,updated_at=clock_timestamp() WHERE user_id=$1`, [user]);
      await event(db, user, s.epoch, 'cancelled', { source: 'account', parent: s.parent_invoice, initial: s.initial_invoice });
    }
    return { cancelled: true };
  });
}

async function pause(db, s, reason) {
  await db.query(`UPDATE public.payment_auto_renewal SET enabled=false,epoch=epoch+1,
    stopped_reason=$2,updated_at=clock_timestamp() WHERE user_id=$1`, [s.user_id, reason]);
  await event(db, s.user_id, s.epoch, 'paused', { reason });
}
async function context(db, user) {
  const { rows: [s] } = await db.query(`SELECT a.*,c.email,c.email_verified,s.paid_until,s.trial_ends_at,
      clock_timestamp() AS server_now
    FROM public.payment_auto_renewal a
    JOIN public.app_credentials c USING(user_id)
    LEFT JOIN public.subscriptions s USING(user_id)
    WHERE a.user_id=$1 FOR UPDATE OF a`, [user]);
  if (!s?.enabled) return null;
  const { rows: [parent] } = await db.query('SELECT * FROM public.payment_orders WHERE invoice=$1', [s.parent_invoice]);
  if (!parent || parent.kind !== 'initial' || parent.status !== 'paid'
      || !epochMatches(parent.renewal_epoch, s.epoch) || parent.user_id !== user
      || !s.email_verified || !validEmail(s.email) || s.email !== parent.email) {
    await pause(db, s, 'authorization_changed'); return null;
  }
  // Promo codes and other legitimate paid access can move the next charge.
  const due = Math.max(dateMs(s.paid_until), s.trial_ends_at ? dateMs(s.trial_ends_at) : 0);
  if (!Number.isFinite(due)) { await pause(db, s, 'missing_access'); return null; }
  if (dateMs(s.next_due) !== due) {
    await db.query('UPDATE public.payment_auto_renewal SET next_due=$2 WHERE user_id=$1', [user, new Date(due)]);
  }
  return { s, parent, due };
}

// Dependencies are injected only by local verification, never from HTTP/env.
// Production clock always comes from PostgreSQL; no acceleration flags exist.
export async function runRenewals({ sendNotice = sendRenewalNotice, sendCharge = sendRecurring, clock } = {}) {
  const c = config();
  if (!c.enabled || !c.recurringEnabled) return;
  const { rows: users } = await pool.query('SELECT user_id FROM public.payment_auto_renewal WHERE enabled ORDER BY next_due LIMIT 1000');
  for (const { user_id: user } of users) {
    try {
      const invoice = await userTransaction(user, async db => {
        const ctx = await context(db, user); if (!ctx) return null;
        const { s, parent, due } = ctx;
        if (parent.merchant_login !== c.merchant || parent.environment !== 'test') {
          await pause(db, s, 'merchant_changed'); return null;
        }
        const now = clock ? clock() : dateMs(s.server_now);
        if (now < due - NOTICE_MS - 10 * 60000) return null;
        const { rows: [cycle] } = await db.query(`SELECT * FROM public.payment_renewal_cycles
          WHERE user_id=$1 AND epoch=$2 AND due_at=$3 FOR UPDATE`, [user, s.epoch, new Date(due)]);
        // A durable dispatch claim is never re-sent, including after a crash.
        if (cycle?.invoice) return null;
        if (now > due + GRACE_MS) { await pause(db, s, 'renewal_window_expired'); return null; }
        if (!cycle?.notice_sent_at) {
          // No warning in time -> no automatic charge. User can renew manually.
          if (cycle?.notice_attempted_at && now - dateMs(cycle.notice_attempted_at) < HOUR) return null;
          const chargeAt = new Date(Math.max(due, now + NOTICE_MS + 5 * 60000));
          if (dateMs(chargeAt) > due + GRACE_MS) { await pause(db, s, 'notice_too_late'); return null; }
          await db.query(`INSERT INTO public.payment_renewal_cycles(user_id,epoch,due_at,charge_at)
            VALUES($1,$2,$3,$4) ON CONFLICT(user_id,epoch,due_at) DO UPDATE SET charge_at=$4`,
          [user, s.epoch, new Date(due), chargeAt]);
          await db.query('UPDATE public.payment_renewal_cycles SET notice_attempted_at=$4 WHERE user_id=$1 AND epoch=$2 AND due_at=$3', [user, s.epoch, new Date(due), new Date(now)]);
          const sent = await sendNotice({ email: s.email, amount: parent.amount, plan: parent.plan, chargeAt });
          if (!sent) return null;
          const acceptedAt = clock ? clock() : dateMs((await db.query('SELECT clock_timestamp() AS now')).rows[0].now);
          if (dateMs(chargeAt) - acceptedAt < NOTICE_MS) return null;
          await db.query(`UPDATE public.payment_renewal_cycles SET notice_sent_at=$4,notice_email=$5
            WHERE user_id=$1 AND epoch=$2 AND due_at=$3`, [user, s.epoch, new Date(due), new Date(acceptedAt), s.email]);
          await event(db, user, s.epoch, 'reminder', { due: new Date(due), chargeAt, amount: parent.amount, plan: parent.plan });
          return null;
        }
        if (now < dateMs(cycle.charge_at) || now - dateMs(cycle.notice_sent_at) < NOTICE_MS) return null;
        if (cycle.notice_email !== s.email) { await pause(db, s, 'notice_recipient_changed'); return null; }
        if ((await db.query("SELECT 1 FROM public.payment_orders WHERE user_id=$1 AND status='pending'", [user])).rowCount) return null;
        const id = newInvoice('test');
        const proof = { ...parent.consent_snapshot, source: 'renewal', parentInvoice: parent.invoice,
          originalConsentAt: parent.consent_at, renewalDueAt: new Date(due), noticeSentAt: cycle.notice_sent_at, chargeAt: cycle.charge_at };
        await db.query(`INSERT INTO public.payment_orders(invoice,user_id,merchant_login,nonce,quote_digest,
          plan,amount,special,email,receipt,consent_snapshot,kind,renewal_epoch,parent_invoice,dispatch_state,consent_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'renewal',$12,$13,'claimed',$14)`,
        [id, user, c.merchant, crypto.randomBytes(24).toString('hex'), 'renewal:' + s.epoch + ':' + due,
          parent.plan, parent.amount, parent.special, s.email, receiptFor(parent.plan, parent.amount), proof, s.epoch, parent.invoice, parent.consent_at]);
        await db.query('UPDATE public.payment_renewal_cycles SET invoice=$4 WHERE user_id=$1 AND epoch=$2 AND due_at=$3',
          [user, s.epoch, new Date(due), id]);
        await event(db, user, s.epoch, 'dispatch', { invoice: id });
        return id;
      });
      if (invoice) await dispatchClaim(user, invoice, sendCharge, clock);
    } catch { console.error('[payments] renewal_worker_failed'); }
  }
}

async function dispatchClaim(user, invoice, sendCharge, clock) {
  // Claim was COMMITTED before any network request. If this transaction crashes,
  // that claim remains and no worker will blindly retry an uncertain charge.
  await userTransaction(user, async db => {
    const { rows: [o] } = await db.query('SELECT * FROM public.payment_orders WHERE invoice=$1 FOR UPDATE', [invoice]);
    if (o.status !== 'pending' || o.dispatch_state !== 'claimed') return;
    const ctx = await context(db, user);
    const cfg = config();
    const { rows: [cycle] } = await db.query('SELECT * FROM public.payment_renewal_cycles WHERE invoice=$1', [invoice]);
    const now = clock ? clock() : dateMs((await db.query('SELECT clock_timestamp() AS now')).rows[0].now);
    if (!ctx || !cfg.enabled || !cfg.recurringEnabled || !epochMatches(ctx.s.epoch, o.renewal_epoch)
        || ctx.due !== dateMs(cycle?.due_at) || cycle.notice_email !== ctx.s.email
        || now < dateMs(cycle.charge_at) || now - dateMs(cycle.notice_sent_at) < NOTICE_MS
        || now > ctx.due + GRACE_MS) {
      await db.query("UPDATE public.payment_orders SET status='void',dispatch_state='cancelled' WHERE invoice=$1", [invoice]);
      return;
    }
    // Keep the user lock until the attempt returns. Cancel cannot succeed and
    // then be followed by a new outgoing charge from this worker.
    let outcome = 'unknown';
    try { outcome = await sendCharge(o, ctx.parent); } catch { /* ambiguous: never retry */ }
    if (outcome !== 'accepted') outcome = 'unknown';
    await db.query('UPDATE public.payment_orders SET dispatch_state=$2 WHERE invoice=$1', [invoice, outcome]);
    await event(db, user, o.renewal_epoch, 'provider_response', { invoice, outcome });
  });
}

export function startRenewalScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runRenewals(); } catch { console.error('[payments] renewal_scheduler_unavailable'); }
    finally { running = false; }
  };
  // Default off; unlike EMAIL_DRIP_ENABLED this is a service payment notice.
  if (process.env.PAYMENTS_RECURRING_ENABLED !== 'true') return;
  void tick();
  const timer = setInterval(tick, 60000); timer.unref();
}
