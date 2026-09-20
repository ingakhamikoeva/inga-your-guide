import crypto from "crypto";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

export const ACCESS_TTL_SEC = 60 * 60;
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function secret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
  return process.env.JWT_SECRET;
}

export function verifyToken(token, type, { allowExpired = false } = {}) {
  try {
    const p = jwt.verify(token, secret(), {
      algorithms: ["HS256"], ignoreExpiration: allowExpired,
    });
    if (p.typ !== type || typeof p.sub !== "string" || !UUID.test(p.sub) ||
        typeof p.sid !== "string" || !UUID.test(p.sid) || !Number.isFinite(p.exp)) return null;
    return p;
  } catch {
    return null;
  }
}

export function signAccess(user, sid) {
  return jwt.sign(
    { sub: user.user_id, sid, typ: "access", email: user.email, role: user.role || "user" },
    secret(), { algorithm: "HS256", expiresIn: ACCESS_TTL_SEC }
  );
}

// Called inside the signup/login transaction, with the credentials row locked
// on login. A password reset cannot race an old-password login into a new session.
export async function createSession(client, user) {
  const sid = crypto.randomUUID();
  const refresh_token = jwt.sign(
    { sub: user.user_id, sid, typ: "refresh" },
    secret(), { algorithm: "HS256", expiresIn: SESSION_TTL_SEC }
  );
  const access_token = signAccess(user, sid);
  const expires = new Date(jwt.decode(refresh_token).exp * 1000);
  await client.query(
    `INSERT INTO public.app_sessions (session_id, user_id, expires_at)
     VALUES ($1, $2, $3)`, [sid, user.user_id, expires]
  );
  return { access_token, refresh_token };
}

export async function activeSession(payload, client = pool) {
  const r = await client.query(
    `SELECT 1 FROM public.app_sessions
     WHERE session_id = $1 AND user_id = $2
       AND revoked_at IS NULL AND expires_at > clock_timestamp()`,
    [payload.sid, payload.sub]
  );
  return r.rowCount > 0;
}

export async function authenticateAccess(token) {
  const payload = verifyToken(token, "access");
  if (!payload || !(await activeSession(payload))) return null;
  return payload;
}
