// JWT auth + admin gating, as Express middleware.
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload?.sub) return res.status(401).json({ error: "unauthorized" });
    req.userId = payload.sub;
    req.userEmail = payload.email || null;
    req.authPayload = payload;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export async function requireAdmin(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const r = await pool.query(
      `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
      [req.userId]
    );
    if (!r.rowCount) return res.status(403).json({ error: "forbidden" });
    next();
  } catch (e) {
    console.error("requireAdmin failed:", e);
    return res.status(500).json({ error: "role_check_failed" });
  }
}

// Legacy adapter for handlers that still call requireAuth() inline
// (server/ask-inga.js, server/estimate-nutrition.js, server/auth.js#meHandler).
// Returns { authId, payload } or null (with response already sent).
export async function requireAuthInline(req, res) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) { res.status(401).json({ error: "unauthorized" }); return null; }
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload?.sub) { res.status(401).json({ error: "unauthorized" }); return null; }
    return { authId: payload.sub, payload };
  } catch {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
}
