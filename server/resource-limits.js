import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { pool } from './db.js';

export const AI_LIMIT_MESSAGE = 'Достигнут лимит запросов к ИИ. Попробуйте позже.';
export const DIARY_AI_LIMIT_MESSAGE = 'Достигнут лимит запросов к ИИ. Попробуйте позже. Ваши записи сохранены.';
export const RESET_LIMIT_MESSAGE = 'Слишком много запросов на восстановление пароля. Попробуйте позже. Если письмо уже пришло, воспользуйтесь ссылкой в нём.';
const HOUR = 3600000;
const DAY = 24 * HOUR;
export const AI_TIMEOUT_MS = 60000;
const LEASE_MS = 90000;

function positiveInt(env, name, fallback) {
  if (env[name] === undefined || env[name] === '') return fallback;
  const value = Number(env[name]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid ${name}`);
  return value;
}
export function limitConfig(env = process.env) {
  return {
    userHourly: positiveInt(env, 'AI_USER_HOURLY_MAX', 60),
    concurrent: positiveInt(env, 'AI_MAX_CONCURRENT', 8),
    userConcurrent: positiveInt(env, 'AI_USER_MAX_CONCURRENT', 2),
    dailyCalls: positiveInt(env, 'AI_DAILY_MAX_CALLS', 2000),
    dailyUnits: positiveInt(env, 'AI_DAILY_BUDGET_UNITS', 50000000),
    resetIp: positiveInt(env, 'RESET_IP_MAX_15_MIN', 10),
    resetAccount: positiveInt(env, 'RESET_ACCOUNT_MAX_HOUR', 3),
    resetGlobal: positiveInt(env, 'RESET_GLOBAL_MAX_HOUR', 200),
    resetCooldownMs: 60000,
  };
}
export class ResourceLimitError extends Error {
  constructor(code, retryAfter) {
    super(code);
    this.code = code;
    this.retryAfter = Math.max(1, Math.ceil(retryAfter));
  }
}
export function sendResourceLimit(res, error, message = AI_LIMIT_MESSAGE) {
  if (!(error instanceof ResourceLimitError)) return false;
  res.set('Retry-After', String(error.retryAfter));
  res.status(429).json({ error: error.code, userMessage: message, retry_after: error.retryAfter });
  return true;
}

// Forwarded addresses are accepted only through an explicit proxy allowlist.
// Never read X-Real-IP directly, and never trust every network hop.
export function configureTrustedProxy(app, value = process.env.TRUSTED_PROXY_CIDRS || '') {
  const proxies = value.split(',').map(s => s.trim()).filter(Boolean);
  for (const proxy of proxies) {
    const [address, prefix, extra] = proxy.split('/');
    const version = isIP(address);
    if (!version || extra !== undefined || (prefix !== undefined &&
      (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))) {
      throw new Error('Invalid TRUSTED_PROXY_CIDRS');
    }
  }
  app.set('trust proxy', proxies.length ? proxies : false);
}
export function clientIp(req) {
  const address = req.ip || req.socket?.remoteAddress || 'unknown';
  return address.startsWith('::ffff:') && isIP(address.slice(7)) === 4 ? address.slice(7) : address;
}
const hash = text => createHash('sha256').update(text).digest('hex');

export function createResourceLimiter(db = pool, config = limitConfig()) {
  async function transaction(action) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '3s'");
      await client.query("SET LOCAL statement_timeout = '5s'");
      // A short admission transaction serializes quota checks across API workers.
      // No lock or database connection is held while calling AI or SMTP.
      await client.query('LOCK TABLE public.resource_limit_buckets IN SHARE ROW EXCLUSIVE MODE');
      const { rows: [row] } = await client.query('SELECT clock_timestamp() AS now');
      const now = new Date(row.now).getTime();
      await client.query('DELETE FROM public.resource_limit_buckets WHERE expires_at <= $1', [new Date(now)]);
      const result = await action(client, now);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  async function consume(client, now, rules, code) {
    const { rows } = await client.query('SELECT * FROM public.resource_limit_buckets WHERE key = ANY($1::text[])', [rules.map(r => r.key)]);
    const buckets = new Map(rows.map(row => [row.key, row]));
    let retryAfter = 0;
    for (const rule of rules) {
      const bucket = buckets.get(rule.key);
      if (Number(bucket?.hits || 0) + 1 > rule.max ||
          Number(bucket?.units || 0) + (rule.units || 0) > (rule.maxUnits ?? Infinity)) {
        retryAfter = Math.max(retryAfter, (bucket ? new Date(bucket.expires_at).getTime() - now : rule.windowMs) / 1000);
      }
    }
    if (retryAfter) throw new ResourceLimitError(code, retryAfter);
    for (const rule of rules) {
      await client.query(`INSERT INTO public.resource_limit_buckets (key, hits, units, expires_at)
        VALUES ($1, 1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET hits = resource_limit_buckets.hits + 1,
          units = resource_limit_buckets.units + EXCLUDED.units`,
      [rule.key, rule.units || 0, new Date(now + rule.windowMs)]);
    }
  }
  async function reserveAi(userId, units) {
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      throw new Error('AI request requires authenticated owner');
    }
    if (!Number.isSafeInteger(units) || units < 1) throw new Error('Invalid AI budget reservation');
    return transaction(async (client, now) => {
      await client.query('DELETE FROM public.ai_request_leases WHERE expires_at <= $1', [new Date(now)]);
      const { rows: [counts] } = await client.query(`SELECT count(*) AS total,
        count(*) FILTER (WHERE user_id = $1) AS owned FROM public.ai_request_leases`, [userId]);
      if (Number(counts.total) >= config.concurrent || Number(counts.owned) >= config.userConcurrent) {
        throw new ResourceLimitError('ai_limit', 5);
      }
      await consume(client, now, [
        { key: `ai:user:${userId}`, max: config.userHourly, windowMs: HOUR },
        { key: 'ai:global', max: config.dailyCalls, units, maxUnits: config.dailyUnits, windowMs: DAY },
      ], 'ai_limit');
      const id = randomUUID();
      await client.query('INSERT INTO public.ai_request_leases (id, user_id, expires_at) VALUES ($1, $2, $3)',
        [id, userId, new Date(now + LEASE_MS)]);
      return id;
    });
  }
  async function runAi(userId, units, action) {
    const lease = await reserveAi(userId, units);
    try { return await action(); }
    finally {
      // Failed calls keep their budget reservation: the provider may have charged.
      // Expiry recovers a slot if this process or the database becomes unavailable.
      await db.query('DELETE FROM public.ai_request_leases WHERE id = $1', [lease])
        .catch(() => console.error('AI lease release failed'));
    }
  }
  async function reservePasswordReset(email, ip) {
    const accountKey = hash(email.trim().toLowerCase());
    return transaction((client, now) => consume(client, now, [
      { key: `reset:cooldown:${accountKey}`, max: 1, windowMs: config.resetCooldownMs },
      { key: `reset:account:${accountKey}`, max: config.resetAccount, windowMs: HOUR },
      { key: `reset:ip:${hash(ip)}`, max: config.resetIp, windowMs: 15 * 60000 },
      { key: 'reset:global', max: config.resetGlobal, windowMs: HOUR },
    ], 'password_reset_limit'));
  }
  return { runAi, reserveAi, reservePasswordReset };
}
export const resourceLimiter = createResourceLimiter();
