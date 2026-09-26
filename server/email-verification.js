import crypto from 'node:crypto';
import { pool } from './db.js';
import { requireAuthInline } from './middleware/auth.js';
import { passwordResetUrl } from './password-reset-url.js';
import { sendVerificationEmail } from './mailer.js';

const digest = token => crypto.createHash('sha256').update(token).digest('hex');

export function emailVerificationUrl(token) {
  // Reuse the trusted APP_URL validation; no request header/redirect is used.
  const link = new URL(passwordResetUrl(token));
  link.pathname = '/verify-email';
  link.searchParams.delete('type');
  return link.toString();
}

export async function requestEmailVerification(userId) {
  let client;
  let token, email, hash, link;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT email, email_verified FROM public.app_credentials WHERE user_id = $1 FOR UPDATE', [userId]);
    const row = result.rows[0];
    if (!row) throw new Error('user_not_found');
    if (row.email_verified) {
      await client.query('COMMIT');
      return { status: 'already_verified' };
    }
    // A legacy credential must not turn one request into an SMTP recipient list.
    if (typeof row.email !== 'string' || row.email.length > 254 ||
        !/^[^\s@,;<>"\\]+@[^\s@,;<>"\\]+\.[^\s@,;<>"\\]+$/.test(row.email)) {
      throw new Error('invalid_email');
    }
    const limits = await client.query(`
      SELECT count(*) AS daily,
             count(*) FILTER (WHERE created_at > clock_timestamp() - interval '60 seconds') AS recent
        FROM public.email_verification_tokens
       WHERE user_id = $1 AND created_at > clock_timestamp() - interval '24 hours'`, [userId]);
    if (Number(limits.rows[0].recent) > 0 || Number(limits.rows[0].daily) >= 5) {
      await client.query('COMMIT');
      return { status: 'rate_limited', retryAfter: Number(limits.rows[0].daily) >= 5 ? 86400 : 60 };
    }
    token = crypto.randomBytes(32).toString('base64url');
    hash = digest(token);
    link = emailVerificationUrl(token);
    email = row.email;
    await client.query(`
      INSERT INTO public.email_verification_tokens (token_hash, user_id, email, expires_at)
      VALUES ($1, $2, $3, clock_timestamp() + interval '168 hours')`, [hash, userId, email]);
    await client.query('COMMIT');
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client?.release();
  }

  // SMTP runs outside the transaction. Reservations also rate-limit concurrent
  // requests and failed sends; earlier valid links remain usable until verified.
  let sent = false;
  try { sent = (await sendVerificationEmail(email, link))?.sent === true; } catch {}
  if (!sent) {
    await pool.query(`UPDATE public.email_verification_tokens SET used_at = now()
                      WHERE token_hash = $1 AND used_at IS NULL`, [hash]);
    throw new Error('verification_send_failed');
  }
  return { status: 'sent' };
}

export async function sendVerificationHandler(req, res) {
  res.set('Cache-Control', 'no-store');
  const auth = await requireAuthInline(req, res);
  if (!auth) return;
  try {
    const result = await requestEmailVerification(auth.authId);
    if (result.status === 'rate_limited') {
      res.set('Retry-After', String(result.retryAfter));
      return res.status(429).json({ error: 'verification_rate_limited' });
    }
    return res.json({ ok: true, already_verified: result.status === 'already_verified' });
  } catch {
    console.error('email verification request failed');
    return res.status(503).json({ error: 'verification_send_failed' });
  }
}

export async function verifyEmailHandler(req, res) {
  res.set('Cache-Control', 'no-store');
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return res.status(400).json({ error: 'invalid_token' });
  }
  const hash = digest(token);
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const owner = await client.query(
      'SELECT user_id FROM public.email_verification_tokens WHERE token_hash = $1', [hash]);
    if (!owner.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'invalid_token' });
    }
    const userId = owner.rows[0].user_id;
    // Same lock order as sending: credentials, then token. A token confirms
    // only the email it was issued to, never a replacement address.
    const credential = await client.query(
      'SELECT email, email_verified FROM public.app_credentials WHERE user_id = $1 FOR UPDATE', [userId]);
    const result = await client.query(`
      SELECT email, used_at, expires_at > clock_timestamp() AS valid
        FROM public.email_verification_tokens WHERE token_hash = $1 FOR UPDATE`, [hash]);
    const row = result.rows[0], account = credential.rows[0];
    const error = !row || !account || row.email !== account.email ? 'invalid_token'
      : !row.valid ? 'token_expired'
      : row.used_at && !account.email_verified ? 'token_used' : null;
    if (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error });
    }
    if (!account.email_verified) {
      await client.query(`UPDATE public.app_credentials SET email_verified = true, updated_at = now()
                          WHERE user_id = $1`, [userId]);
    }
    await client.query(`UPDATE public.email_verification_tokens SET used_at = COALESCE(used_at, now())
                        WHERE user_id = $1 AND email = $2 AND used_at IS NULL`, [userId, account.email]);
    await client.query('COMMIT');
    // Reopening an already successful link is harmless and idempotent.
    // Never return sessions, passwords, or account identifiers from this endpoint.
    return res.json({ ok: true });
  } catch {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('email verification failed');
    return res.status(503).json({ error: 'verification_unavailable' });
  } finally {
    client?.release();
  }
}
