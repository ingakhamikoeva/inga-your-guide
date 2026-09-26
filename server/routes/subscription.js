import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAccess } from '../access.js';

const r = Router();
r.use(requireAuth);
r.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json(await getAccess(req.userId));
  } catch {
    res.status(503).json({ error: 'access_unavailable' });
  }
});
export default r;
