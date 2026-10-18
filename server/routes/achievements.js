import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pool } from '../db.js';
import { syncAchievements } from '../achievements/service.js';
const r = Router();
r.use(requireAuth);
// Expired access may view/derive awards from already saved history.
// No user ID, dates, counters, award IDs or weights are accepted from the client.
r.post('/sync', async (req, res) => {
  const timezone = req.body?.timezone || 'Europe/Moscow';
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { return res.status(400).json({ error: 'invalid_timezone' }); }
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await syncAchievements(pool, req.userId, timezone));
  } catch (e) {
    console.error('POST /achievements/sync:', e);
    res.status(500).json({ error: 'load_failed' });
  }
});
export default r;
