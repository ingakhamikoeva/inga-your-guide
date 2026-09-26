import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from './_helpers.js';

const r = Router();
r.use(requireAuth);
// Reading/exporting a user's saved diary remains available after access ends.
r.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const [checkins, meals] = await Promise.all([
      pool.query(`SELECT date::text AS date, weight_kg, sleep_hours, steps_yesterday, stool_yesterday
                    FROM public.daily_checkins WHERE user_id = $1 ORDER BY date DESC`, [req.userId]),
      pool.query(`SELECT log_id, raw_text, meal_tag, datetime, meta
                    FROM public.food_logs WHERE user_id = $1 ORDER BY datetime ASC`, [req.userId]),
    ]);
    res.json({ checkins: checkins.rows, meals: meals.rows });
  } catch {
    res.status(503).json({ error: 'diary_unavailable' });
  }
});
export default r;
