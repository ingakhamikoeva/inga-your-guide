import { addPeriod } from './rules.js';
import { activateOrAdvance } from './renewals.js';

export function payable(order) {
  return ['pending','failed','paid'].includes(order.status)
    && (order.kind !== 'renewal' || ['claimed','accepted','unknown'].includes(order.dispatch_state));
}

// Caller must hold user -> order locks and authenticate the provider evidence.
// Both ResultURL and a bound status response enter this single settlement path.
export async function settlePaidOrder(db, order, source) {
  if (order.status === 'paid') return;
  if (!payable(order)) throw new Error('payment_not_payable');
  await db.query('INSERT INTO public.subscriptions(user_id) VALUES($1) ON CONFLICT DO NOTHING', [order.user_id]);
  const { rows: [sub] } = await db.query('SELECT *,clock_timestamp() AS server_now FROM public.subscriptions WHERE user_id=$1 FOR UPDATE', [order.user_id]);
  const start = new Date(Math.max(new Date(sub.server_now).getTime(),
    ...[sub.paid_until,sub.trial_ends_at].filter(Boolean).map(value => new Date(value).getTime())));
  const end = addPeriod(start, order.plan);
  await db.query("UPDATE public.subscriptions SET paid_until=$2,subscription_status='active' WHERE user_id=$1", [order.user_id,end]);
  await db.query("UPDATE public.payment_orders SET status='paid',paid_at=clock_timestamp(),access_until=$2,status_next_check_at=NULL WHERE invoice=$1", [order.invoice,end]);
  await activateOrAdvance(db,order,end);
  if (order.special) await db.query('UPDATE public.payment_special_seats SET granted_at=COALESCE(granted_at,clock_timestamp()) WHERE user_id=$1', [order.user_id]);
  await db.query("INSERT INTO public.payment_events(invoice,type,details) VALUES($1,'paid',$2)",
    [order.invoice,{ amount: order.amount, until: end.toISOString(), environment: order.environment, source, afterFailure: order.status === 'failed' }]);
}
