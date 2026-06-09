// Stand-alone auth: signup/login/refresh/me/forgot-password/reset-password,
// OAuth redirect stubs. JWT HS256, signed with JWT_SECRET.
//
// JWT payload: { sub: user_id, email, role: 'user' | 'admin', iat, exp }

import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, requireAuth } from "./index.js";

const ACCESS_TTL_SEC = 60 * 60;           // 1 hour
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days
const RESET_TTL_MS = 60 * 60 * 1000;       // 1 hour

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

function signAccess(user) {
  return jwt.sign(
    { sub: user.user_id, email: user.email, role: user.role || "user" },
    jwtSecret(),
    { algorithm: "HS256", expiresIn: ACCESS_TTL_SEC }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.user_id, typ: "refresh" },
    jwtSecret(),
    { algorithm: "HS256", expiresIn: REFRESH_TTL_SEC }
  );
}

async function resolveRole(userId) {
  try {
    const r = await pool.query(
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

// ── handlers ──────────────────────────────────────────────────────

export async function signupHandler(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  if (password.length < 6) return res.status(400).json({ error: "password too short" });

  const client = await pool.connect();
  try {
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
      `INSERT INTO public.app_credentials (user_id, email, password_hash, email_verified)
       VALUES ($1, $2, $3, false)`,
      [userId, email, hash]
    );

    await client.query("COMMIT");

    const role = await resolveRole(userId);
    const userObj = {
      user_id: userId,
      email,
      email_verified: false,
      created_at: userIns.rows[0].created_at,
      role,
    };
    const access_token = signAccess(userObj);
    const refresh_token = signRefresh(userObj);
    return res.status(201).json({
      access_token,
      refresh_token,
      expires_in: ACCESS_TTL_SEC,
      token_type: "Bearer",
      user: publicUser(userObj, role),
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("signup failed:", e);
    return res.status(500).json({ error: "signup_failed" });
  } finally {
    client.release();
  }
}

export async function loginHandler(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  try {
    const r = await pool.query(
      `SELECT c.user_id, c.email, c.password_hash, c.email_verified, u.created_at
         FROM public.app_credentials c
         JOIN public.users u ON u.user_id = c.user_id
        WHERE lower(c.email) = $1
        LIMIT 1`,
      [email]
    );
    if (!r.rowCount) return res.status(401).json({ error: "invalid_credentials" });
    const row = r.rows[0];
    if (!row.password_hash) return res.status(401).json({ error: "invalid_credentials" });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const role = await resolveRole(row.user_id);
    const userObj = { ...row, role };
    const access_token = signAccess(userObj);
    const refresh_token = signRefresh(userObj);
    return res.json({
      access_token,
      refresh_token,
      expires_in: ACCESS_TTL_SEC,
      token_type: "Bearer",
      user: publicUser(row, role),
    });
  } catch (e) {
    console.error("login failed:", e);
    return res.status(500).json({ error: "login_failed" });
  }
}

export async function logoutHandler(_req, res) {
  // Stateless JWT — nothing to invalidate server-side without a session store.
  // The client drops its tokens.
  return res.json({ ok: true });
}

export async function refreshHandler(req, res) {
  const token = String(req.body?.refresh_token || "");
  if (!token) return res.status(400).json({ error: "refresh_token required" });
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (payload.typ !== "refresh" || !payload.sub) {
      return res.status(401).json({ error: "invalid_refresh" });
    }
    const r = await pool.query(
      `SELECT c.user_id, c.email, c.email_verified, u.created_at
         FROM public.app_credentials c JOIN public.users u ON u.user_id = c.user_id
        WHERE c.user_id = $1 LIMIT 1`,
      [payload.sub]
    );
    if (!r.rowCount) return res.status(401).json({ error: "invalid_refresh" });
    const row = r.rows[0];
    const role = await resolveRole(row.user_id);
    const userObj = { ...row, role };
    return res.json({
      access_token: signAccess(userObj),
      refresh_token: signRefresh(userObj),
      expires_in: ACCESS_TTL_SEC,
      token_type: "Bearer",
      user: publicUser(row, role),
    });
  } catch {
    return res.status(401).json({ error: "invalid_refresh" });
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
  const redirectTo =
    String(req.body?.redirect_to || "").trim() ||
    `${process.env.SITE_URL || ""}/reset-password`;
  if (!email) return res.status(400).json({ error: "email required" });

  try {
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

      const link = `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}token=${raw}&type=recovery`;

      // TODO(phase later): send via SMTP. For now log to server console so the
      // operator can copy it during bring-up.
      console.log(`[auth] password reset for ${email}: ${link}`);
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
  try {
    const r = await pool.query(
      `SELECT user_id, expires_at, used_at FROM public.password_reset_tokens
        WHERE token_hash = $1 LIMIT 1`,
      [hash]
    );
    if (!r.rowCount) return res.status(400).json({ error: "invalid_token" });
    const row = r.rows[0];
    if (row.used_at) return res.status(400).json({ error: "token_used" });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "token_expired" });
    }

    const ph = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE public.app_credentials SET password_hash = $1, updated_at = now()
        WHERE user_id = $2`,
      [ph, row.user_id]
    );
    await pool.query(
      `UPDATE public.password_reset_tokens SET used_at = now() WHERE token_hash = $1`,
      [hash]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("reset-password failed:", e);
    return res.status(500).json({ error: "reset_password_failed" });
  }
}

// ── OAuth (stubs) ─────────────────────────────────────────────────
// Real Google/Apple flows arrive in Phase 6. For now return 501 so
// the frontend can detect that managed OAuth isn't wired here yet.

export function oauthRedirectHandler(req, res) {
  const provider = String(req.params?.provider || "");
  res.status(501).json({
    error: "oauth_not_configured",
    provider,
    message: "OAuth providers are not enabled on this server yet.",
  });
}

export function oauthCallbackHandler(_req, res) {
  res.status(501).json({ error: "oauth_not_configured" });
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
  app.get(`${prefix}/oauth/:provider`, oauthRedirectHandler);
  app.get(`${prefix}/oauth/:provider/callback`, oauthCallbackHandler);
}
