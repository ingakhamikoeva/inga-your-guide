import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

r.get("/", async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT answers_json FROM public.assessment_answers
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );
    const arr = q.rows[0]?.answers_json;
    res.json(Array.isArray(arr) ? arr : null);
  } catch (e) {
    console.error("GET /assessment:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

r.post("/", async (req, res) => {
  const answers = req.body?.answers;
  if (!Array.isArray(answers)) return res.status(400).json({ error: "answers must be array" });
  try {
    await pool.query(
      `INSERT INTO public.assessment_answers (user_id, answers_json) VALUES ($1, $2::jsonb)`,
      [req.userId, JSON.stringify(answers)]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /assessment:", e);
    res.status(500).json({ error: "save_failed" });
  }
});

export default r;
