import { pool } from "./db.js";
import { requireAuthInline } from "./middleware/auth.js";

export async function handleStartTrial(req, res) {
  const auth = await requireAuthInline(req, res);
  if (!auth) return;
  const userId = auth.authId;

  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM public.subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (existing.length) return res.json({ ok: true, message: "Trial already exists" });

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO public.subscriptions (user_id, trial_started_at, trial_ends_at, subscription_status)
       VALUES ($1, $2, $3, 'active')`,
      [userId, now.toISOString(), trialEnd.toISOString()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("start-trial failed:", e);
    res.status(500).json({ error: "Failed to start trial" });
  }
}
