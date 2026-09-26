import { pool } from './db.js';
import { requireAuthInline } from './middleware/auth.js';
import { getAccess } from './access.js';

export async function handleStartTrial(req, res) {
  const auth = await requireAuthInline(req, res);
  if (!auth) return;
  try {
    // Atomic first start, including an empty placeholder row. Retries cannot
    // reset dates or overwrite access previously granted by a promo/payment.
    await pool.query(`
      INSERT INTO public.subscriptions (user_id, trial_started_at, trial_ends_at, subscription_status)
      VALUES ($1, now(), now() + interval '168 hours', 'active')
      ON CONFLICT (user_id) DO UPDATE
        SET trial_started_at = EXCLUDED.trial_started_at,
            trial_ends_at = EXCLUDED.trial_ends_at,
            subscription_status = EXCLUDED.subscription_status
        WHERE public.subscriptions.trial_started_at IS NULL
          AND public.subscriptions.trial_ends_at IS NULL
          AND public.subscriptions.paid_until IS NULL`, [auth.authId]);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, access: await getAccess(auth.authId) });
  } catch {
    console.error('start-trial failed');
    res.status(503).json({ error: 'trial_start_failed' });
  }
}
