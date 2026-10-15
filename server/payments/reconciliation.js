import { pool } from '../db.js';
import { queryOperationState, statusChecksEnabled } from './status-provider.js';
import { payable, settlePaidOrder } from './settlement.js';

const MINUTE = 60000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const ms = value => new Date(value).getTime();
const unknown = () => ({ resultCode: null, stateCode: null, outcome: 'unknown' });

// Test doubles are supplied only by local tests; no HTTP or env simulation hook.
export async function runPaymentReconciliation({ lookup = queryOperationState, clock, environment = 'live' } = {}) {
  if (lookup === queryOperationState && (!statusChecksEnabled() || environment !== 'live')) return;
  const { rows: candidates } = await pool.query(`SELECT invoice,user_id FROM public.payment_orders
    WHERE environment=$1 AND kind='renewal' AND status='pending'
      AND dispatch_state IN ('claimed','accepted','unknown')
      AND COALESCE(status_next_check_at,created_at+interval '5 minutes') <= COALESCE($2::timestamptz,clock_timestamp())
    ORDER BY COALESCE(status_next_check_at,created_at+interval '5 minutes'),invoice LIMIT 20`,
    [environment,clock ? new Date(clock()) : null]);
  for (const candidate of candidates) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT user_id FROM public.users WHERE user_id=$1 FOR UPDATE', [candidate.user_id]);
      const { rows: [o] } = await db.query('SELECT *,clock_timestamp() AS server_now FROM public.payment_orders WHERE invoice=$1 FOR UPDATE', [candidate.invoice]);
      const now = clock ? clock() : ms(o.server_now);
      const firstCheck = ms(o.created_at) + 5 * MINUTE;
      if (o.status !== 'pending' || !payable(o) || o.environment !== environment
          || now < firstCheck || (o.status_next_check_at && now < ms(o.status_next_check_at))) {
        await db.query('COMMIT'); continue;
      }
      // Read-only network request under the common lock. Concurrent callbacks,
      // cancellations and other workers cannot apply conflicting transitions.
      let status;
      try { status = await lookup(o); } catch { status = unknown(); }
      if (!status || !['unknown','pending','paid','terminal'].includes(status.outcome)) status = unknown();
      let outcome = 'unknown', terminalAt = null, terminalCode = null;
      const dayCheck = ms(o.created_at) + DAY;
      const nextCheck = now < dayCheck ? Math.min(now + HOUR,dayCheck) : now + HOUR;
      if (status.resultCode === 0 && status.outcome === 'paid' && status.stateCode === 100) {
        await settlePaidOrder(db,o,'OpStateExt'); outcome = 'paid';
      } else if (status.resultCode === 0 && status.outcome === 'terminal' && [10,60].includes(status.stateCode)) {
        terminalCode = status.stateCode;
        terminalAt = o.terminal_state_code === terminalCode && o.terminal_seen_at ? o.terminal_seen_at : new Date(now);
        outcome = 'terminal_observed';
        // A first negative answer does not immediately open another charge.
        // Require a fresh matching answer after 24h AND a separate observation.
        if (now >= dayCheck && now - ms(terminalAt) >= 5 * MINUTE) {
          await db.query("UPDATE public.payment_orders SET status='failed',failed_at=$2 WHERE invoice=$1", [o.invoice,new Date(now)]);
          const stopped = await db.query(`UPDATE public.payment_auto_renewal SET enabled=false,initial_invoice=NULL,
            epoch=epoch+1,stopped_reason='payment_failed',updated_at=clock_timestamp()
            WHERE user_id=$1 AND epoch=$2 AND parent_invoice=$3 RETURNING user_id`, [o.user_id,o.renewal_epoch,o.parent_invoice]);
          if (stopped.rowCount) await db.query(`INSERT INTO public.payment_renewal_events(user_id,epoch,type,details)
            VALUES($1,$2,'paused',$3)`, [o.user_id,o.renewal_epoch,{ reason:'payment_failed',invoice:o.invoice,stateCode:status.stateCode }]);
          outcome = 'failed';
        }
      } else if (status.resultCode === 0 && status.outcome === 'pending') outcome = 'pending';
      await db.query(`UPDATE public.payment_orders SET status_checked_at=$2,status_next_check_at=$3,
        status_result_code=$4,status_state_code=$5,terminal_seen_at=$6,terminal_state_code=$7 WHERE invoice=$1`,
      [o.invoice,new Date(now),['paid','failed'].includes(outcome) ? null : new Date(nextCheck),
        Number.isInteger(status.resultCode) ? status.resultCode : null,
        Number.isInteger(status.stateCode) ? status.stateCode : null,terminalAt,terminalCode]);
      await db.query(`INSERT INTO public.payment_status_checks(invoice,checked_at,result_code,state_code,outcome)
        VALUES($1,$2,$3,$4,$5)`, [o.invoice,new Date(now),Number.isInteger(status.resultCode) ? status.resultCode : null,
        Number.isInteger(status.stateCode) ? status.stateCode : null,outcome]);
      await db.query('COMMIT');
    } catch {
      await db.query('ROLLBACK').catch(() => {});
      console.error('[payments] status_check_failed');
    } finally { db.release(); }
  }
}

export function startPaymentStatusScheduler() {
  if (!statusChecksEnabled()) return;
  let running = false;
  const tick = async () => {
    if (running) return; running = true;
    try { await runPaymentReconciliation(); }
    catch { console.error('[payments] status_scheduler_unavailable'); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick,MINUTE); timer.unref();
}
