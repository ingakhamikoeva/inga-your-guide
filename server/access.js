import { pool } from './db.js';

// Dates in PostgreSQL are authoritative. Do not trust subscription_status,
// client timestamps, profile flags, or request-supplied user IDs.
export async function getAccess(userId, db = pool) {
  const { rows } = await db.query(`
    SELECT now() AS server_now,
           s.trial_started_at, s.trial_ends_at, s.paid_until,
           COALESCE(s.paid_until > now(), false) AS paid_active,
           COALESCE(s.trial_started_at <= now() AND s.trial_ends_at > now(), false) AS trial_active
      FROM (SELECT $1::uuid AS user_id) u
      LEFT JOIN public.subscriptions s ON s.user_id = u.user_id`, [userId]);
  const row = rows[0];
  if (!row) throw new Error('access_state_missing');
  const paid = row.paid_active === true;
  const trial = row.trial_active === true;
  const status = paid ? 'paid' : trial ? 'trial'
    : row.trial_started_at || row.trial_ends_at || row.paid_until ? 'expired' : 'not_started';
  const ends = [paid ? row.paid_until : null, trial ? row.trial_ends_at : null]
    .filter(Boolean).sort((a, b) => new Date(b) - new Date(a));
  return {
    status, active: paid || trial,
    serverNow: row.server_now,
    accessEndsAt: ends[0] ?? null,
    trialStartedAt: row.trial_started_at ?? null,
    trialEndsAt: row.trial_ends_at ?? null,
    paidUntil: row.paid_until ?? null,
  };
}

// Inline adapter for AI handlers. Call after authentication and before
// provider requests or billable work. Local safety replies stay available.
export async function checkAccess(userId, res) {
  try {
    const access = await getAccess(userId);
    if (!access.active) {
      res.status(403).json({ error: 'access_required', access });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ error: 'access_unavailable' });
    return false;
  }
}

export async function requireAccess(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'unauthorized' });
  if (await checkAccess(req.userId, res)) next();
}

export function requireAccessForWrite(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  return requireAccess(req, res, next);
}

export function requireAccessForProgramEvent(req, res, next) {
  if (typeof req.body?.type === 'string' && req.body.type.startsWith('program_')) {
    return requireAccess(req, res, next);
  }
  return next();
}
