import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "./_helpers.js";

const r = Router();
r.use(requireAuth);

// Прогресс программы «Месяц N»: какие дни открыты (тап по карточке),
// когда открыт последний, какие задания отмечены. Без миграций — читаем user_events.
r.get("/program-progress", async (req, res) => {
  const month = /^\d+$/.test(String(req.query.month)) ? String(req.query.month) : "1";
  try {
    const opened = await pool.query(
      `SELECT (payload_json->>'day')::int AS day, MIN(created_at) AS opened_at
       FROM public.user_events
       WHERE user_id = $1 AND type = 'program_day_opened' AND payload_json->>'month' = $2
       GROUP BY 1 ORDER BY 1`,
      [req.userId, month]
    );
    const tasks = await pool.query(
      `SELECT DISTINCT ON ((payload_json->>'day')::int)
         (payload_json->>'day')::int AS day, type
       FROM public.user_events
       WHERE user_id = $1 AND type IN ('program_task_done','program_task_undone')
         AND payload_json->>'month' = $2
       ORDER BY (payload_json->>'day')::int, created_at DESC`,
      [req.userId, month]
    );
    const days = opened.rows.map(x => x.day).filter(d => Number.isFinite(d));
    const last = opened.rows.length ? opened.rows[opened.rows.length - 1] : null;
    res.json({
      opened_days: days,
      last_day: last ? last.day : 0,
      last_opened_at: last ? last.opened_at : null,
      tasks_done: tasks.rows.filter(x => x.type === 'program_task_done').map(x => x.day).filter(d => Number.isFinite(d)),
    });
  } catch (e) {
    console.error("GET /events/program-progress:", e);
    res.status(500).json({ error: "load_failed" });
  }
});

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
