import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

// GET /admin/me — non-admin returns 200 with { admin: false }, admin returns { admin: true }.
r.get("/me", async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1`,
      [req.userId]
    );
    res.json({ admin: !!q.rowCount });
  } catch (e) {
    console.error("GET /admin/me:", e);
    res.status(500).json({ error: "check_failed" });
  }
});

// Settings endpoints — admin only.
r.get("/settings/:key", requireAdmin, async (req, res) => {
  try {
    const q = await pool.query(`SELECT value FROM public.app_settings WHERE key = $1`, [req.params.key]);
    res.json(q.rows[0]?.value ?? null);
  } catch (e) {
    console.error("GET /admin/settings:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.put("/settings/:key", requireAdmin, async (req, res) => {
  const { value } = req.body ?? {};
  try {
    await pool.query(
      `INSERT INTO public.app_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_by = EXCLUDED.updated_by,
             updated_at = EXCLUDED.updated_at`,
      [req.params.key, JSON.stringify(value), req.userId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("PUT /admin/settings:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;
