import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAccessForWrite } from '../access.js';

const r = Router();
r.use(requireAuth);
r.use(requireAccessForWrite);
r.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
r.param('date', (req, res, next, value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') {
    return res.status(400).json({ error: 'invalid_date' });
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return res.status(400).json({ error: 'invalid_date' });
  }
  next();
});

r.get('/:date', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT glasses, revision FROM public.daily_water WHERE user_id = $1 AND date = $2',
      [req.userId, req.params.date],
    );
    res.json(rows[0] || { glasses: 0, revision: 0 });
  } catch (e) {
    console.error('GET /water/:date:', e);
    res.status(503).json({ error: 'load_failed' });
  }
});

r.put('/:date', async (req, res) => {
  const { glasses, revision } = req.body || {};
  if (!Number.isInteger(glasses) || glasses < 0 || glasses > 1000
      || !Number.isInteger(revision) || revision < 0 || revision >= 2147483647) {
    return res.status(400).json({ error: 'invalid_water' });
  }
  try {
    // Compare-and-set prevents an old tab/device or a delayed retry from
    // replacing a newer count. Revision zero means no record exists yet.
    const { rows } = revision === 0
      ? await pool.query(`INSERT INTO public.daily_water (user_id, date, glasses)
          VALUES ($1, $2, $3) ON CONFLICT (user_id, date) DO NOTHING
          RETURNING glasses, revision`, [req.userId, req.params.date, glasses])
      : await pool.query(`UPDATE public.daily_water
          SET glasses = $3, revision = revision + 1, updated_at = now()
          WHERE user_id = $1 AND date = $2 AND revision = $4
          RETURNING glasses, revision`, [req.userId, req.params.date, glasses, revision]);
    if (!rows.length) return res.status(409).json({ error: 'water_changed' });
    res.json(rows[0]);
  } catch (e) {
    console.error('PUT /water/:date:', e);
    res.status(503).json({ error: 'save_failed' });
  }
});

export default r;
