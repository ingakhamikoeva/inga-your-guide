import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.post("/", async (req, res) => {
  const { type, payload = null } = req.body || {};
  if (!type) return res.status(400).json({ error: "type required" });
  try {
    await pool.query(
      `INSERT INTO public.user_events (user_id, type, payload_json) VALUES ($1, $2, $3::jsonb)`,
      [req.userId, type, payload === null ? null : JSON.stringify(payload)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /events:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;
