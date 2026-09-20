// Stand-alone auth: signup/login/refresh/me/forgot-password/reset-password,
// OAuth redirect stubs. JWT HS256, signed with JWT_SECRET.
//
// JWT payload includes typ (access/refresh) and sid (revocable server session).

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { requireAuthInline as requireAuth } from "./middleware/auth.js";
import { ACCESS_TTL_SEC, createSession, signAccess, verifyToken, activeSession } from "./sessions.js";
import { passwordResetUrl } from "./password-reset-url.js";
import { sendPasswordResetEmail, sendDay0Email } from "./mailer.js";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

async function resolveRole(userId, db = pool) {
  try {
    const r = await db.query(
      `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
      [userId]
    );
    return r.rowCount ? "admin" : "user";
  } catch {
    return "user";
  }
}

function publicUser(row, role) {
  return {
    id: row.user_id,
    user_id: row.user_id,
    email: row.email,
    email_verified: row.email_verified ?? false,
    role: role || "user",
    created_at: row.created_at,
  };
}

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// Редакция оферты и политики, действующая на момент регистрации. Обязана
// совпадать с датой в шапке документов на legche.online: именно она пишется
// в consent_doc_version и служит доказательством согласия (ч. 3 ст. 9 152-ФЗ).
// Меняется в .env (LEGAL_DOCS_VERSION) одновременно с текстами; значение ниже —
// запасное, на случай если переменная не задана.
const LEGAL_DOCS_VERSION = process.env.LEGAL_DOCS_VERSION || "2026-09-01";

// ── handlers ──────────────────────────────────────────────────────

export async function signupHandler(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  if (password.length < 6) return res.status(400).json({ error: "password too short" });

  // Согласие на обработку ПД обязательно (152-ФЗ); на рассылку — нет.
  const pdConsent = req.body?.pdConsent === true;
  const marketingConsent = req.body?.marketingConsent === true;
  if (!pdConsent) return res.status(400).json({ error: "pd_consent_required" });

  // Источник регистрации (UTM с лендинга) — необязательный, просто аналитика.
  const ALLOWED_UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const rawUtm = req.body?.utm && typeof req.body.utm === "object" ? req.body.utm : null;
  const utm = rawUtm
    ? Object.fromEntries(
        ALLOWED_UTM_KEYS
          .filter((k) => typeof rawUtm[k] === "string" && rawUtm[k])
          .map((k) => [k, String(rawUtm[k]).slice(0, 200)])
      )
    : null;

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT 1 FROM public.app_credentials WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );
    if (exists.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "user_already_exists" });
    }

    const userIns = await client.query(
      `INSERT INTO public.users (user_id, status) VALUES (gen_random_uuid(), 'trial')
       RETURNING user_id, created_at`
    );
    const userId = userIns.rows[0].user_id;

    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO public.app_credentials
         (user_id, email, password_hash, email_verified, pd_consent_at,
          marketing_consent, marketing_consent_at, consent_doc_version)
       VALUES ($1, $2, $3, false, now(),
          $4, CASE WHEN $4 THEN now() ELSE NULL END, $5)`,
      [userId, email, hash, marketingConsent, LEGAL_DOCS_VERSION]
    );

    if (utm && Object.keys(utm).length) {
      await client.query(
        `INSERT INTO public.user_events (user_id, type, payload_json) VALUES ($1, 'registration_source', $2::jsonb)`,
        [userId, JSON.stringify(utm)]
      );
    }

    const role = "user";
    const userObj = {
      user_id: userId,
      email,
      email_verified: false,
      created_at: userIns.rows[0].created_at,
      role,
    };
    const { access_token, refresh_token } = await createSession(client, userObj);

    await client.query("COMMIT");

    // Письмо «День 0» — fire-and-forget, не блокирует и не роняет регистрацию.
    // Вариант темы (A/B) логируется в user_events для последующей аналитики.
    sendDay0Email(email, null, userId)
      .then((r) => {
        if (r?.sent) {
          return pool.query(
            `INSERT INTO public.user_events (user_id, type, payload_json) VALUES ($1, 'email_day0_sent', $2::jsonb)`,
            [userId, JSON.stringify({ subjectVariant: r.subjectVariant ?? null })]
          );
        }
      })
      .catch((e) => console.error("day0 email failed:", e.message));

    return res.status(201).json({
      access_token,
      refresh_token,
      expires_in: ACCESS_TTL_SEC,
      token_type: "Bearer",
      user: publicUser(userObj, role),
    });
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("signup failed:", e);
    return res.status(500).json({ error: "signup_failed" });
  } finally {
    client?.release();
  }
}

export async function loginHandler(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const r = await client.query(
      `SELECT c.user_id, c.email, c.password_hash, c.email_verified, u.created_at
         FROM public.app_credentials c
         JOIN public.users u ON u.user_id = c.user_id
        WHERE lower(c.email) = $1
        LIMIT 1 FOR UPDATE OF c`, [email]
    );
    const row = r.rows[0];
    if (!row?.password_hash || !(await bcrypt.compare(password, row.password_hash))) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const role = await resolveRole(row.user_id, client);
    const { access_token, refresh_token } = await createSession(client, { ...row, role });
    await client.query("COMMIT");
    return res.json({
      access_token, refresh_token,
      expires_in: ACCESS_TTL_SEC,
      token_type: "Bearer",
      user: publicUser(row, role),
    });
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("login failed:", e);
    return res.status(500).json({ error: "login_failed" });
  } finally {
    client?.release();
  }
}

export async function logoutHandler(req, res) {
  const header = req.headers.authorization || "";
  // Even an expired access token may revoke its own session. It grants no access.
  const payload = header.startsWith("Bearer ")
    ? verifyToken(header.slice(7), "access", { allowExpired: true }) : null;
  if (!payload) return res.json({ ok: true });
  try {
    await pool.query(
      `UPDATE public.app_sessions SET revoked_at = COALESCE(revoked_at, now())
       WHERE session_id = $1 AND user_id = $2`, [payload.sid, payload.sub]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("logout failed:", e);
    return res.status(500).json({ error: "logout_failed" });
  }
}

export async function refreshHandler(req, res) {
  const token = String(req.body?.refresh_token || "");
  if (!token) return res.status(400).json({ error: "refresh_token required" });
  const payload = verifyToken(token, "refresh");
  if (!payload) return res.status(401).json({ error: "invalid_refresh" });
  try {
    if (!(await activeSession(payload))) return res.status(401).json({ error: "invalid_refresh" });
    const r = await pool.query(
      `SELECT c.user_id, c.email, c.email_verified, u.created_at
         FROM public.app_credentials c JOIN public.users u ON u.user_id = c.user_id
        WHERE c.user_id = $1 LIMIT 1`, [payload.sub]
    );
    if (!r.rowCount) return res.status(401).json({ error: "invalid_refresh" });
    const row = r.rows[0];
    const role = await resolveRole(row.user_id);
    // Refresh keeps the same session and its original 30-day deadline.
    // Concurrent tabs can renew access without invalidating each other's tokens.
    return res.json({
      access_token: signAccess({ ...row, role }, payload.sid),
      refresh_token: token,
      expires_in: ACCESS_TTL_SEC,
      token_type: "Bearer",
      user: publicUser(row, role),
    });
  } catch (e) {
    console.error("refresh failed:", e);
    return res.status(503).json({ error: "auth_unavailable" });
  }
}

export async function meHandler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  try {
    const r = await pool.query(
      `SELECT c.user_id, c.email, c.email_verified, u.created_at
         FROM public.app_credentials c JOIN public.users u ON u.user_id = c.user_id
        WHERE c.user_id = $1 LIMIT 1`,
      [auth.authId]
    );
    if (!r.rowCount) return res.status(404).json({ error: "user_not_found" });
    const row = r.rows[0];
    const role = await resolveRole(row.user_id);
    return res.json({ user: publicUser(row, role) });
  } catch (e) {
    console.error("me failed:", e);
    return res.status(500).json({ error: "me_failed" });
  }
}

export async function forgotPasswordHandler(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "email required" });

  try {
    // Validate configuration even for an unknown email, without leaking account existence.
    passwordResetUrl("configuration-check");
    const r = await pool.query(
      `SELECT user_id FROM public.app_credentials WHERE lower(email) = $1 LIMIT 1`,
      [email]
    );
    // Always return success to avoid leaking which emails exist.
    if (r.rowCount) {
      const userId = r.rows[0].user_id;
      const raw = crypto.randomBytes(32).toString("base64url");
      const hash = sha256(raw);
      const expires = new Date(Date.now() + RESET_TTL_MS);

      await pool.query(
        `INSERT INTO public.password_reset_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [hash, userId, expires]
      );

      const link = passwordResetUrl(raw);

      sendPasswordResetEmail(email, link).catch((e) =>
        console.error("password reset email failed:", e.message)
      );
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("forgot-password failed:", e);
    return res.status(500).json({ error: "forgot_password_failed" });
  }
}

export async function resetPasswordHandler(req, res) {
  const token = String(req.body?.token || "");
  const newPassword = String(req.body?.new_password || req.body?.password || "");
  if (!token || !newPassword) return res.status(400).json({ error: "token and new_password required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "password too short" });

  const hash = sha256(token);
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const owner = await client.query(
      `SELECT user_id FROM public.password_reset_tokens WHERE token_hash = $1`, [hash]
    );
    if (!owner.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "invalid_token" });
    }
    const userId = owner.rows[0].user_id;
    // Serialize password changes with login and other resets of this account.
    const credential = await client.query(
      `SELECT user_id FROM public.app_credentials WHERE user_id = $1 FOR UPDATE`, [userId]
    );
    if (!credential.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "invalid_token" });
    }
    const r = await client.query(
      `SELECT used_at, expires_at > clock_timestamp() AS valid
       FROM public.password_reset_tokens WHERE token_hash = $1 FOR UPDATE`, [hash]
    );
    const row = r.rows[0];
    const error = !row ? "invalid_token" : row.used_at ? "token_used" : !row.valid ? "token_expired" : null;
    if (error) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error });
    }
    const ph = await bcrypt.hash(newPassword, 10);
    await client.query(
      `UPDATE public.app_credentials SET password_hash = $1, updated_at = now()
        WHERE user_id = $2`, [ph, userId]
    );
    await client.query(
      `UPDATE public.password_reset_tokens SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`, [userId]
    );
    await client.query(
      `UPDATE public.app_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`, [userId]
    );
    await client.query("COMMIT");
    return res.json({ ok: true });
  } catch (e) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("reset-password failed:", e);
    return res.status(500).json({ error: "reset_password_failed" });
  } finally {
    client?.release();
  }
}

// ── router wiring helper ──────────────────────────────────────────

export function registerAuthRoutes(app, prefix = "/api/v1/auth") {
  app.post(`${prefix}/signup`, signupHandler);
  app.post(`${prefix}/login`, loginHandler);
  app.post(`${prefix}/logout`, logoutHandler);
  app.post(`${prefix}/refresh`, refreshHandler);
  app.get(`${prefix}/me`, meHandler);
  app.post(`${prefix}/forgot-password`, forgotPasswordHandler);
  app.post(`${prefix}/reset-password`, resetPasswordHandler);
}

